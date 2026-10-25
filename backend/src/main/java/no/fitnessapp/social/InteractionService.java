package no.fitnessapp.social;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.common.ForbiddenException;
import no.fitnessapp.media.AvatarService;
import no.fitnessapp.media.ImageProcessor;
import no.fitnessapp.media.MediaStorage;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Liker, kommentarer og bilder på økter. Alt krever at man kan se økten (se WorkoutAccess). */
@Service
public class InteractionService {

    static final int MAX_PHOTOS = 4;
    static final long MAX_PHOTO_BYTES = 10 * 1024 * 1024;

    /** parentId er satt for svar (ett nivå). */
    public record Comment(UUID id, UserSummary author, String body, Instant createdAt, boolean canDelete, UUID parentId, long likeCount,
            boolean likedByMe) {}

    private static final java.util.regex.Pattern MENTION = java.util.regex.Pattern.compile("@([a-z0-9._]{3,30})");

    private final JdbcClient jdbc;
    private final WorkoutAccess access;
    private final NotificationService notifications;
    private final AvatarService avatars;
    private final MediaStorage storage;

    public InteractionService(JdbcClient jdbc, WorkoutAccess access, NotificationService notifications, AvatarService avatars,
            MediaStorage storage) {
        this.jdbc = jdbc;
        this.access = access;
        this.notifications = notifications;
        this.avatars = avatars;
        this.storage = storage;
    }

    // ---------- Liker ----------

    @Transactional
    public void like(UUID viewer, UUID workoutId) {
        UUID owner = access.requireViewable(viewer, workoutId);
        int n = jdbc.sql("INSERT INTO workout_likes (workout_id, user_id) VALUES (:w, :u) ON CONFLICT DO NOTHING")
                .param("w", workoutId).param("u", viewer).update();
        if (n > 0) notifications.notify(owner, viewer, NotificationService.Type.LIKE, workoutId, null);
    }

    @Transactional
    public void unlike(UUID viewer, UUID workoutId) {
        UUID owner = access.requireViewable(viewer, workoutId);
        jdbc.sql("DELETE FROM workout_likes WHERE workout_id = :w AND user_id = :u").param("w", workoutId).param("u", viewer).update();
        notifications.retract(owner, viewer, NotificationService.Type.LIKE, workoutId);
    }

    public List<UserSummary> likes(UUID viewer, UUID workoutId) {
        access.requireViewable(viewer, workoutId);
        return jdbc.sql("""
                        SELECT u.id, u.username, u.display_name, u.avatar_key, u.visibility,
                               (SELECT f.status FROM follows f WHERE f.follower_id = :viewer AND f.followee_id = u.id) AS my_status
                        FROM workout_likes l JOIN users u ON u.id = l.user_id
                        WHERE l.workout_id = :w AND u.username IS NOT NULL AND """ + Blocks.visibleUser("u.id") + """

                        ORDER BY l.created_at DESC
                        """)
                .param("viewer", viewer).param("w", workoutId)
                .query((rs, n) -> {
                    UUID id = rs.getObject("id", UUID.class);
                    String my = rs.getString("my_status");
                    FollowStatus s = my == null ? FollowStatus.NONE : my.equals("ACCEPTED") ? FollowStatus.FOLLOWING : FollowStatus.PENDING;
                    return new UserSummary(id, rs.getString("username"), rs.getString("display_name"), avatars.urlFor(rs.getString("avatar_key")),
                            "PRIVATE".equals(rs.getString("visibility")), id.equals(viewer), s);
                })
                .list();
    }

    // ---------- Kommentarer ----------

    public List<Comment> comments(UUID viewer, UUID workoutId) {
        UUID owner = access.requireViewable(viewer, workoutId);
        return jdbc.sql("""
                        SELECT c.id, c.body, c.created_at, c.parent_id, u.id AS author_id, u.username, u.display_name, u.avatar_key, u.visibility,
                               (SELECT count(*) FROM comment_likes l WHERE l.comment_id = c.id) AS likes,
                               EXISTS (SELECT 1 FROM comment_likes l WHERE l.comment_id = c.id AND l.user_id = :viewer) AS liked
                        FROM workout_comments c JOIN users u ON u.id = c.user_id
                        WHERE c.workout_id = :w AND """ + Blocks.visibleUser("u.id") + """

                        ORDER BY c.created_at
                        """)
                .param("w", workoutId).param("viewer", viewer)
                .query((rs, n) -> {
                    UUID authorId = rs.getObject("author_id", UUID.class);
                    UserSummary author = new UserSummary(authorId, rs.getString("username"), rs.getString("display_name"),
                            avatars.urlFor(rs.getString("avatar_key")), "PRIVATE".equals(rs.getString("visibility")), authorId.equals(viewer),
                            FollowStatus.NONE);
                    return new Comment(rs.getObject("id", UUID.class), author, rs.getString("body"), rs.getTimestamp("created_at").toInstant(),
                            authorId.equals(viewer) || owner.equals(viewer), rs.getObject("parent_id", UUID.class), rs.getLong("likes"),
                            rs.getBoolean("liked"));
                })
                .list();
    }

    /** Legger til en kommentar. Idempotent på klientens ID (samme ID to ganger gir én kommentar). */
    @Transactional
    public void comment(UUID viewer, UUID workoutId, UUID commentId, String body, UUID parentId) {
        UUID owner = access.requireViewable(viewer, workoutId);
        String text = body == null ? "" : body.trim();
        if (text.isEmpty() || text.length() > 1000) throw new BadRequestException("Kommentaren må være 1–1000 tegn");
        // Svar henges alltid på den øverste kommentaren (ett nivå), og må høre til samme økt.
        record Parent(UUID id, UUID author) {}
        Parent parent = null;
        if (parentId != null) {
            parent = jdbc.sql("SELECT coalesce(parent_id, id) AS top, user_id FROM workout_comments WHERE id = :p AND workout_id = :w")
                    .param("p", parentId).param("w", workoutId)
                    .query((rs, i) -> new Parent(rs.getObject("top", UUID.class), rs.getObject("user_id", UUID.class)))
                    .optional().orElseThrow(() -> new BadRequestException("Fant ikke kommentaren du svarer på"));
        }
        int n = jdbc.sql("""
                        INSERT INTO workout_comments (id, workout_id, user_id, body, parent_id) VALUES (:id, :w, :u, :b, :p)
                        ON CONFLICT (id) DO NOTHING
                        """)
                .param("id", commentId).param("w", workoutId).param("u", viewer).param("b", text)
                .param("p", parent == null ? null : parent.id()).update();
        if (n == 0) return;
        java.util.Set<UUID> notified = new java.util.HashSet<>(java.util.List.of(viewer));
        notifications.notify(owner, viewer, NotificationService.Type.COMMENT, workoutId, commentId);
        notified.add(owner);
        if (parent != null && notified.add(parent.author())) {
            notifications.notify(parent.author(), viewer, NotificationService.Type.REPLY, workoutId, commentId);
        }
        // @omtale: varsel til nevnte brukere som kan se økten (maks 5 per kommentar).
        var matcher = MENTION.matcher(text.toLowerCase());
        int mentions = 0;
        while (matcher.find() && mentions < 5) {
            UUID mentioned = jdbc.sql("SELECT id FROM users WHERE username = :u").param("u", matcher.group(1)).query(UUID.class).optional().orElse(null);
            if (mentioned == null || !notified.add(mentioned) || !access.canView(mentioned, workoutId)) continue;
            notifications.notify(mentioned, viewer, NotificationService.Type.MENTION, workoutId, commentId);
            mentions++;
        }
    }

    /** Liker en kommentar (idempotent). Krever at man kan se økten. */
    @Transactional
    public void likeComment(UUID viewer, UUID commentId, boolean like) {
        record Row(UUID workout, UUID author) {}
        Row row = jdbc.sql("SELECT workout_id, user_id FROM workout_comments WHERE id = :id").param("id", commentId)
                .query((rs, i) -> new Row(rs.getObject("workout_id", UUID.class), rs.getObject("user_id", UUID.class)))
                .optional().orElseThrow(() -> new no.fitnessapp.common.NotFoundException("Fant ikke kommentaren"));
        access.requireViewable(viewer, row.workout());
        if (like) {
            int n = jdbc.sql("INSERT INTO comment_likes (comment_id, user_id) VALUES (:c, :u) ON CONFLICT DO NOTHING")
                    .param("c", commentId).param("u", viewer).update();
            if (n > 0) notifications.notify(row.author(), viewer, NotificationService.Type.COMMENT_LIKE, row.workout(), commentId);
        } else {
            jdbc.sql("DELETE FROM comment_likes WHERE comment_id = :c AND user_id = :u").param("c", commentId).param("u", viewer).update();
            notifications.retractComment(row.author(), viewer, NotificationService.Type.COMMENT_LIKE, commentId);
        }
    }

    // ---------- Treningspartnere ----------

    /**
     * Setter hvem eieren trente med. Bare brukere eieren følger eller blir fulgt av (godtatt), og som
     * ingen av dem har blokkert. Nye partnere får varsel. Maks 10.
     */
    @Transactional
    public void setPartners(UUID owner, UUID workoutId, List<String> usernames) {
        access.requireOwner(owner, workoutId);
        if (usernames.size() > 10) throw new BadRequestException("Maks 10 treningspartnere");
        java.util.Set<UUID> ids = new java.util.LinkedHashSet<>();
        for (String raw : usernames) {
            UUID id = jdbc.sql("""
                            SELECT u.id FROM users u
                            WHERE u.username = :u AND u.id <> :viewer AND """ + Blocks.visibleUser("u.id") + """
                              AND EXISTS (SELECT 1 FROM follows f WHERE f.status = 'ACCEPTED'
                                          AND ((f.follower_id = :viewer AND f.followee_id = u.id) OR (f.follower_id = u.id AND f.followee_id = :viewer)))
                            """)
                    .param("u", raw.trim().toLowerCase().replaceFirst("^@", "")).param("viewer", owner)
                    .query(UUID.class).optional()
                    .orElseThrow(() -> new BadRequestException("Du kan bare legge til folk du følger eller som følger deg: " + raw));
            ids.add(id);
        }
        List<UUID> before = jdbc.sql("SELECT user_id FROM workout_partners WHERE workout_id = :w").param("w", workoutId).query(UUID.class).list();
        jdbc.sql("DELETE FROM workout_partners WHERE workout_id = :w").param("w", workoutId).update();
        for (UUID id : ids) {
            jdbc.sql("INSERT INTO workout_partners (workout_id, user_id) VALUES (:w, :u)").param("w", workoutId).param("u", id).update();
            if (!before.contains(id)) notifications.notify(id, owner, NotificationService.Type.TAG, workoutId, null);
        }
    }

    /** Fjerner seg selv som treningspartner på en økt. Idempotent. */
    public void leavePartner(UUID viewer, UUID workoutId) {
        jdbc.sql("DELETE FROM workout_partners WHERE workout_id = :w AND user_id = :u").param("w", workoutId).param("u", viewer).update();
    }

    /** Sletter en kommentar. Forfatteren og eieren av økten kan slette. Idempotent. */
    public void deleteComment(UUID viewer, UUID commentId) {
        record Row(UUID author, UUID owner) {}
        var row = jdbc.sql("""
                        SELECT c.user_id AS author, w.user_id AS owner FROM workout_comments c JOIN workouts w ON w.id = c.workout_id
                        WHERE c.id = :id
                        """)
                .param("id", commentId)
                .query((rs, n) -> new Row(rs.getObject("author", UUID.class), rs.getObject("owner", UUID.class)))
                .optional();
        if (row.isEmpty()) return;
        if (!row.get().author().equals(viewer) && !row.get().owner().equals(viewer)) throw new ForbiddenException("Du kan ikke slette denne kommentaren");
        jdbc.sql("DELETE FROM workout_comments WHERE id = :id").param("id", commentId).update();
    }

    // ---------- Bilder ----------

    /** Legger til (eller erstatter) et bilde på egen økt. Idempotent på bildets ID. Maks 4 per økt. */
    @Transactional
    public String putPhoto(UUID userId, UUID workoutId, UUID photoId, byte[] original) {
        access.requireOwner(userId, workoutId);
        if (original.length == 0) throw new BadRequestException("Tom fil");
        if (original.length > MAX_PHOTO_BYTES) throw new BadRequestException("Bildet er større enn 10 MB");
        var existing = jdbc.sql("SELECT workout_id FROM workout_photos WHERE id = :id").param("id", photoId).query(UUID.class).optional();
        if (existing.isPresent() && !existing.get().equals(workoutId)) throw new BadRequestException("Bildet hører til en annen økt");
        long count = jdbc.sql("SELECT count(*) FROM workout_photos WHERE workout_id = :w AND id <> :id")
                .param("w", workoutId).param("id", photoId).query(Long.class).single();
        if (count >= MAX_PHOTOS) throw new BadRequestException("Maks " + MAX_PHOTOS + " bilder per økt");

        byte[] jpeg = ImageProcessor.fitJpeg(original, 1600);
        String key = "photos/" + userId + "/" + photoId + ".jpg";
        storage.write(key, jpeg);
        jdbc.sql("""
                        INSERT INTO workout_photos (id, workout_id, storage_key, position) VALUES (:id, :w, :k, :p)
                        ON CONFLICT (id) DO UPDATE SET storage_key = excluded.storage_key
                        """)
                .param("id", photoId).param("w", workoutId).param("k", key).param("p", (int) count).update();
        return storage.publicUrl(key);
    }

    /** Sletter et bilde fra egen økt. Idempotent. */
    public void deletePhoto(UUID userId, UUID workoutId, UUID photoId) {
        access.requireOwner(userId, workoutId);
        jdbc.sql("SELECT storage_key FROM workout_photos WHERE id = :id AND workout_id = :w").param("id", photoId).param("w", workoutId)
                .query(String.class).optional()
                .ifPresent(key -> {
                    jdbc.sql("DELETE FROM workout_photos WHERE id = :id").param("id", photoId).update();
                    storage.delete(key);
                });
    }

    /** Bildefiler for alle økter til en bruker (slettes sammen med kontoen). */
    public List<String> photoKeysForUser(UUID userId) {
        return jdbc.sql("SELECT p.storage_key FROM workout_photos p JOIN workouts w ON w.id = p.workout_id WHERE w.user_id = :u")
                .param("u", userId).query(String.class).list();
    }

    /** Sletter bildefilene til en økt (databaseradene slettes sammen med økten). */
    public void deletePhotoFilesForWorkout(UUID userId, UUID workoutId) {
        jdbc.sql("SELECT p.storage_key FROM workout_photos p JOIN workouts w ON w.id = p.workout_id WHERE w.id = :w AND w.user_id = :u")
                .param("w", workoutId).param("u", userId).query(String.class).list()
                .forEach(storage::delete);
    }
}
