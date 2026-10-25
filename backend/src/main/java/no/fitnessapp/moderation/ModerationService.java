package no.fitnessapp.moderation;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.common.ForbiddenException;
import no.fitnessapp.common.NotFoundException;
import no.fitnessapp.media.AvatarService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Behandling av rapporter (bare MODERATOR og ADMIN). Et vedtak gjelder alle åpne rapporter på samme
 * innhold. Tiltak er så skånsomme som mulig: økter, programmer og rutiner gjøres private (eieren
 * beholder dem), kommentarer slettes, og en profil får bio, lenker og bilde fjernet. Sperring kan oppheves.
 */
@Service
public class ModerationService {

    public enum Action { DISMISS, REMOVE_CONTENT, SUSPEND_USER }

    public record ReportItem(
            UUID id, String targetType, UUID targetId, UUID targetUserId, String targetUsername, String targetDisplayName,
            boolean targetSuspended, String reason, String details, String snapshot, String reporterUsername, Instant createdAt,
            String status, String action, String resolutionNote, Instant resolvedAt, long openReportsOnTarget) {}

    private final JdbcClient jdbc;
    private final AvatarService avatars;

    public ModerationService(JdbcClient jdbc, AvatarService avatars) {
        this.jdbc = jdbc;
        this.avatars = avatars;
    }

    public void requireModerator(UUID userId) {
        String role = jdbc.sql("SELECT role FROM users WHERE id = :id").param("id", userId).query(String.class).optional().orElse("USER");
        if (!role.equals("MODERATOR") && !role.equals("ADMIN")) throw new ForbiddenException("Bare moderatorer har tilgang");
    }

    public List<ReportItem> list(UUID moderator, String status) {
        requireModerator(moderator);
        String s = status == null ? "OPEN" : status;
        if (!List.of("OPEN", "RESOLVED", "DISMISSED").contains(s)) throw new BadRequestException("Ukjent status");
        return jdbc.sql("""
                        SELECT r.*, tu.username AS target_username, tu.display_name AS target_display_name,
                               tu.suspended_at IS NOT NULL AS target_suspended, ru.username AS reporter_username,
                               (SELECT count(*) FROM reports o WHERE o.target_type = r.target_type AND o.target_id = r.target_id
                                  AND o.status = 'OPEN') AS open_on_target
                        FROM reports r
                        LEFT JOIN users tu ON tu.id = r.target_user_id
                        LEFT JOIN users ru ON ru.id = r.reporter_id
                        WHERE r.status = :s
                        ORDER BY CASE WHEN r.status = 'OPEN' THEN r.created_at END ASC, r.resolved_at DESC
                        LIMIT 200
                        """)
                .param("s", s)
                .query((rs, n) -> new ReportItem(rs.getObject("id", UUID.class), rs.getString("target_type"), rs.getObject("target_id", UUID.class),
                        rs.getObject("target_user_id", UUID.class), rs.getString("target_username"), rs.getString("target_display_name"),
                        rs.getBoolean("target_suspended"), rs.getString("reason"), rs.getString("details"), rs.getString("snapshot"),
                        rs.getString("reporter_username"), rs.getTimestamp("created_at").toInstant(), rs.getString("status"),
                        rs.getString("action"), rs.getString("resolution_note"),
                        rs.getTimestamp("resolved_at") == null ? null : rs.getTimestamp("resolved_at").toInstant(), rs.getLong("open_on_target")))
                .list();
    }

    @Transactional
    public void resolve(UUID moderator, UUID reportId, Action action, String note) {
        requireModerator(moderator);
        record Row(String type, UUID targetId, UUID ownerId) {}
        Row r = jdbc.sql("SELECT target_type, target_id, target_user_id FROM reports WHERE id = :id")
                .param("id", reportId)
                .query((rs, n) -> new Row(rs.getString("target_type"), rs.getObject("target_id", UUID.class), rs.getObject("target_user_id", UUID.class)))
                .optional().orElseThrow(() -> new NotFoundException("Fant ikke rapporten"));
        if (moderator.equals(r.ownerId()) && action != Action.DISMISS) throw new BadRequestException("Du kan ikke behandle rapporter om deg selv");

        switch (action) {
            case DISMISS -> {}
            case REMOVE_CONTENT -> removeContent(r.type(), r.targetId(), r.ownerId());
            case SUSPEND_USER -> {
                if (r.ownerId() == null) throw new BadRequestException("Kontoen finnes ikke lenger");
                suspend(r.ownerId());
            }
        }
        jdbc.sql("""
                        UPDATE reports SET status = :status, action = :action, resolution_note = :note, resolved_by = :m, resolved_at = now()
                        WHERE target_type = :t AND target_id = :tid AND status = 'OPEN'
                        """)
                .param("status", action == Action.DISMISS ? "DISMISSED" : "RESOLVED").param("action", action.name())
                .param("note", note == null || note.isBlank() ? null : note.trim()).param("m", moderator)
                .param("t", r.type()).param("tid", r.targetId())
                .update();
    }

    private void removeContent(String type, UUID id, UUID ownerId) {
        switch (type) {
            case "WORKOUT" -> jdbc.sql("UPDATE workouts SET visibility = 'PRIVATE' WHERE id = :id").param("id", id).update();
            case "COMMENT" -> jdbc.sql("DELETE FROM workout_comments WHERE id = :id").param("id", id).update();
            case "PROGRAM" -> jdbc.sql("UPDATE programs SET visibility = 'PRIVATE' WHERE id = :id").param("id", id).update();
            case "ROUTINE" -> jdbc.sql("UPDATE routines SET visibility = 'PRIVATE' WHERE id = :id").param("id", id).update();
            case "USER" -> {
                jdbc.sql("""
                                UPDATE users SET bio = NULL, instagram = NULL, tiktok = NULL, youtube = NULL, website = NULL, updated_at = now()
                                WHERE id = :id
                                """)
                        .param("id", id).update();
                avatars.remove(id);
            }
            default -> throw new IllegalStateException(type);
        }
    }

    /** Sperrer kontoen: ingen ny innlogging, alle økter logges ut, og innholdet skjules for andre. */
    private void suspend(UUID userId) {
        jdbc.sql("UPDATE users SET suspended_at = now() WHERE id = :id AND suspended_at IS NULL").param("id", userId).update();
        jdbc.sql("UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = :id AND revoked_at IS NULL").param("id", userId).update();
    }

    public void unsuspend(UUID moderator, UUID userId) {
        requireModerator(moderator);
        jdbc.sql("UPDATE users SET suspended_at = NULL WHERE id = :id").param("id", userId).update();
    }
}
