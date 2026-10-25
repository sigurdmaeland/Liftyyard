package no.fitnessapp.social;

import java.util.UUID;
import no.fitnessapp.common.NotFoundException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Hvem kan se en økt:
 * - eieren alltid
 * - PUBLIC: alle som kan se profilen (offentlig profil, eller godtatt følger av privat profil)
 * - FOLLOWERS: godtatte følgere
 * - PRIVATE: bare eieren
 * - aldri hvis en av dem har blokkert den andre, eller eieren er sperret
 * Økter man ikke kan se, behandles som om de ikke finnes (404), for ikke å lekke at de finnes.
 */
@Component
public class WorkoutAccess {

    /** SQL-betingelse for at :viewer kan se økten w (med eier u). */
    public static final String VISIBLE = "(" + Blocks.visibleUser("w.user_id") + " AND " + """
            (w.user_id = :viewer
             OR (w.visibility = 'PUBLIC' AND u.visibility = 'PUBLIC')
             OR (w.visibility IN ('PUBLIC', 'FOLLOWERS') AND EXISTS (
                   SELECT 1 FROM follows f WHERE f.follower_id = :viewer AND f.followee_id = w.user_id AND f.status = 'ACCEPTED'))))
            """;

    private final JdbcClient jdbc;

    public WorkoutAccess(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    /** Eieren av økten, hvis `viewer` kan se den. Ellers 404. */
    public UUID requireViewable(UUID viewer, UUID workoutId) {
        return jdbc.sql("SELECT w.user_id FROM workouts w JOIN users u ON u.id = w.user_id WHERE w.id = :id AND " + VISIBLE)
                .param("id", workoutId).param("viewer", viewer)
                .query(UUID.class).optional()
                .orElseThrow(() -> new NotFoundException("Fant ikke økten"));
    }

    /** Kan `viewer` se økten? (Brukes f.eks. før @omtale gir varsel.) */
    public boolean canView(UUID viewer, UUID workoutId) {
        return jdbc.sql("SELECT 1 FROM workouts w JOIN users u ON u.id = w.user_id WHERE w.id = :id AND " + VISIBLE)
                .param("id", workoutId).param("viewer", viewer)
                .query(Integer.class).optional().isPresent();
    }

    /** Eieren av økten, hvis det er `userId`. Ellers 404. */
    public void requireOwner(UUID userId, UUID workoutId) {
        jdbc.sql("SELECT 1 FROM workouts WHERE id = :id AND user_id = :u").param("id", workoutId).param("u", userId)
                .query(Integer.class).optional()
                .orElseThrow(() -> new NotFoundException("Fant ikke økten"));
    }
}
