package no.fitnessapp.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest(classes = FitnessApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Import({TestcontainersConfiguration.class, TestAuthConfiguration.class})
class AuthApiIT {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    TestAuthConfiguration.CapturingMailer mailer;

    record Session(String access, String refresh, String userId) {}

    private static String newEmail() {
        return "bruker-" + UUID.randomUUID() + "@example.com";
    }

    private Session loginWithEmail(String email) throws Exception {
        mockMvc.perform(post("/api/auth/email/start").contentType(MediaType.APPLICATION_JSON).content("{\"email\": \"" + email + "\"}"))
                .andExpect(status().isNoContent());
        String code = mailer.codes.get(email.toLowerCase());
        MvcResult r = mockMvc.perform(post("/api/auth/email/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"" + email + "\", \"code\": \"" + code + "\"}"))
                .andExpect(status().isOk())
                .andReturn();
        return session(r);
    }

    private static Session session(MvcResult r) throws Exception {
        String json = r.getResponse().getContentAsString();
        return new Session(JsonPath.read(json, "$.accessToken"), JsonPath.read(json, "$.refreshToken"), JsonPath.read(json, "$.userId"));
    }

    private static String bearer(Session s) {
        return "Bearer " + s.access();
    }

    @Test
    void emailLoginCreatesUserAndGivesAccess() throws Exception {
        String email = newEmail();
        Session s = loginWithEmail(email);
        mockMvc.perform(get("/api/me").header("Authorization", bearer(s)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.firstName").value(email.substring(0, email.indexOf('@'))));
        // Samme e-post igjen gir samme bruker.
        assertThat(loginWithEmail(email).userId()).isEqualTo(s.userId());
    }

    @Test
    void wrongCodeIsRejectedAndLimited() throws Exception {
        String email = newEmail();
        mockMvc.perform(post("/api/auth/email/start").contentType(MediaType.APPLICATION_JSON).content("{\"email\": \"" + email + "\"}"));
        String right = mailer.codes.get(email);
        String wrong = right.equals("000000") ? "111111" : "000000";
        for (int i = 0; i < EmailCodeService.MAX_ATTEMPTS; i++) {
            mockMvc.perform(post("/api/auth/email/verify").contentType(MediaType.APPLICATION_JSON)
                            .content("{\"email\": \"" + email + "\", \"code\": \"" + wrong + "\"}"))
                    .andExpect(status().isBadRequest());
        }
        // Etter for mange feil hjelper ikke riktig kode heller.
        mockMvc.perform(post("/api/auth/email/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"" + email + "\", \"code\": \"" + right + "\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void refreshRotatesAndReuseRevokesSession() throws Exception {
        Session s = loginWithEmail(newEmail());
        String body1 = "{\"refreshToken\": \"" + s.refresh() + "\"}";
        Session s2 = session(mockMvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(body1))
                .andExpect(status().isOk()).andReturn());
        assertThat(s2.refresh()).isNotEqualTo(s.refresh());
        // Gjenbruk av det gamle tokenet: avvises, og hele økten trekkes tilbake.
        mockMvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(body1)).andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\": \"" + s2.refresh() + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void logoutRevokesRefreshToken() throws Exception {
        Session s = loginWithEmail(newEmail());
        String body = "{\"refreshToken\": \"" + s.refresh() + "\"}";
        mockMvc.perform(post("/api/auth/logout").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isNoContent());
        mockMvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON).content(body)).andExpect(status().isUnauthorized());
    }

    @Test
    void usersCannotSeeOrOverwriteEachOthersData() throws Exception {
        Session a = loginWithEmail(newEmail());
        Session b = loginWithEmail(newEmail());
        String id = UUID.randomUUID().toString();
        String measurement = "{\"kind\": \"WEIGHT\", \"value\": 80, \"measuredAt\": \"2026-10-20T07:00:00Z\"}";
        mockMvc.perform(put("/api/measurements/" + id).header("Authorization", bearer(a)).contentType(MediaType.APPLICATION_JSON).content(measurement))
                .andExpect(status().isOk());
        mockMvc.perform(get("/api/measurements").header("Authorization", bearer(b))).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(put("/api/measurements/" + id).header("Authorization", bearer(b)).contentType(MediaType.APPLICATION_JSON).content(measurement))
                .andExpect(status().isConflict());
    }

    @Test
    void invalidTokenIsRejectedEvenLocally() throws Exception {
        mockMvc.perform(get("/api/me").header("Authorization", "Bearer ikke.et.token")).andExpect(status().isUnauthorized());
    }

    @Test
    void googleLoginLinksToVerifiedEmail() throws Exception {
        String email = newEmail();
        Session byEmail = loginWithEmail(email);
        MvcResult r = mockMvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"idToken\": \"good:sub-" + UUID.randomUUID() + ":" + email + "\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.newUser").value(false))
                .andReturn();
        assertThat(session(r).userId()).isEqualTo(byEmail.userId());
        mockMvc.perform(post("/api/auth/google").contentType(MediaType.APPLICATION_JSON).content("{\"idToken\": \"bad\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void deletingAccountRemovesDataAndSession() throws Exception {
        Session s = loginWithEmail(newEmail());
        mockMvc.perform(delete("/api/me").header("Authorization", bearer(s))).andExpect(status().isNoContent());
        mockMvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"refreshToken\": \"" + s.refresh() + "\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void claimMovesDevUserDataLocally() throws Exception {
        String id = UUID.randomUUID().toString();
        // Uten token = utviklingsbrukeren (bare i local-profilen).
        mockMvc.perform(put("/api/measurements/" + id).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"kind\": \"WAIST\", \"value\": 84, \"measuredAt\": \"2026-10-20T07:00:00Z\"}"))
                .andExpect(status().isOk());
        Session s = loginWithEmail(newEmail());
        mockMvc.perform(post("/api/auth/claim-dev-data").header("Authorization", bearer(s))).andExpect(status().isOk());
        mockMvc.perform(get("/api/measurements").header("Authorization", bearer(s)))
                .andExpect(jsonPath("$[?(@.id == '" + id + "')]").exists());
    }
}
