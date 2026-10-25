package no.fitnessapp.users;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class ProfileApiIT {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @Test
    void updatesAndReadsProfile() throws Exception {
        mockMvc.perform(put("/api/me").contentType(MediaType.APPLICATION_JSON).content("""
                        {"firstName": " Ola ", "lastName": "Nordmann", "bio": "", "birthDate": "1998-04-12",
                         "gender": "MALE", "instagram": "ola.lofter", "website": "https://ola.no"}
                        """))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value("Ola"))
                .andExpect(jsonPath("$.bio").doesNotExist());
        mockMvc.perform(get("/api/me"))
                .andExpect(jsonPath("$.lastName").value("Nordmann"))
                .andExpect(jsonPath("$.birthDate").value("1998-04-12"))
                .andExpect(jsonPath("$.instagram").value("ola.lofter"));
        String display = jdbc.sql("SELECT display_name FROM users WHERE id = '00000000-0000-7000-8000-000000000001'")
                .query(String.class).single();
        org.assertj.core.api.Assertions.assertThat(display).isEqualTo("Ola Nordmann");
    }

    @Test
    void rejectsInvalidProfile() throws Exception {
        mockMvc.perform(put("/api/me").contentType(MediaType.APPLICATION_JSON).content("{\"firstName\": \"  \"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/me").contentType(MediaType.APPLICATION_JSON).content("{\"firstName\": \"A\", \"instagram\": \"@a b\"}"))
                .andExpect(status().isBadRequest());
        mockMvc.perform(put("/api/me").contentType(MediaType.APPLICATION_JSON).content("{\"firstName\": \"A\", \"gender\": \"X\"}"))
                .andExpect(status().isBadRequest());
    }
}
