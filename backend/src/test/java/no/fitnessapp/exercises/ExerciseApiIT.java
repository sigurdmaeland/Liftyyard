package no.fitnessapp.exercises;

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

@SpringBootTest(classes = FitnessApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Import(TestcontainersConfiguration.class)
class ExerciseApiIT {

    static final String BENCH = "01960000-0000-7000-8000-000000000001";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @BeforeEach
    void clean() {
        jdbc.sql("DELETE FROM exercise_favorites").update();
        jdbc.sql("DELETE FROM exercises WHERE owner_user_id IS NOT NULL").update();
    }

    @Test
    void listsSeededCatalogSortedByNameWithMuscles() throws Exception {
        mockMvc.perform(get("/api/exercises"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(40))
                .andExpect(jsonPath("$[0].name").value("Assisted Pull-Up"))
                .andExpect(jsonPath("$[?(@.name == 'Bench Press')].exerciseType").value("WEIGHT_REPS"))
                .andExpect(jsonPath("$[?(@.name == 'Bench Press')].primaryMuscles[0]").value("CHEST"))
                .andExpect(jsonPath("$[?(@.name == 'Bench Press')].custom").value(false));
    }

    @Test
    void createsUpdatesAndArchivesCustomExercise() throws Exception {
        UUID id = UUID.randomUUID();
        String body = """
                {"name": "Landmine Press", "exerciseType": "WEIGHT_REPS", "equipment": "BARBELL",
                 "instructions": "Stå skrått", "primaryMuscles": ["SHOULDERS"], "secondaryMuscles": ["TRICEPS", "CHEST"]}
                """;
        mockMvc.perform(put("/api/exercises/" + id).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.custom").value(true))
                .andExpect(jsonPath("$.secondaryMuscles.length()").value(2));
        mockMvc.perform(put("/api/exercises/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content(body.replace("Landmine Press", "Landmine Press (stående)")))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("Landmine Press (stående)"));
        mockMvc.perform(get("/api/exercises")).andExpect(jsonPath("$.length()").value(41));

        mockMvc.perform(delete("/api/exercises/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/exercises")).andExpect(jsonPath("$.length()").value(40));
    }

    @Test
    void catalogExercisesCannotBeChangedAndMusclesCannotOverlap() throws Exception {
        mockMvc.perform(put("/api/exercises/" + BENCH).contentType(MediaType.APPLICATION_JSON).content("""
                {"name": "Hack", "exerciseType": "WEIGHT_REPS", "equipment": "BARBELL", "primaryMuscles": [], "secondaryMuscles": []}
                """)).andExpect(status().isConflict());
        mockMvc.perform(put("/api/exercises/" + UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON).content("""
                {"name": "X", "exerciseType": "WEIGHT_REPS", "equipment": "OTHER", "primaryMuscles": ["CHEST"], "secondaryMuscles": ["CHEST"]}
                """)).andExpect(status().isBadRequest());
    }

    @Test
    void favoritesAreIdempotent() throws Exception {
        mockMvc.perform(put("/api/exercises/" + BENCH + "/favorite")).andExpect(status().isNoContent());
        mockMvc.perform(put("/api/exercises/" + BENCH + "/favorite")).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/exercises"))
                .andExpect(jsonPath("$[?(@.name == 'Bench Press')].favorite").value(true));
        mockMvc.perform(delete("/api/exercises/" + BENCH + "/favorite")).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/exercises"))
                .andExpect(jsonPath("$[?(@.name == 'Bench Press')].favorite").value(false));
        mockMvc.perform(put("/api/exercises/" + UUID.randomUUID() + "/favorite")).andExpect(status().isNotFound());
    }
}
