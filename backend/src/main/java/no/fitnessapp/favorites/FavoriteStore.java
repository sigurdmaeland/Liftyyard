package no.fitnessapp.favorites;

import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Repository;

/** Favoritter er enkle koblingstabeller; JdbcClient holder koden kort. Alle operasjoner er idempotente. */
@Repository
public class FavoriteStore {

    private final JdbcClient jdbc;

    public FavoriteStore(JdbcClient jdbc) {
        this.jdbc = jdbc;
    }

    public void addRoutine(UUID userId, UUID routineId) {
        jdbc.sql("INSERT INTO routine_favorites (user_id, routine_id) VALUES (:u, :r) ON CONFLICT DO NOTHING")
                .param("u", userId).param("r", routineId).update();
    }

    public void removeRoutine(UUID userId, UUID routineId) {
        jdbc.sql("DELETE FROM routine_favorites WHERE user_id = :u AND routine_id = :r")
                .param("u", userId).param("r", routineId).update();
    }

    public void addExercise(UUID userId, UUID exerciseId) {
        jdbc.sql("INSERT INTO exercise_favorites (user_id, exercise_id) VALUES (:u, :e) ON CONFLICT DO NOTHING")
                .param("u", userId).param("e", exerciseId).update();
    }

    public void removeExercise(UUID userId, UUID exerciseId) {
        jdbc.sql("DELETE FROM exercise_favorites WHERE user_id = :u AND exercise_id = :e")
                .param("u", userId).param("e", exerciseId).update();
    }

    public Set<UUID> routineIds(UUID userId) {
        return jdbc.sql("SELECT routine_id FROM routine_favorites WHERE user_id = :u")
                .param("u", userId).query(UUID.class).list().stream().collect(Collectors.toSet());
    }

    public Set<UUID> exerciseIds(UUID userId) {
        return jdbc.sql("SELECT exercise_id FROM exercise_favorites WHERE user_id = :u")
                .param("u", userId).query(UUID.class).list().stream().collect(Collectors.toSet());
    }
}
