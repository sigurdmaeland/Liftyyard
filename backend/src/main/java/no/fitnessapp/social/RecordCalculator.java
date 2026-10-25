package no.fitnessapp.social;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/**
 * Rekorder (medaljer) per sett, samme regel som i appen (mobile/src/lib/records.ts):
 * estimert 1RM (Epley), tyngste vekt og største settvolum per øvelse. Et sett får medalje når
 * verdien er ny og blant de tre beste for forfatteren noen gang (1 = gull, 2 = sølv, 3 = bronse).
 * Første gang en øvelse logges gir ingen medaljer.
 */
@Component
public class RecordCalculator {

    public record SetRecord(String kind, int medal) {}

    private static final String[] KINDS = {"E1RM", "WEIGHT", "VOLUME"};

    private final JdbcClient jdbc;

    public RecordCalculator(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    private record Row(UUID workoutId, UUID userId, UUID exerciseId, UUID setId, double weight, int reps) {}

    /** Økt-ID → sett-ID → rekorder, for de gitte øktene. */
    public Map<UUID, Map<UUID, List<SetRecord>>> forWorkouts(List<UUID> workoutIds) {
        Map<UUID, Map<UUID, List<SetRecord>>> result = new HashMap<>();
        if (workoutIds.isEmpty()) return result;
        Set<UUID> wanted = new HashSet<>(workoutIds);
        // Alle fullførte arbeidssett for forfatterne og øvelsene i disse øktene, til og med den nyeste av dem.
        List<Row> rows = jdbc.sql("""
                        WITH target AS (
                            SELECT w.user_id, we.exercise_id, max(w.started_at) AS until
                            FROM workouts w JOIN workout_exercises we ON we.workout_id = w.id
                            WHERE w.id IN (:ids) AND we.exercise_id IS NOT NULL
                            GROUP BY w.user_id, we.exercise_id
                        )
                        SELECT w.id AS workout_id, w.user_id, we.exercise_id, s.id AS set_id, s.weight_kg, s.reps
                        FROM target t
                        JOIN workouts w ON w.user_id = t.user_id AND w.started_at <= t.until
                        JOIN workout_exercises we ON we.workout_id = w.id AND we.exercise_id = t.exercise_id
                        JOIN workout_sets s ON s.workout_exercise_id = we.id
                        WHERE s.completed_at IS NOT NULL AND s.set_type <> 'WARMUP' AND s.weight_kg > 0 AND s.reps > 0
                        ORDER BY w.user_id, we.exercise_id, w.started_at, w.id, we.position, s.position
                        """)
                .param("ids", workoutIds)
                .query((rs, n) -> new Row(rs.getObject("workout_id", UUID.class), rs.getObject("user_id", UUID.class),
                        rs.getObject("exercise_id", UUID.class), rs.getObject("set_id", UUID.class), rs.getDouble("weight_kg"), rs.getInt("reps")))
                .list();

        // Gruppér per forfatter og øvelse (radene er allerede sortert kronologisk).
        Map<String, List<Row>> groups = new LinkedHashMap<>();
        for (Row r : rows) groups.computeIfAbsent(r.userId() + ":" + r.exerciseId(), k -> new ArrayList<>()).add(r);

        for (List<Row> group : groups.values()) {
            Map<String, List<Double>> best = new HashMap<>();
            for (String k : KINDS) best.put(k, new ArrayList<>());
            UUID firstWorkout = group.get(0).workoutId();
            for (Row r : group) {
                boolean hasHistory = !r.workoutId().equals(firstWorkout);
                double e1rm = r.reps() == 1 ? r.weight() : r.weight() * (1 + r.reps() / 30.0);
                Map<String, Double> values = Map.of("E1RM", e1rm, "WEIGHT", r.weight(), "VOLUME", r.weight() * r.reps());
                List<SetRecord> found = new ArrayList<>();
                for (String kind : KINDS) {
                    double v = values.get(kind);
                    List<Double> previous = best.get(kind);
                    boolean isNew = previous.stream().noneMatch(p -> Math.abs(p - v) < 1e-9);
                    int rank = 1 + (int) previous.stream().filter(p -> p > v + 1e-9).count();
                    if (hasHistory && isNew && rank <= 3) found.add(new SetRecord(kind, rank));
                    if (isNew) {
                        previous.add(v);
                        previous.sort((a, b) -> Double.compare(b, a));
                        if (previous.size() > 3) previous.remove(3);
                    }
                }
                if (!found.isEmpty() && wanted.contains(r.workoutId())) {
                    result.computeIfAbsent(r.workoutId(), k -> new HashMap<>()).put(r.setId(), found);
                }
            }
        }
        return result;
    }

    /** Antall medaljer og hvilke farger (1–3) en økt har. */
    public static Summary summary(Map<UUID, List<SetRecord>> sets) {
        if (sets == null) return new Summary(0, List.of());
        int count = 0;
        Set<Integer> medals = new java.util.TreeSet<>();
        for (List<SetRecord> list : sets.values()) {
            count += list.size();
            for (SetRecord r : list) medals.add(r.medal());
        }
        return new Summary(count, List.copyOf(medals));
    }

    public record Summary(int count, List<Integer> medals) {}
}
