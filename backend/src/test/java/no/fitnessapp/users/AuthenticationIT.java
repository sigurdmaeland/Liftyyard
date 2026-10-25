package no.fitnessapp.users;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import no.fitnessapp.FitnessApplication;
import no.fitnessapp.TestcontainersConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.test.web.servlet.MockMvc;

/** Uten local-profil finnes ingen dev-bruker: alle brukerdata skal avvises. */
@SpringBootTest(classes = FitnessApplication.class)
@AutoConfigureMockMvc
@Import(TestcontainersConfiguration.class)
class AuthenticationIT {

    @Autowired
    MockMvc mockMvc;

    @Test
    void userDataRequiresAuthentication() throws Exception {
        mockMvc.perform(get("/api/workouts")).andExpect(status().isUnauthorized());
        mockMvc.perform(get("/api/exercises")).andExpect(status().isUnauthorized());
    }

    @Test
    void healthIsPublic() throws Exception {
        mockMvc.perform(get("/api/health")).andExpect(status().isOk());
    }
}
