package no.fitnessapp.explore;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import no.fitnessapp.FitnessApplication;
import no.fitnessapp.TestcontainersConfiguration;
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
class ExploreApiIT {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    String firstPublicId() throws Exception {
        String json = mockMvc.perform(get("/api/explore/programs")).andReturn().getResponse().getContentAsString();
        return JsonPath.read(json, "$[?(@.name == 'Push / Pull / Legs')].id").toString().replaceAll("[\\[\\]\"]", "");
    }

    @Test
    void listsSeededPublicPrograms() throws Exception {
        String json = mockMvc.perform(get("/api/explore/programs")).andReturn().getResponse().getContentAsString();
        assertThat(JsonPath.<java.util.List<Object>>read(json, "$[?(@.authorName == 'Treningsapp')]")).hasSize(6);
        mockMvc.perform(get("/api/explore/programs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.name == 'Push / Pull / Legs')].routineCount").value(3))
                .andExpect(jsonPath("$[?(@.name == 'Push / Pull / Legs')].authorName").value("Treningsapp"))
                .andExpect(jsonPath("$[?(@.name == 'Push / Pull / Legs')].level").value("INTERMEDIATE"));
    }

    @Test
    void showsRoutinesOfPublicProgram() throws Exception {
        mockMvc.perform(get("/api/explore/programs/" + firstPublicId()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.routines.length()").value(3))
                .andExpect(jsonPath("$.routines[0].name").value("Push"))
                .andExpect(jsonPath("$.routines[0].exercises[0].exerciseName").value("Bench Press"))
                .andExpect(jsonPath("$.routines[0].exercises[0].sets.length()").value(4));
    }

    @Test
    void downloadCopiesProgramIdempotentlyAndCountsOnce() throws Exception {
        String sourceId = firstPublicId();
        int before = jdbc.sql("SELECT download_count FROM programs WHERE id = :id")
                .param("id", UUID.fromString(sourceId)).query(Integer.class).single();
        UUID copyId = UUID.randomUUID();
        String body = "{\"copyId\": \"" + copyId + "\"}";

        mockMvc.perform(post("/api/explore/programs/" + sourceId + "/download").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(copyId.toString()))
                .andExpect(jsonPath("$.visibility").value("PRIVATE"))
                .andExpect(jsonPath("$.sourceProgramId").value(sourceId))
                .andExpect(jsonPath("$.routines.length()").value(3));
        mockMvc.perform(post("/api/explore/programs/" + sourceId + "/download").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk());

        int after = jdbc.sql("SELECT download_count FROM programs WHERE id = :id")
                .param("id", UUID.fromString(sourceId)).query(Integer.class).single();
        assertThat(after).isEqualTo(before + 1);

        // Kopien er brukerens egen: den kan endres uten å påvirke originalen.
        mockMvc.perform(put("/api/programs/" + copyId).contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"Min PPL\"}"))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/explore/programs/" + sourceId)).andExpect(jsonPath("$.name").value("Push / Pull / Legs"));
    }

    @Test
    void privateProgramsAreNotInExplore() throws Exception {
        UUID own = UUID.randomUUID();
        mockMvc.perform(put("/api/programs/" + own).contentType(MediaType.APPLICATION_JSON).content("{\"name\": \"Hemmelig\"}"));
        mockMvc.perform(get("/api/explore/programs/" + own)).andExpect(status().isNotFound());
        mockMvc.perform(post("/api/explore/programs/" + own + "/download").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"copyId\": \"" + UUID.randomUUID() + "\"}"))
                .andExpect(status().isNotFound());
    }
}
