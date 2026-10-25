package no.fitnessapp.measurements;

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
class MeasurementApiIT {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @BeforeEach
    void clean() {
        jdbc.sql("DELETE FROM body_measurements").update();
        jdbc.sql("DELETE FROM user_settings").update();
    }

    @Test
    void savesListsAndDeletesMeasurementsIdempotently() throws Exception {
        UUID id = UUID.randomUUID();
        String body = """
                {"kind": "WEIGHT", "value": 82.4, "measuredAt": "2026-10-20T07:00:00Z"}
                """;
        mockMvc.perform(put("/api/measurements/" + id).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        mockMvc.perform(put("/api/measurements/" + id).contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isOk());
        mockMvc.perform(put("/api/measurements/" + UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON).content("""
                {"kind": "WAIST", "value": 84, "measuredAt": "2026-10-21T07:00:00Z"}
                """)).andExpect(status().isOk());

        mockMvc.perform(get("/api/measurements"))
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].kind").value("WAIST"))
                .andExpect(jsonPath("$[1].value").value(82.4));

        mockMvc.perform(delete("/api/measurements/" + id)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/measurements")).andExpect(jsonPath("$.length()").value(1));
    }

    @Test
    void rejectsInvalidMeasurements() throws Exception {
        mockMvc.perform(put("/api/measurements/" + UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON).content("""
                {"kind": "WEIGHT", "value": 0, "measuredAt": "2026-10-20T07:00:00Z"}
                """)).andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/measurements/" + UUID.randomUUID()).contentType(MediaType.APPLICATION_JSON).content("""
                {"kind": "SHOE_SIZE", "value": 44, "measuredAt": "2026-10-20T07:00:00Z"}
                """)).andExpect(status().isBadRequest());
    }

    @Test
    void savesGoalWeight() throws Exception {
        mockMvc.perform(get("/api/settings")).andExpect(jsonPath("$.goalWeightKg").doesNotExist());
        mockMvc.perform(put("/api/settings").contentType(MediaType.APPLICATION_JSON).content("{\"goalWeightKg\": 78.5}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/settings")).andExpect(jsonPath("$.goalWeightKg").value(78.5));
    }
}
