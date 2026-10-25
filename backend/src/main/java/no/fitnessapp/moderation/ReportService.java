package no.fitnessapp.moderation;

import java.util.UUID;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.common.NotFoundException;
import no.fitnessapp.social.WorkoutAccess;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Rapportering av brukere og innhold. Man kan bare rapportere det man selv kan se. Rapporten tar
 * med en kopi av teksten (snapshot), så moderatorer ser hva som ble rapportert selv om det endres.
 * Idempotent: samme rapport-ID eller en åpen rapport på samme innhold gir ingen ny rad.
 */
@Service
public class ReportService {

    public enum TargetType { USER, WORKOUT, COMMENT, PROGRAM, ROUTINE }

    public enum Reason { SPAM, HARASSMENT, HATE, NUDITY, VIOLENCE, SELF_HARM, IMPERSONATION, MISINFORMATION, OTHER }

    private record Target(UUID ownerId, String snapshot) {}

    private final JdbcClient jdbc;
    private final WorkoutAccess workouts;

    public ReportService(JdbcClient jdbc, WorkoutAccess workouts) {
        this.jdbc = jdbc;
        this.workouts = workouts;
    }

    @Transactional
    public void report(UUID reporter, UUID reportId, TargetType type, UUID targetId, Reason reason, String details) {
        if (jdbc.sql("SELECT EXISTS (SELECT 1 FROM reports WHERE id = :id)").param("id", reportId).query(Boolean.class).single()) return;
        Target target = resolve(reporter, type, targetId);
        if (reporter.equals(target.ownerId())) throw new BadRequestException("Du kan ikke rapportere ditt eget innhold");
        try {
            jdbc.sql("""
                            INSERT INTO reports (id, reporter_id, target_type, target_id, target_user_id, reason, details, snapshot)
                            VALUES (:id, :r, :t, :tid, :owner, :reason, :details, :snapshot)
                            ON CONFLICT (reporter_id, target_type, target_id) WHERE status = 'OPEN' DO NOTHING
                            """)
                    .param("id", reportId).param("r", reporter).param("t", type.name()).param("tid", targetId)
                    .param("owner", target.ownerId()).param("reason", reason.name())
                    .param("details", details == null || details.isBlank() ? null : details.trim())
                    .param("snapshot", target.snapshot())
                    .update();
        } catch (DuplicateKeyException e) {
            // Samme ID sendt to ganger samtidig: den første vant.
        }
    }

    /** Finner eieren av innholdet og en tekstkopi. 404 hvis det ikke finnes eller ikke er synlig for den som rapporterer. */
    private Target resolve(UUID viewer, TargetType type, UUID id) {
        return switch (type) {
            case USER -> jdbc.sql("SELECT id, display_name, username, bio FROM users WHERE id = :id AND username IS NOT NULL")
                    .param("id", id)
                    .query((rs, n) -> new Target(rs.getObject("id", UUID.class),
                            "@" + rs.getString("username") + " (" + rs.getString("display_name") + ")"
                                    + (rs.getString("bio") == null ? "" : "\nBio: " + rs.getString("bio"))))
                    .optional().orElseThrow(() -> new NotFoundException("Fant ikke brukeren"));
            case WORKOUT -> {
                UUID owner = workouts.requireViewable(viewer, id);
                String text = jdbc.sql("SELECT name || coalesce(E'\\n' || description, '') FROM workouts WHERE id = :id")
                        .param("id", id).query(String.class).single();
                yield new Target(owner, text);
            }
            case COMMENT -> {
                var row = jdbc.sql("SELECT workout_id, user_id, body FROM workout_comments WHERE id = :id").param("id", id)
                        .query((rs, n) -> new Object[] {rs.getObject("workout_id", UUID.class), rs.getObject("user_id", UUID.class),
                                rs.getString("body")})
                        .optional().orElseThrow(() -> new NotFoundException("Fant ikke kommentaren"));
                workouts.requireViewable(viewer, (UUID) row[0]);
                yield new Target((UUID) row[1], (String) row[2]);
            }
            case PROGRAM -> shared("programs", "description", viewer, id, "Fant ikke programmet");
            case ROUTINE -> shared("routines", "notes", viewer, id, "Fant ikke rutinen");
        };
    }

    private Target shared(String table, String textColumn, UUID viewer, UUID id, String notFound) {
        // Delte programmer/rutiner: samme synlighetsregel som i Utforsk.
        String sql = """
                SELECT x.owner_user_id, x.name || coalesce(E'\\n' || x.%s, '') AS text
                FROM %s x JOIN users u ON u.id = x.owner_user_id
                WHERE x.id = :id AND %s
                """.formatted(textColumn, table, no.fitnessapp.explore.ExploreAccess.shared("x"));
        return jdbc.sql(sql).param("id", id).param("viewer", viewer)
                .query((rs, n) -> new Target(rs.getObject("owner_user_id", UUID.class), rs.getString("text")))
                .optional().orElseThrow(() -> new NotFoundException(notFound));
    }
}
