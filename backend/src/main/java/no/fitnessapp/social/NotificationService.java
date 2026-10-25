package no.fitnessapp.social;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.media.AvatarService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** Varsler i appen: ny følger, følgeforespørsel, godtatt forespørsel, liker, kommentar og nedlasting. */
@Service
public class NotificationService {

    public enum Type { FOLLOW, FOLLOW_REQUEST, FOLLOW_ACCEPTED, LIKE, COMMENT, DOWNLOAD, COMMENT_LIKE, REPLY, TAG, MENTION }

    /** programId/routineId og targetName er satt for DOWNLOAD (navnet på det som ble lastet ned). */
    public record Notification(UUID id, Type type, UserSummary actor, UUID workoutId, String workoutName, String commentPreview,
            Instant createdAt, boolean read, UUID programId, UUID routineId, String targetName) {}

    private final JdbcClient jdbc;
    private final AvatarService avatars;

    public NotificationService(JdbcClient jdbc, AvatarService avatars) {
        this.jdbc = jdbc;
        this.avatars = avatars;
    }

    /** Legger inn et varsel. Ingen varsler til seg selv, og samme liker/følging gir ikke dobbelt varsel. */
    public void notify(UUID recipient, UUID actor, Type type, UUID workoutId, UUID commentId) {
        if (recipient.equals(actor)) return;
        if (type != Type.COMMENT && type != Type.REPLY && type != Type.MENTION) {
            jdbc.sql("""
                            DELETE FROM notifications WHERE recipient_id = :r AND actor_id = :a AND type = :t
                            AND workout_id IS NOT DISTINCT FROM CAST(:w AS uuid) AND comment_id IS NOT DISTINCT FROM CAST(:c AS uuid)
                            """)
                    .param("r", recipient).param("a", actor).param("t", type.name()).param("w", workoutId).param("c", commentId).update();
        }
        jdbc.sql("""
                        INSERT INTO notifications (id, recipient_id, actor_id, type, workout_id, comment_id)
                        VALUES (:id, :r, :a, :t, :w, :c)
                        """)
                .param("id", UUID.randomUUID()).param("r", recipient).param("a", actor).param("t", type.name())
                .param("w", workoutId).param("c", commentId).update();
    }

    /** Noen lastet ned et program eller en rutine. Én nedlasting av samme ting gir ett varsel. */
    public void notifyDownload(UUID recipient, UUID actor, UUID programId, UUID routineId) {
        if (recipient.equals(actor)) return;
        jdbc.sql("""
                        DELETE FROM notifications WHERE recipient_id = :r AND actor_id = :a AND type = 'DOWNLOAD'
                        AND program_id IS NOT DISTINCT FROM CAST(:p AS uuid) AND routine_id IS NOT DISTINCT FROM CAST(:ro AS uuid)
                        """)
                .param("r", recipient).param("a", actor).param("p", programId).param("ro", routineId).update();
        jdbc.sql("""
                        INSERT INTO notifications (id, recipient_id, actor_id, type, program_id, routine_id)
                        VALUES (:id, :r, :a, 'DOWNLOAD', :p, :ro)
                        """)
                .param("id", UUID.randomUUID()).param("r", recipient).param("a", actor).param("p", programId).param("ro", routineId)
                .update();
    }

    /** Fjerner et varsel om en kommentar (f.eks. liker på kommentaren trukket tilbake). */
    public void retractComment(UUID recipient, UUID actor, Type type, UUID commentId) {
        jdbc.sql("DELETE FROM notifications WHERE recipient_id = :r AND actor_id = :a AND type = :t AND comment_id = :c")
                .param("r", recipient).param("a", actor).param("t", type.name()).param("c", commentId).update();
    }

    /** Fjerner et varsel som ikke lenger stemmer (f.eks. liker trukket tilbake). */
    public void retract(UUID recipient, UUID actor, Type type, UUID workoutId) {
        jdbc.sql("""
                        DELETE FROM notifications WHERE recipient_id = :r AND actor_id = :a AND type = :t
                        AND workout_id IS NOT DISTINCT FROM CAST(:w AS uuid)
                        """)
                .param("r", recipient).param("a", actor).param("t", type.name()).param("w", workoutId).update();
    }

    public List<Notification> list(UUID recipient) {
        return jdbc.sql("""
                        SELECT n.id, n.type, n.workout_id, n.program_id, n.routine_id, COALESCE(pr.name, ro.name) AS target_name, n.created_at, n.read_at, w.name AS workout_name, c.body AS comment_body,
                               u.id AS actor_id, u.username, u.display_name, u.avatar_key, u.visibility,
                               (SELECT f.status FROM follows f WHERE f.follower_id = :r AND f.followee_id = u.id) AS my_status
                        FROM notifications n
                        JOIN users u ON u.id = n.actor_id
                        LEFT JOIN workouts w ON w.id = n.workout_id
                        LEFT JOIN workout_comments c ON c.id = n.comment_id
                        LEFT JOIN programs pr ON pr.id = n.program_id
                        LEFT JOIN routines ro ON ro.id = n.routine_id
                        WHERE n.recipient_id = :r AND u.username IS NOT NULL AND """ + Blocks.visibleUser("u.id") + """

                        ORDER BY n.created_at DESC
                        LIMIT 100
                        """)
                .param("r", recipient).param("viewer", recipient)
                .query((rs, i) -> {
                    String my = rs.getString("my_status");
                    FollowStatus status = my == null ? FollowStatus.NONE : my.equals("ACCEPTED") ? FollowStatus.FOLLOWING : FollowStatus.PENDING;
                    UserSummary actor = new UserSummary(rs.getObject("actor_id", UUID.class), rs.getString("username"), rs.getString("display_name"),
                            avatars.urlFor(rs.getString("avatar_key")), "PRIVATE".equals(rs.getString("visibility")), false, status);
                    String body = rs.getString("comment_body");
                    return new Notification(rs.getObject("id", UUID.class), Type.valueOf(rs.getString("type")), actor,
                            rs.getObject("workout_id", UUID.class), rs.getString("workout_name"),
                            body == null ? null : body.length() > 120 ? body.substring(0, 120) + "…" : body,
                            rs.getTimestamp("created_at").toInstant(), rs.getTimestamp("read_at") != null,
                            rs.getObject("program_id", UUID.class), rs.getObject("routine_id", UUID.class), rs.getString("target_name"));
                })
                .list();
    }

    public long unreadCount(UUID recipient) {
        return jdbc.sql("SELECT count(*) FROM notifications WHERE recipient_id = :r AND read_at IS NULL")
                .param("r", recipient).query(Long.class).single();
    }

    public void markAllRead(UUID recipient) {
        jdbc.sql("UPDATE notifications SET read_at = now() WHERE recipient_id = :r AND read_at IS NULL").param("r", recipient).update();
    }
}
