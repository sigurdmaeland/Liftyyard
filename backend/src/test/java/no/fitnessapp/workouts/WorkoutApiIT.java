package no.fitnessapp.workouts;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.util.UUID;
import no.fitnessapp.FitnessApplication;
import no.fitnessapp.TestcontainersConfiguration;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

@SpringBootTest(classes = FitnessApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Import(TestcontainersConfiguration.class)
class WorkoutApiIT {

    static final String BENCH = "01960000-0000-7000-8000-000000000001";
    static final String SQUAT = "01960000-0000-7000-8000-000000000027";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @BeforeEach
    void clean() {
        jdbc.sql("DELETE FROM workouts").update();
    }

    /** Økt med benk (oppvarming + 2 arbeidssett, hvorav ett ikke fullført) og knebøy (1 sett). */
    static String workoutJson(String name, String startedAt, String endedAt, UUID[] ids) {
        return """
                {
                  "name": "%s",
                  "description": "Tung, men bra",
                  "notes": "Bra dag",
                  "perceivedEffort": 8,
                  "sourceRoutineId": "0196aaaa-0000-7000-8000-000000000001",
                  "startedAt": "%s",
                  "endedAt": "%s",
                  "exercises": [
                    { "id": "%s", "exerciseId": "%s", "sets": [
                      { "id": "%s", "setType": "WARMUP", "weightKg": 40, "reps": 10, "completedAt": "2026-10-20T10:01:00Z" },
                      { "id": "%s", "weightKg": 80, "reps": 8, "rpe": 8.5, "completedAt": "2026-10-20T10:05:00Z" },
                      { "id": "%s", "weightKg": 80, "reps": 6 }
                    ]},
                    { "id": "%s", "exerciseId": "%s", "sets": [
                      { "id": "%s", "setType": "FAILURE", "weightKg": 100, "reps": 5, "completedAt": "2026-10-20T10:20:00Z" }
                    ]}
                  ]
                }
                """.formatted(name, startedAt, endedAt, ids[0], BENCH, ids[1], ids[2], ids[3], ids[4], SQUAT, ids[5]);
    }

    static UUID[] newIds() {
        UUID[] ids = new UUID[6];
        for (int i = 0; i < ids.length; i++) {
            ids[i] = UUID.randomUUID();
        }
        return ids;
    }

    ResultActions putWorkout(UUID id, String body) throws Exception {
        return mockMvc.perform(put("/api/workouts/" + id).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    @Test
    void createsWorkoutWithSnapshotAndTotals() throws Exception {
        UUID id = UUID.randomUUID();
        putWorkout(id, workoutJson("Push", "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z", newIds()))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(id.toString()))
                .andExpect(jsonPath("$.exercises[0].exerciseName").value("Bench Press"))
                .andExpect(jsonPath("$.exercises[0].sets.length()").value(3))
                .andExpect(jsonPath("$.exercises[0].sets[0].setType").value("WARMUP"))
                .andExpect(jsonPath("$.exercises[0].sets[1].setType").value("NORMAL"))
                .andExpect(jsonPath("$.exercises[1].exerciseName").value("Back Squat"))
                .andExpect(jsonPath("$.totals.exerciseCount").value(2))
                .andExpect(jsonPath("$.totals.completedSetCount").value(3))
                // 80*8 + 100*5 = 1140. Oppvarming og ufullført sett telles ikke.
                .andExpect(jsonPath("$.totals.volumeKg").value(1140.0));

        mockMvc.perform(get("/api/workouts/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Push"))
                .andExpect(jsonPath("$.description").value("Tung, men bra"))
                .andExpect(jsonPath("$.notes").value("Bra dag"))
                .andExpect(jsonPath("$.perceivedEffort").value(8))
                .andExpect(jsonPath("$.sourceRoutineId").value("0196aaaa-0000-7000-8000-000000000001"))
                .andExpect(jsonPath("$.exercises[0].sets[1].rpe").value(8.5));
    }

    @Test
    void repeatingTheSameRequestIsIdempotent() throws Exception {
        UUID id = UUID.randomUUID();
        String body = workoutJson("Push", "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z", newIds());
        putWorkout(id, body).andExpect(status().isCreated());
        putWorkout(id, body).andExpect(status().isOk());

        assertThat(count("workouts")).isEqualTo(1);
        assertThat(count("workout_exercises")).isEqualTo(2);
        assertThat(count("workout_sets")).isEqualTo(4);
    }

    @Test
    void secondPutReplacesContentButKeepsCreatedAt() throws Exception {
        UUID id = UUID.randomUUID();
        String created = putWorkout(id, workoutJson("Push", "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z", newIds()))
                .andReturn().getResponse().getContentAsString();
        String createdAt = com.jayway.jsonpath.JsonPath.read(created, "$.createdAt");

        putWorkout(id, """
                {"name": "Push (endret)", "startedAt": "2026-10-20T10:00:00Z", "endedAt": "2026-10-20T11:00:00Z",
                 "exercises": [{"id": "%s", "exerciseId": "%s", "sets": []}]}
                """.formatted(UUID.randomUUID(), BENCH))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Push (endret)"))
                .andExpect(jsonPath("$.exercises.length()").value(1))
                .andExpect(jsonPath("$.createdAt").value(createdAt));

        assertThat(count("workout_sets")).isZero();
    }

    @Test
    void historyIsNotChangedWhenLibraryExerciseIsRenamed() throws Exception {
        UUID id = UUID.randomUUID();
        putWorkout(id, workoutJson("Push", "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z", newIds()))
                .andExpect(status().isCreated());
        try {
            jdbc.sql("UPDATE exercises SET name = 'Flat Bench' WHERE id = :id").param("id", UUID.fromString(BENCH)).update();
            mockMvc.perform(get("/api/workouts/" + id))
                    .andExpect(jsonPath("$.exercises[0].exerciseName").value("Bench Press"));
        } finally {
            jdbc.sql("UPDATE exercises SET name = 'Bench Press' WHERE id = :id").param("id", UUID.fromString(BENCH)).update();
        }
    }

    @Test
    void listsHistoryNewestFirstWithPagination() throws Exception {
        putWorkout(UUID.randomUUID(), workoutJson("Eldst", "2026-10-01T10:00:00Z", "2026-10-01T11:00:00Z", newIds()));
        putWorkout(UUID.randomUUID(), workoutJson("Nyest", "2026-10-03T10:00:00Z", "2026-10-03T11:00:00Z", newIds()));
        putWorkout(UUID.randomUUID(), workoutJson("Midt", "2026-10-02T10:00:00Z", "2026-10-02T11:00:00Z", newIds()));

        mockMvc.perform(get("/api/workouts").param("size", "2"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.items.length()").value(2))
                .andExpect(jsonPath("$.items[0].name").value("Nyest"))
                .andExpect(jsonPath("$.items[1].name").value("Midt"))
                .andExpect(jsonPath("$.items[0].totals.volumeKg").value(1140.0))
                .andExpect(jsonPath("$.totalItems").value(3))
                .andExpect(jsonPath("$.totalPages").value(2));
    }

    @Test
    void rejectsInvalidData() throws Exception {
        putWorkout(UUID.randomUUID(), workoutJson("Push", "2026-10-20T11:00:00Z", "2026-10-20T10:00:00Z", newIds()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.errors").isArray());

        putWorkout(UUID.randomUUID(), """
                {"name": "X", "startedAt": "2026-10-20T10:00:00Z", "endedAt": "2026-10-20T11:00:00Z",
                 "exercises": [{"id": "%s", "exerciseId": "%s", "sets": [{"id": "%s", "reps": -1}]}]}
                """.formatted(UUID.randomUUID(), BENCH, UUID.randomUUID()))
                .andExpect(status().isBadRequest());

        putWorkout(UUID.randomUUID(), """
                {"name": "X", "perceivedEffort": 11, "startedAt": "2026-10-20T10:00:00Z", "endedAt": "2026-10-20T11:00:00Z",
                 "exercises": []}
                """)
                .andExpect(status().isBadRequest());

        putWorkout(UUID.randomUUID(), """
                {"name": "X", "startedAt": "2026-10-20T10:00:00Z", "endedAt": "2026-10-20T11:00:00Z",
                 "exercises": [{"id": "%s", "exerciseId": "%s", "sets": []}]}
                """.formatted(UUID.randomUUID(), UUID.randomUUID()))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.detail").value(org.hamcrest.Matchers.startsWith("Ukjent øvelse")));

        assertThat(count("workouts")).isZero();
    }

    @Test
    void workoutOwnedByAnotherUserIsInvisibleAndCannotBeOverwritten() throws Exception {
        UUID otherUser = UUID.randomUUID();
        UUID foreignWorkout = UUID.randomUUID();
        jdbc.sql("INSERT INTO users (id, display_name) VALUES (:id, 'Annen')").param("id", otherUser).update();
        jdbc.sql("""
                INSERT INTO workouts (id, user_id, name, started_at, ended_at)
                VALUES (:id, :user, 'Privat', now() - interval '1 hour', now())
                """).param("id", foreignWorkout).param("user", otherUser).update();

        mockMvc.perform(get("/api/workouts/" + foreignWorkout)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/workouts")).andExpect(jsonPath("$.totalItems").value(0));
        putWorkout(foreignWorkout, workoutJson("Kapring", "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z", newIds()))
                .andExpect(status().isConflict());
        mockMvc.perform(delete("/api/workouts/" + foreignWorkout)).andExpect(status().isNoContent());

        assertThat(jdbc.sql("SELECT name FROM workouts WHERE id = :id").param("id", foreignWorkout)
                .query(String.class).single()).isEqualTo("Privat");
    }

    @Test
    void deleteIsIdempotent() throws Exception {
        UUID id = UUID.randomUUID();
        putWorkout(id, workoutJson("Push", "2026-10-20T10:00:00Z", "2026-10-20T11:00:00Z", newIds()));
        mockMvc.perform(delete("/api/workouts/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/workouts/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/workouts/" + id)).andExpect(status().isNotFound());
        assertThat(count("workout_sets")).isZero();
    }

    private long count(String table) {
        return jdbc.sql("SELECT count(*) FROM " + table).query(Long.class).single();
    }
}
