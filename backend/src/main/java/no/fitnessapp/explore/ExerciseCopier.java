package no.fitnessapp.explore;

import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.UnaryOperator;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Når noen laster ned et program eller en rutine som bruker forfatterens egne øvelser, får
 * mottakeren sin egen kopi av øvelsene (med muskler), slik at rutinen kan brukes og redigeres.
 * Har mottakeren allerede en egen øvelse med samme navn, brukes den i stedet.
 */
@Component
class ExerciseCopier {

    private final JdbcClient jdbc;

    ExerciseCopier(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    record Custom(UUID id, String name, String exerciseType, String equipment, String instructions) {}

    /** Oversettelse fra forfatterens øvelses-ID-er til mottakerens. Katalogøvelser beholdes. */
    UnaryOperator<UUID> copyFor(UUID author, UUID recipient, Collection<UUID> exerciseIds) {
        if (author.equals(recipient) || exerciseIds.isEmpty()) return UnaryOperator.identity();
        Map<UUID, UUID> mapping = new HashMap<>();
        var custom = jdbc.sql("""
                        SELECT id, name, exercise_type, equipment, instructions FROM exercises
                        WHERE id IN (:ids) AND owner_user_id = :author
                        """)
                .param("ids", exerciseIds).param("author", author)
                .query((rs, i) -> new Custom(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("exercise_type"),
                        rs.getString("equipment"), rs.getString("instructions")))
                .list();
        for (Custom c : custom) {
            UUID existing = jdbc.sql("SELECT id FROM exercises WHERE owner_user_id = :r AND lower(name) = lower(:n)")
                    .param("r", recipient).param("n", c.name())
                    .query(UUID.class).optional().orElse(null);
            if (existing != null) {
                // Gjenopprett en arkivert øvelse med samme navn i stedet for å lage en ny.
                jdbc.sql("UPDATE exercises SET archived_at = NULL, updated_at = now() WHERE id = :id AND archived_at IS NOT NULL")
                        .param("id", existing).update();
                mapping.put(c.id(), existing);
                continue;
            }
            UUID copy = UUID.randomUUID();
            jdbc.sql("""
                            INSERT INTO exercises (id, owner_user_id, name, exercise_type, equipment, instructions)
                            VALUES (:id, :r, :n, :t, :e, :i)
                            """)
                    .param("id", copy).param("r", recipient).param("n", c.name()).param("t", c.exerciseType())
                    .param("e", c.equipment()).param("i", c.instructions())
                    .update();
            jdbc.sql("INSERT INTO exercise_muscles (exercise_id, muscle, role) SELECT :copy, muscle, role FROM exercise_muscles WHERE exercise_id = :src")
                    .param("copy", copy).param("src", c.id()).update();
            mapping.put(c.id(), copy);
        }
        return id -> mapping.getOrDefault(id, id);
    }
}
