package no.fitnessapp.moderation;

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

/** Blokkering, rapportering, moderering, sperring, vilkår og minstealder. */
@SpringBootTest(classes = FitnessApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Import({TestcontainersConfiguration.class, TestAuthConfiguration.class})
class SafetyApiIT {

    static final String BENCH = "01960000-0000-7000-8000-000000000001";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    JdbcClient jdbc;

    @Autowired
    TestAuthConfiguration.CapturingMailer mailer;

    record User(String auth, String refresh, String username, UUID id) {}

    private User newUser(String firstName) throws Exception {
        String email = "safe-" + UUID.randomUUID() + "@example.com";
        mockMvc.perform(post("/api/auth/email/start").contentType(MediaType.APPLICATION_JSON).content("{\"email\": \"" + email + "\"}"));
        String json = mockMvc.perform(post("/api/auth/email/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"" + email + "\", \"code\": \"" + mailer.codes.get(email) + "\"}"))
                .andReturn().getResponse().getContentAsString();
        String auth = "Bearer " + JsonPath.<String>read(json, "$.accessToken");
        String username = firstName.toLowerCase() + "_" + UUID.randomUUID().toString().substring(0, 8);
        mockMvc.perform(put("/api/me/username").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\": \"" + username + "\"}")).andExpect(status().isOk());
        mockMvc.perform(put("/api/me").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\": \"" + firstName + "\", \"bio\": \"Hei\"}")).andExpect(status().isOk());
        return new User(auth, JsonPath.read(json, "$.refreshToken"), username, UUID.fromString(JsonPath.read(json, "$.userId")));
    }

    private ResultActions as(User u, org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder req) throws Exception {
        return mockMvc.perform(req.header("Authorization", u.auth()).contentType(MediaType.APPLICATION_JSON));
    }

    private UUID publicWorkout(User u) throws Exception {
        UUID id = UUID.randomUUID();
        as(u, put("/api/workouts/" + id).content("""
                {"name": "Push", "visibility": "PUBLIC", "startedAt": "2026-10-20T16:00:00Z", "endedAt": "2026-10-20T17:00:00Z",
                 "exercises": [{"id": "%s", "exerciseId": "%s", "position": 0,
                   "sets": [{"id": "%s", "position": 0, "setType": "NORMAL", "weightKg": 80, "reps": 5, "completedAt": "2026-10-20T16:10:00Z"}]}]}
                """.formatted(UUID.randomUUID(), BENCH, UUID.randomUUID()))).andExpect(status().is2xxSuccessful());
        return id;
    }

    private String report(UUID id, String type, UUID target, String reason) {
        return """
                {"id": "%s", "targetType": "%s", "targetId": "%s", "reason": "%s", "details": "Test"}
                """.formatted(id, type, target, reason);
    }

    @Test
    void blockingHidesBothWaysAndRemovesFollows() throws Exception {
        User anna = newUser("Anna");
        User bjorn = newUser("Bjorn");
        UUID workout = publicWorkout(anna);
        as(bjorn, post("/api/users/" + anna.username() + "/follow")).andExpect(status().isOk());
        as(anna, post("/api/users/" + bjorn.username() + "/follow")).andExpect(status().isOk());

        as(anna, put("/api/users/" + bjorn.username() + "/block")).andExpect(status().isNoContent());
        as(anna, put("/api/users/" + bjorn.username() + "/block")).andExpect(status().isNoContent());

        as(bjorn, get("/api/users/" + anna.username())).andExpect(status().isNotFound());
        as(bjorn, get("/api/workouts/" + workout + "/view")).andExpect(status().isNotFound());
        as(bjorn, get("/api/users/search").param("q", anna.username())).andExpect(jsonPath("$.length()").value(0));
        as(bjorn, post("/api/users/" + anna.username() + "/follow")).andExpect(status().isNotFound());
        as(anna, get("/api/users/" + bjorn.username()))
                .andExpect(jsonPath("$.blockedByYou").value(true))
                .andExpect(jsonPath("$.bio").doesNotExist())
                .andExpect(jsonPath("$.followStatus").value("NONE"));
        as(anna, get("/api/me/blocks")).andExpect(jsonPath("$[0].username").value(bjorn.username()));
        assertThat(jdbc.sql("SELECT count(*) FROM follows WHERE follower_id IN (:a, :b) AND followee_id IN (:a, :b)")
                .param("a", anna.id()).param("b", bjorn.id()).query(Long.class).single()).isZero();

        as(anna, delete("/api/users/" + bjorn.username() + "/block")).andExpect(status().isNoContent());
        as(bjorn, get("/api/workouts/" + workout + "/view")).andExpect(status().isOk());
    }

    @Test
    void reportsAreIdempotentAndModeratorsCanRemoveContentAndSuspend() throws Exception {
        User owner = newUser("Eva");
        User reporter = newUser("Rolf");
        User mod = newUser("Mona");
        UUID workout = publicWorkout(owner);

        UUID reportId = UUID.randomUUID();
        as(reporter, post("/api/reports").content(report(reportId, "WORKOUT", workout, "SPAM"))).andExpect(status().isAccepted());
        as(reporter, post("/api/reports").content(report(reportId, "WORKOUT", workout, "SPAM"))).andExpect(status().isAccepted());
        as(reporter, post("/api/reports").content(report(UUID.randomUUID(), "WORKOUT", workout, "HATE"))).andExpect(status().isAccepted());
        assertThat(jdbc.sql("SELECT count(*) FROM reports WHERE target_id = :t").param("t", workout).query(Long.class).single()).isEqualTo(1);
        as(owner, post("/api/reports").content(report(UUID.randomUUID(), "WORKOUT", workout, "SPAM"))).andExpect(status().isBadRequest());
        as(reporter, post("/api/reports").content(report(UUID.randomUUID(), "PROGRAM", UUID.randomUUID(), "SPAM"))).andExpect(status().isNotFound());

        as(mod, get("/api/moderation/reports")).andExpect(status().isForbidden());
        jdbc.sql("UPDATE users SET role = 'MODERATOR' WHERE id = :id").param("id", mod.id()).update();
        as(mod, get("/api/moderation/reports"))
                .andExpect(jsonPath("$[?(@.id == '" + reportId + "')].snapshot").value("Push"))
                .andExpect(jsonPath("$[?(@.id == '" + reportId + "')].targetUsername").value(owner.username()));

        as(mod, post("/api/moderation/reports/" + reportId + "/resolve").content("{\"action\": \"REMOVE_CONTENT\", \"note\": \"Spam\"}"))
                .andExpect(status().isNoContent());
        assertThat(jdbc.sql("SELECT visibility FROM workouts WHERE id = :id").param("id", workout).query(String.class).single()).isEqualTo("PRIVATE");
        as(reporter, get("/api/workouts/" + workout + "/view")).andExpect(status().isNotFound());

        UUID userReport = UUID.randomUUID();
        as(reporter, post("/api/reports").content(report(userReport, "USER", owner.id(), "HARASSMENT"))).andExpect(status().isAccepted());
        as(mod, post("/api/moderation/reports/" + userReport + "/resolve").content("{\"action\": \"SUSPEND_USER\"}")).andExpect(status().isNoContent());
        mockMvc.perform(post("/api/auth/refresh").contentType(MediaType.APPLICATION_JSON).content("{\"refreshToken\": \"" + owner.refresh() + "\"}"))
                .andExpect(status().is4xxClientError());
        as(reporter, get("/api/users/" + owner.username())).andExpect(status().isNotFound());

        as(mod, delete("/api/moderation/users/" + owner.id() + "/suspension")).andExpect(status().isNoContent());
        as(reporter, get("/api/users/" + owner.username())).andExpect(status().isOk());
    }

    @Test
    void termsMustMatchCurrentVersionAndMinimumAgeIsEnforced() throws Exception {
        User u = newUser("Tina");
        String current = JsonPath.read(as(u, get("/api/me")).andReturn().getResponse().getContentAsString(), "$.currentTermsVersion");
        as(u, get("/api/me")).andExpect(jsonPath("$.acceptedTermsVersion").doesNotExist()).andExpect(jsonPath("$.role").value("USER"));

        as(u, put("/api/me/terms").content("{\"version\": \"gammel\", \"confirmsMinimumAge\": true}")).andExpect(status().isBadRequest());
        as(u, put("/api/me/terms").content("{\"version\": \"" + current + "\", \"confirmsMinimumAge\": false}")).andExpect(status().isBadRequest());
        as(u, put("/api/me/terms").content("{\"version\": \"" + current + "\", \"confirmsMinimumAge\": true}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.acceptedTermsVersion").value(current));

        String tooYoung = java.time.LocalDate.now().minusYears(12).toString();
        as(u, put("/api/me").content("{\"firstName\": \"Tina\", \"birthDate\": \"" + tooYoung + "\"}")).andExpect(status().isBadRequest());
    }
}
