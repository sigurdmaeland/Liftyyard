package no.fitnessapp.programs;

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

/** Programmer og rutiner (rutiner er egne aggregater som kan ligge i et program eller stå alene). */
@SpringBootTest(classes = FitnessApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Import(TestcontainersConfiguration.class)
class ProgramApiIT {

    static final String BENCH = "01960000-0000-7000-8000-000000000001";
    static final String SQUAT = "01960000-0000-7000-8000-000000000027";
    static final UUID SYSTEM = UUID.fromString("00000000-0000-7000-8000-0000000000aa");

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @BeforeEach
    void clean() {
        // Behold appens egne offentlige programmer (systemkontoen).
        jdbc.sql("DELETE FROM routines WHERE owner_user_id <> :sys").param("sys", SYSTEM).update();
        jdbc.sql("DELETE FROM programs WHERE owner_user_id <> :sys").param("sys", SYSTEM).update();
    }

    static UUID id() {
        return UUID.randomUUID();
    }

    ResultActions putJson(String path, String body) throws Exception {
        return mockMvc.perform(put(path).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    /** Push: benk 3 × 8 @ 80 kg, med oppvarming. */
    static String routineJson(UUID programId, int position, String name) {
        return """
                {
                  "programId": %s,
                  "position": %d,
                  "name": "%s",
                  "exercises": [
                    { "id": "%s", "exerciseId": "%s", "restSeconds": 120, "sets": [
                      { "id": "%s", "setType": "WARMUP", "targetReps": 10, "targetWeightKg": 40 },
                      { "id": "%s", "targetReps": 8, "targetWeightKg": 80 },
                      { "id": "%s", "targetReps": 8, "targetWeightKg": 80 }
                    ]}
                  ]
                }
                """.formatted(programId == null ? "null" : "\"" + programId + "\"", position, name, id(), BENCH, id(), id(), id());
    }

    @Test
    void createsProgramAndRoutinesInOrder() throws Exception {
        UUID program = id();
        putJson("/api/programs/" + program, """
                {"name": "PPL", "description": "Push, pull, legs"}
                """).andExpect(status().isCreated())
                .andExpect(jsonPath("$.visibility").value("PRIVATE"))
                .andExpect(jsonPath("$.routines.length()").value(0));

        putJson("/api/routines/" + id(), routineJson(program, 1, "Legs")).andExpect(status().isCreated());
        putJson("/api/routines/" + id(), routineJson(program, 0, "Push"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.exercises[0].exerciseName").value("Bench Press"))
                .andExpect(jsonPath("$.exercises[0].sets.length()").value(3))
                .andExpect(jsonPath("$.exercises[0].sets[0].setType").value("WARMUP"))
                .andExpect(jsonPath("$.favorite").value(false));

        mockMvc.perform(get("/api/programs/" + program))
                .andExpect(jsonPath("$.routines[0].name").value("Push"))
                .andExpect(jsonPath("$.routines[1].name").value("Legs"));
        mockMvc.perform(get("/api/programs"))
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].routineCount").value(2));
    }

    @Test
    void standaloneRoutinesAndFavorites() throws Exception {
        UUID routine = id();
        putJson("/api/routines/" + routine, routineJson(null, 0, "Hjemmeøkt"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.programId").doesNotExist());

        mockMvc.perform(put("/api/routines/" + routine + "/favorite")).andExpect(status().isNoContent());
        mockMvc.perform(put("/api/routines/" + routine + "/favorite")).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/routines/" + routine)).andExpect(jsonPath("$.favorite").value(true));

        // Lagring av rutinen på nytt (erstatning) skal ikke miste favoritten.
        putJson("/api/routines/" + routine, routineJson(null, 0, "Hjemmeøkt 2")).andExpect(status().isOk());
        mockMvc.perform(get("/api/routines")).andExpect(jsonPath("$[0].favorite").value(true));

        mockMvc.perform(delete("/api/routines/" + routine + "/favorite")).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/routines/" + routine)).andExpect(jsonPath("$.favorite").value(false));
    }

    @Test
    void routineSaveIsIdempotent() throws Exception {
        UUID routine = id();
        String body = routineJson(null, 0, "A");
        putJson("/api/routines/" + routine, body).andExpect(status().isCreated());
        putJson("/api/routines/" + routine, body).andExpect(status().isOk());
        assertThat(countOwn("routines")).isEqualTo(1);
        assertThat(countOwnSets()).isEqualTo(3);
    }

    @Test
    void rejectsInvalidData() throws Exception {
        putJson("/api/programs/" + id(), """
                {"name": ""}
                """).andExpect(status().isBadRequest());
        putJson("/api/routines/" + id(), routineJson(id(), 0, "Ukjent program")).andExpect(status().isBadRequest());
        putJson("/api/routines/" + id(), """
                {"name": "X", "exercises": [{"id": "%s", "exerciseId": "%s", "sets": []}]}
                """.formatted(id(), id())).andExpect(status().isBadRequest());
        assertThat(countOwn("routines")).isZero();
    }

    @Test
    void otherUsersDataIsInvisibleAndProtected() throws Exception {
        UUID other = id();
        UUID foreignProgram = id();
        UUID foreignRoutine = id();
        jdbc.sql("INSERT INTO users (id, display_name) VALUES (:id, 'Annen')").param("id", other).update();
        jdbc.sql("INSERT INTO programs (id, owner_user_id, name) VALUES (:id, :o, 'Privat')")
                .param("id", foreignProgram).param("o", other).update();
        jdbc.sql("INSERT INTO routines (id, owner_user_id, position, name) VALUES (:id, :o, 0, 'Privat')")
                .param("id", foreignRoutine).param("o", other).update();

        mockMvc.perform(get("/api/programs/" + foreignProgram)).andExpect(status().isNotFound());
        mockMvc.perform(get("/api/routines/" + foreignRoutine)).andExpect(status().isNotFound());
        putJson("/api/programs/" + foreignProgram, "{\"name\": \"Kapring\"}").andExpect(status().isConflict());
        putJson("/api/routines/" + foreignRoutine, routineJson(null, 0, "Kapring")).andExpect(status().isConflict());
        putJson("/api/routines/" + id(), routineJson(foreignProgram, 0, "Snik")).andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/routines/" + foreignRoutine + "/favorite")).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/routines/" + foreignRoutine)).andExpect(status().isNoContent());
        assertThat(countOwn("routines")).isEqualTo(1);
    }

    @Test
    void deletingProgramDeletesItsRoutines() throws Exception {
        UUID program = id();
        putJson("/api/programs/" + program, "{\"name\": \"PPL\"}");
        putJson("/api/routines/" + id(), routineJson(program, 0, "Push"));
        putJson("/api/routines/" + id(), routineJson(null, 0, "Frittstående"));
        mockMvc.perform(delete("/api/programs/" + program)).andExpect(status().isNoContent());
        assertThat(countOwn("routines")).isEqualTo(1);
    }

    /** Antall rader som ikke tilhører systemkontoen (appens egne programmer). */
    private long countOwn(String table) {
        return jdbc.sql("SELECT count(*) FROM " + table + " WHERE owner_user_id <> :sys").param("sys", SYSTEM).query(Long.class).single();
    }

    private long countOwnSets() {
        return jdbc.sql("""
                SELECT count(*) FROM routine_sets s
                JOIN routine_exercises e ON e.id = s.routine_exercise_id
                JOIN routines r ON r.id = e.routine_id WHERE r.owner_user_id <> :sys
                """).param("sys", SYSTEM).query(Long.class).single();
    }
}
