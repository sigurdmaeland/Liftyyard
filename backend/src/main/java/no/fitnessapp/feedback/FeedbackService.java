package no.fitnessapp.feedback;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.common.ConflictException;
import no.fitnessapp.common.TooManyRequestsException;
import no.fitnessapp.moderation.ModerationService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Tilbakemeldinger fra appen (feil, forslag, support). Maks 10 per bruker per time. */
@Service
public class FeedbackService {

    public enum Kind { BUG, IDEA, SUPPORT }

    public record Item(
            UUID id, Kind kind, String message, String appVersion, String platform, String status, Instant createdAt,
            UUID userId, String username, String displayName) {}

    static final int MAX_PER_HOUR = 10;

    private final JdbcClient jdbc;
    private final ModerationService moderation;

    public FeedbackService(JdbcClient jdbc, ModerationService moderation) {
        this.jdbc = jdbc;
        this.moderation = moderation;
    }

    /** Lagrer tilbakemeldingen. Idempotent på id (samme melding sendt to ganger lagres én gang). */
    @Transactional
    public void submit(UUID userId, UUID id, Kind kind, String message, String appVersion, String platform) {
        String text = message == null ? "" : message.strip();
        if (text.isEmpty()) throw new BadRequestException("Skriv en melding");
        var owner = jdbc.sql("SELECT user_id FROM feedback WHERE id = :id").param("id", id).query(UUID.class).optional();
        if (owner.isPresent()) {
            if (!owner.get().equals(userId)) throw new ConflictException("ID-en er allerede i bruk");
            return;
        }
        int recent = jdbc.sql("SELECT count(*) FROM feedback WHERE user_id = :u AND created_at > now() - interval '1 hour'")
                .param("u", userId).query(Integer.class).single();
        if (recent >= MAX_PER_HOUR) throw new TooManyRequestsException("Du har sendt mange meldinger. Prøv igjen om en time.");
        jdbc.sql("""
                INSERT INTO feedback (id, user_id, kind, message, app_version, platform)
                VALUES (:id, :u, :kind, :message, :version, :platform)
                """)
                .param("id", id).param("u", userId).param("kind", kind.name()).param("message", text)
                .param("version", appVersion).param("platform", platform)
                .update();
    }

    /** Åpne (eller lukkede) tilbakemeldinger, nyeste først. Bare moderatorer. */
    @Transactional(readOnly = true)
    public List<Item> list(UUID moderator, String status) {
        moderation.requireModerator(moderator);
        String s = status == null ? "OPEN" : status;
        if (!List.of("OPEN", "DONE").contains(s)) throw new BadRequestException("Ukjent status");
        return jdbc.sql("""
                SELECT f.id, f.kind, f.message, f.app_version, f.platform, f.status, f.created_at,
                       u.id AS user_id, u.username, u.display_name
                FROM feedback f JOIN users u ON u.id = f.user_id
                WHERE f.status = :s
                ORDER BY f.created_at DESC
                LIMIT 200
                """)
                .param("s", s)
                .query((rs, i) -> new Item(
                        rs.getObject("id", UUID.class), Kind.valueOf(rs.getString("kind")), rs.getString("message"),
                        rs.getString("app_version"), rs.getString("platform"), rs.getString("status"),
                        rs.getTimestamp("created_at").toInstant(), rs.getObject("user_id", UUID.class), rs.getString("username"),
                        rs.getString("display_name")))
                .list();
    }

    @Transactional
    public void markDone(UUID moderator, UUID id) {
        moderation.requireModerator(moderator);
        jdbc.sql("UPDATE feedback SET status = 'DONE', done_at = now() WHERE id = :id AND status = 'OPEN'").param("id", id).update();
    }
}
