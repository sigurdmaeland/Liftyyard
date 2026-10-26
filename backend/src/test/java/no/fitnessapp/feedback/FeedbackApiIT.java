package no.fitnessapp.feedback;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.UUID;
import no.fitnessapp.FitnessApplication;
import no.fitnessapp.TestcontainersConfiguration;
import no.fitnessapp.auth.TestAuthConfiguration;
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** «Få hjelp»: tilbakemeldinger lagres (idempotent, med grense) og leses bare av moderatorer. */
@SpringBootTest(classes = FitnessApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Import({TestcontainersConfiguration.class, TestAuthConfiguration.class})
class FeedbackApiIT {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    TestAuthConfiguration.CapturingMailer mailer;

    record User(String auth, UUID id) {}

    private User newUser() throws Exception {
        String email = "feedback-" + UUID.randomUUID() + "@example.com";
        mockMvc.perform(post("/api/auth/email/start").contentType(MediaType.APPLICATION_JSON).content("{\"email\": \"" + email + "\"}"));
        String json = mockMvc.perform(post("/api/auth/email/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"" + email + "\", \"code\": \"" + mailer.codes.get(email) + "\"}"))
                .andReturn().getResponse().getContentAsString();
        return new User("Bearer " + JsonPath.<String>read(json, "$.accessToken"), UUID.fromString(JsonPath.read(json, "$.userId")));
    }

    private ResultActions as(User u, MockHttpServletRequestBuilder req) throws Exception {
        return mockMvc.perform(req.header("Authorization", u.auth()).contentType(MediaType.APPLICATION_JSON));
    }

    private static String body(UUID id, String kind, String message) {
        return """
                {"id": "%s", "kind": "%s", "message": "%s", "appVersion": "1.0.0", "platform": "ios"}
                """.formatted(id, kind, message);
    }

    @Test
    void feedbackIsStoredOnceAndOnlyModeratorsCanReadIt() throws Exception {
        User user = newUser();
        User mod = newUser();
        UUID id = UUID.randomUUID();
        as(user, post("/api/feedback").content(body(id, "BUG", "Appen krasjer når jeg lagrer"))).andExpect(status().isAccepted());
        as(user, post("/api/feedback").content(body(id, "BUG", "Appen krasjer når jeg lagrer"))).andExpect(status().isAccepted());
        assertThat(jdbc.sql("SELECT count(*) FROM feedback WHERE user_id = :u").param("u", user.id()).query(Long.class).single()).isEqualTo(1);

        as(user, post("/api/feedback").content(body(UUID.randomUUID(), "IDEA", "   "))).andExpect(status().isBadRequest());
        as(mod, post("/api/feedback").content(body(id, "IDEA", "Noe annet"))).andExpect(status().isConflict());

        as(mod, get("/api/moderation/feedback")).andExpect(status().isForbidden());
        jdbc.sql("UPDATE users SET role = 'MODERATOR' WHERE id = :id").param("id", mod.id()).update();
        as(mod, get("/api/moderation/feedback"))
                .andExpect(jsonPath("$[?(@.id == '" + id + "')].kind").value("BUG"))
                .andExpect(jsonPath("$[?(@.id == '" + id + "')].message").value("Appen krasjer når jeg lagrer"));

        as(mod, post("/api/moderation/feedback/" + id + "/done")).andExpect(status().isNoContent());
        as(mod, get("/api/moderation/feedback")).andExpect(jsonPath("$[?(@.id == '" + id + "')]").isEmpty());
        as(mod, get("/api/moderation/feedback?status=DONE")).andExpect(jsonPath("$[?(@.id == '" + id + "')].status").value("DONE"));
    }

    @Test
    void tooManyMessagesAreRejected() throws Exception {
        User user = newUser();
        for (int i = 0; i < FeedbackService.MAX_PER_HOUR; i++) {
            as(user, post("/api/feedback").content(body(UUID.randomUUID(), "SUPPORT", "Hei " + i))).andExpect(status().isAccepted());
        }
        as(user, post("/api/feedback").content(body(UUID.randomUUID(), "SUPPORT", "En til"))).andExpect(status().isTooManyRequests());
    }
}
