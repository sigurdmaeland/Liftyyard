package no.fitnessapp.measurements;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import no.fitnessapp.common.ConflictException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

/** Målinger og innstillinger er flate rader; JdbcClient holder koden kort. Alt er per bruker. */
@Repository
public class MeasurementStore {

    private final JdbcClient jdbc;

    public MeasurementStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Oppretter eller oppdaterer (idempotent på klientens ID). Andres ID-er gir konflikt. */
    @Transactional
    public MeasurementResponse save(UUID userId, UUID id, MeasurementRequest r) {
        Optional<UUID> owner = jdbc.sql("SELECT user_id FROM body_measurements WHERE id = :id")
                .param("id", id).query(UUID.class).optional();
        if (owner.isPresent() && !owner.get().equals(userId)) {
            throw new ConflictException("ID-en er allerede i bruk");
        }
        jdbc.sql("""
                        INSERT INTO body_measurements (id, user_id, kind, value, measured_at)
                        VALUES (:id, :u, :kind, :value, :at)
                        ON CONFLICT (id) DO UPDATE SET kind = excluded.kind, value = excluded.value, measured_at = excluded.measured_at
                        """)
                .param("id", id).param("u", userId).param("kind", r.kind().name()).param("value", r.value())
                .param("at", Timestamp.from(r.measuredAt())).update();
        return new MeasurementResponse(id, r.kind(), r.value(), r.measuredAt());
    }

    public List<MeasurementResponse> list(UUID userId) {
        return jdbc.sql("SELECT id, kind, value, measured_at FROM body_measurements WHERE user_id = :u ORDER BY measured_at DESC")
                .param("u", userId)
                .query((rs, n) -> new MeasurementResponse(
                        rs.getObject("id", UUID.class),
                        MeasurementKind.valueOf(rs.getString("kind")),
                        rs.getBigDecimal("value"),
                        rs.getTimestamp("measured_at").toInstant()))
                .list();
    }

    public void delete(UUID userId, UUID id) {
        jdbc.sql("DELETE FROM body_measurements WHERE id = :id AND user_id = :u").param("id", id).param("u", userId).update();
    }

    public SettingsDto settings(UUID userId) {
        return jdbc.sql("SELECT goal_weight_kg, weekly_goal, weight_unit FROM user_settings WHERE user_id = :u")
                .param("u", userId)
                .query((rs, n) -> new SettingsDto(rs.getBigDecimal("goal_weight_kg"), (Integer) rs.getObject("weekly_goal"), rs.getString("weight_unit")))
                .optional().orElse(new SettingsDto(null, null, "KG"));
    }

    public SettingsDto saveSettings(UUID userId, SettingsDto s) {
        String unit = s.weightUnit() == null ? "KG" : s.weightUnit();
        jdbc.sql("""
                        INSERT INTO user_settings (user_id, goal_weight_kg, weekly_goal, weight_unit, updated_at) VALUES (:u, :g, :w, :unit, now())
                        ON CONFLICT (user_id) DO UPDATE SET goal_weight_kg = excluded.goal_weight_kg, weekly_goal = excluded.weekly_goal,
                            weight_unit = excluded.weight_unit, updated_at = now()
                        """)
                .param("u", userId).param("g", s.goalWeightKg()).param("w", s.weeklyWorkoutGoal()).param("unit", unit).update();
        return new SettingsDto(s.goalWeightKg(), s.weeklyWorkoutGoal(), unit);
    }
}
