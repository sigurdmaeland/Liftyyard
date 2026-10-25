package no.fitnessapp.social;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.common.NotFoundException;
import no.fitnessapp.media.AvatarService;
import no.fitnessapp.users.UsernameRules;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Følging og søk. Offentlige profiler kan følges direkte; private gir en forespørsel (PENDING) som
 * eieren må godta. Bare godtatte følgere ser øktene på en profil.
 */
@Service
public class FollowService {

    private final JdbcClient jdbc;
    private final AvatarService avatars;
    private final NotificationService notifications;

    public FollowService(JdbcClient jdbc, AvatarService avatars, NotificationService notifications) {
        this.jdbc = jdbc;
        this.avatars = avatars;
        this.notifications = notifications;
    }

    public UUID requireUserId(String rawUsername) {
        return jdbc.sql("SELECT id FROM users WHERE username = :u").param("u", UsernameRules.normalize(rawUsername))
                .query(UUID.class).optional()
                .orElseThrow(() -> new NotFoundException("Fant ikke brukeren"));
    }

    /** Som requireUserId, men 404 også hvis en av dere har blokkert den andre, eller kontoen er sperret. */
    public UUID requireVisibleUserId(UUID viewer, String rawUsername) {
        UUID target = requireUserId(rawUsername);
        boolean visible = jdbc.sql("SELECT " + Blocks.visibleUser(":target")).param("viewer", viewer).param("target", target)
                .query(Boolean.class).single();
        if (!visible) throw new NotFoundException("Fant ikke brukeren");
        return target;
    }

    public FollowStatus status(UUID viewer, UUID target) {
        if (viewer.equals(target)) return FollowStatus.NONE;
        return jdbc.sql("SELECT status FROM follows WHERE follower_id = :f AND followee_id = :t")
                .param("f", viewer).param("t", target).query(String.class).optional()
                .map(s -> s.equals("ACCEPTED") ? FollowStatus.FOLLOWING : FollowStatus.PENDING)
                .orElse(FollowStatus.NONE);
    }

    /** Kan `viewer` se innholdet (økter, følgerlister) på `target` sin profil? */
    public boolean canViewContent(UUID viewer, UUID target) {
        if (viewer.equals(target)) return true;
        return status(viewer, target) == FollowStatus.FOLLOWING;
    }

    /** Kan `viewer` se følgerlistene? Offentlige profiler: alle. Private: eier og godtatte følgere. */
    public boolean canViewLists(UUID viewer, UUID target) {
        if (canViewContent(viewer, target)) return true;
        return jdbc.sql("SELECT visibility FROM users WHERE id = :id").param("id", target).query(String.class).single().equals("PUBLIC");
    }

    /** Følger (eller ber om å følge). Idempotent. */
    @Transactional
    public FollowStatus follow(UUID viewer, String username) {
        UUID target = requireVisibleUserId(viewer, username);
        if (viewer.equals(target)) throw new BadRequestException("Du kan ikke følge deg selv");
        boolean isPrivate = jdbc.sql("SELECT visibility FROM users WHERE id = :id").param("id", target).query(String.class).single().equals("PRIVATE");
        jdbc.sql("""
                        INSERT INTO follows (follower_id, followee_id, status, accepted_at)
                        VALUES (:f, :t, :s, CASE WHEN :s = 'ACCEPTED' THEN now() END)
                        ON CONFLICT (follower_id, followee_id) DO NOTHING
                        """)
                .param("f", viewer).param("t", target).param("s", isPrivate ? "PENDING" : "ACCEPTED").update();
        FollowStatus result = status(viewer, target);
        notifications.notify(target, viewer,
                result == FollowStatus.FOLLOWING ? NotificationService.Type.FOLLOW : NotificationService.Type.FOLLOW_REQUEST, null, null);
        return result;
    }

    /** Slutter å følge, eller trekker tilbake en forespørsel. Idempotent. */
    public void unfollow(UUID viewer, String username) {
        UUID target = requireUserId(username);
        jdbc.sql("DELETE FROM follows WHERE follower_id = :f AND followee_id = :t").param("f", viewer).param("t", target).update();
        notifications.retract(target, viewer, NotificationService.Type.FOLLOW_REQUEST, null);
    }

    /** Godtar en forespørsel fra `username` om å følge `owner`. */
    public void accept(UUID owner, String username) {
        UUID follower = requireUserId(username);
        int n = jdbc.sql("""
                        UPDATE follows SET status = 'ACCEPTED', accepted_at = now()
                        WHERE follower_id = :f AND followee_id = :o AND status = 'PENDING'
                        """)
                .param("f", follower).param("o", owner).update();
        if (n == 0 && status(follower, owner) != FollowStatus.FOLLOWING) throw new NotFoundException("Fant ingen forespørsel");
        if (n > 0) {
            notifications.retract(owner, follower, NotificationService.Type.FOLLOW_REQUEST, null);
            notifications.notify(owner, follower, NotificationService.Type.FOLLOW, null, null);
            notifications.notify(follower, owner, NotificationService.Type.FOLLOW_ACCEPTED, null, null);
        }
    }

    /** Avslår en forespørsel eller fjerner en følger. Idempotent. */
    public void removeFollower(UUID owner, String username) {
        UUID follower = requireUserId(username);
        jdbc.sql("DELETE FROM follows WHERE follower_id = :f AND followee_id = :o").param("f", follower).param("o", owner).update();
        notifications.retract(owner, follower, NotificationService.Type.FOLLOW_REQUEST, null);
    }

    public record Counts(long followers, long following, long pendingRequests) {}

    public Counts counts(UUID userId) {
        return jdbc.sql("""
                        SELECT (SELECT count(*) FROM follows WHERE followee_id = :u AND status = 'ACCEPTED') AS followers,
                               (SELECT count(*) FROM follows WHERE follower_id = :u AND status = 'ACCEPTED') AS following,
                               (SELECT count(*) FROM follows WHERE followee_id = :u AND status = 'PENDING') AS pending
                        """)
                .param("u", userId)
                .query((rs, n) -> new Counts(rs.getLong("followers"), rs.getLong("following"), rs.getLong("pending")))
                .single();
    }

    private static final String SUMMARY_COLUMNS = """
            u.id, u.username, u.display_name, u.avatar_key, u.visibility,
            (SELECT f.status FROM follows f WHERE f.follower_id = :viewer AND f.followee_id = u.id) AS my_status
            """;

    private UserSummary summary(ResultSet rs, UUID viewer) throws SQLException {
        UUID id = rs.getObject("id", UUID.class);
        String my = rs.getString("my_status");
        FollowStatus status = my == null ? FollowStatus.NONE : my.equals("ACCEPTED") ? FollowStatus.FOLLOWING : FollowStatus.PENDING;
        return new UserSummary(id, rs.getString("username"), rs.getString("display_name"), avatars.urlFor(rs.getString("avatar_key")),
                "PRIVATE".equals(rs.getString("visibility")), id.equals(viewer), status);
    }

    /** Søk på brukernavn og navn. Treff på starten av brukernavnet kommer først. Maks 30. */
    public List<UserSummary> search(UUID viewer, String rawQuery) {
        String q = rawQuery == null ? "" : rawQuery.trim().toLowerCase().replaceFirst("^@", "");
        if (q.length() < 2) return List.of();
        String like = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        String prefix = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%";
        return jdbc.sql("SELECT " + SUMMARY_COLUMNS + """
                        FROM users u
                        WHERE u.username IS NOT NULL AND (u.username LIKE :like OR lower(u.display_name) LIKE :like)
                          AND """ + Blocks.visibleUser("u.id") + """

                        ORDER BY (u.username = :q) DESC, (u.username LIKE :prefix) DESC, (lower(u.display_name) LIKE :prefix) DESC,
                                 u.username
                        LIMIT 30
                        """)
                .param("viewer", viewer).param("like", like).param("prefix", prefix).param("q", q)
                .query((rs, n) -> summary(rs, viewer))
                .list();
    }

    public List<UserSummary> followers(UUID viewer, UUID target) {
        return jdbc.sql("SELECT " + SUMMARY_COLUMNS + """
                        FROM follows f JOIN users u ON u.id = f.follower_id
                        WHERE f.followee_id = :target AND f.status = 'ACCEPTED' AND u.username IS NOT NULL
                          AND """ + Blocks.visibleUser("u.id") + """

                        ORDER BY f.accepted_at DESC
                        """)
                .param("viewer", viewer).param("target", target)
                .query((rs, n) -> summary(rs, viewer))
                .list();
    }

    public List<UserSummary> following(UUID viewer, UUID target) {
        return jdbc.sql("SELECT " + SUMMARY_COLUMNS + """
                        FROM follows f JOIN users u ON u.id = f.followee_id
                        WHERE f.follower_id = :target AND f.status = 'ACCEPTED' AND u.username IS NOT NULL
                          AND """ + Blocks.visibleUser("u.id") + """

                        ORDER BY f.accepted_at DESC
                        """)
                .param("viewer", viewer).param("target", target)
                .query((rs, n) -> summary(rs, viewer))
                .list();
    }

    public List<UserSummary> pendingRequests(UUID owner) {
        return jdbc.sql("SELECT " + SUMMARY_COLUMNS + """
                        FROM follows f JOIN users u ON u.id = f.follower_id
                        WHERE f.followee_id = :owner AND f.status = 'PENDING'
                          AND """ + Blocks.visibleUser("u.id") + """

                        ORDER BY f.created_at DESC
                        """)
                .param("viewer", owner).param("owner", owner)
                .query((rs, n) -> summary(rs, owner))
                .list();
    }

    /** Et forslag: brukeren og hvor mange du følger som følger dem. */
    public record Suggestion(UserSummary user, long mutualCount) {}

    /** Venners venner (flest felles først), fylt opp med populære offentlige profiler. Maks 20. */
    public List<Suggestion> suggestions(UUID viewer) {
        return jdbc.sql("SELECT " + SUMMARY_COLUMNS + ",\n" + """
                               (SELECT count(*) FROM follows a JOIN follows b ON b.follower_id = a.followee_id
                                WHERE a.follower_id = :viewer AND a.status = 'ACCEPTED' AND b.followee_id = u.id AND b.status = 'ACCEPTED') AS mutual,
                               (SELECT count(*) FROM follows f WHERE f.followee_id = u.id AND f.status = 'ACCEPTED') AS followers
                        FROM users u
                        WHERE u.username IS NOT NULL AND u.id <> :viewer AND u.id <> '00000000-0000-7000-8000-0000000000aa'
                          AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = :viewer AND f.followee_id = u.id)
                          AND """ + Blocks.visibleUser("u.id") + """

                          AND (u.visibility = 'PUBLIC' OR EXISTS (
                                SELECT 1 FROM follows a JOIN follows b ON b.follower_id = a.followee_id
                                WHERE a.follower_id = :viewer AND a.status = 'ACCEPTED' AND b.followee_id = u.id AND b.status = 'ACCEPTED'))
                        ORDER BY mutual DESC, followers DESC, u.created_at DESC
                        LIMIT 20
                        """)
                .param("viewer", viewer)
                .query((rs, n) -> new Suggestion(summary(rs, viewer), rs.getLong("mutual")))
                .list();
    }

    public Optional<Boolean> followsYou(UUID viewer, UUID target) {
        if (viewer.equals(target)) return Optional.empty();
        return Optional.of(status(target, viewer) == FollowStatus.FOLLOWING);
    }
}
