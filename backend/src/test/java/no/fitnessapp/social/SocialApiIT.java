package no.fitnessapp.social;

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
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** Søk, følging (offentlig og privat), følgerlister og andres økter. */
@SpringBootTest(classes = FitnessApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Import({TestcontainersConfiguration.class, TestAuthConfiguration.class})
class SocialApiIT {

    static final String BENCH = "01960000-0000-7000-8000-000000000001";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    TestAuthConfiguration.CapturingMailer mailer;

    record User(String auth, String username) {}

    private User newUser(String firstName, boolean isPrivate) throws Exception {
        String email = "s-" + UUID.randomUUID() + "@example.com";
        mockMvc.perform(post("/api/auth/email/start").contentType(MediaType.APPLICATION_JSON).content("{\"email\": \"" + email + "\"}"));
        String json = mockMvc.perform(post("/api/auth/email/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"" + email + "\", \"code\": \"" + mailer.codes.get(email) + "\"}"))
                .andReturn().getResponse().getContentAsString();
        String auth = "Bearer " + JsonPath.<String>read(json, "$.accessToken");
        String username = firstName.toLowerCase() + "_" + UUID.randomUUID().toString().substring(0, 8);
        mockMvc.perform(put("/api/me/username").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\": \"" + username + "\"}")).andExpect(status().isOk());
        mockMvc.perform(put("/api/me").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\": \"" + firstName + "\", \"visibility\": \"" + (isPrivate ? "PRIVATE" : "PUBLIC") + "\"}"))
                .andExpect(status().isOk());
        return new User(auth, username);
    }

    private void addWorkout(User u) throws Exception {
        mockMvc.perform(put("/api/workouts/" + UUID.randomUUID()).header("Authorization", u.auth()).contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {"name": "Push", "notes": "hemmelig notat", "startedAt": "2026-10-20T16:00:00Z", "endedAt": "2026-10-20T17:00:00Z",
                                 "exercises": [{"id": "%s", "exerciseId": "%s", "position": 0,
                                   "sets": [{"id": "%s", "position": 0, "setType": "NORMAL", "weightKg": 80, "reps": 5,
                                             "completedAt": "2026-10-20T16:10:00Z"}]}]}
                                """.formatted(UUID.randomUUID(), BENCH, UUID.randomUUID())))
                .andExpect(status().is2xxSuccessful());
    }

    @Test
    void searchFindsByUsernameAndName() throws Exception {
        User me = newUser("Finn", false);
        User other = newUser("Ingrid", false);
        mockMvc.perform(get("/api/users/search").param("q", other.username()).header("Authorization", me.auth()))
                .andExpect(jsonPath("$[0].username").value(other.username()))
                .andExpect(jsonPath("$[0].followStatus").value("NONE"))
                .andExpect(jsonPath("$[0].isSelf").value(false));
        mockMvc.perform(get("/api/users/search").param("q", "ingr").header("Authorization", me.auth()))
                .andExpect(jsonPath("$[?(@.username == '" + other.username() + "')]").exists());
        mockMvc.perform(get("/api/users/search").param("q", "i").header("Authorization", me.auth())).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void followingPublicProfileGivesAccessToWorkoutsWithoutPrivateNotes() throws Exception {
        User me = newUser("Ola", false);
        User other = newUser("Kari", false);
        addWorkout(other);

        // Offentlig profil uten følging: tall synes, men økter for følgere (standard) gjør ikke det.
        mockMvc.perform(get("/api/users/" + other.username()).header("Authorization", me.auth()))
                .andExpect(jsonPath("$.workoutCount").value(1))
                .andExpect(jsonPath("$.canViewWorkouts").value(true))
                .andExpect(jsonPath("$.followStatus").value("NONE"));
        mockMvc.perform(get("/api/users/" + other.username() + "/workouts").header("Authorization", me.auth()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(post("/api/users/" + other.username() + "/follow").header("Authorization", me.auth()))
                .andExpect(jsonPath("$.followStatus").value("FOLLOWING"));
        mockMvc.perform(post("/api/users/" + other.username() + "/follow").header("Authorization", me.auth()))
                .andExpect(jsonPath("$.followStatus").value("FOLLOWING"));

        mockMvc.perform(get("/api/users/" + other.username()).header("Authorization", me.auth()))
                .andExpect(jsonPath("$.followerCount").value(1))
                .andExpect(jsonPath("$.canViewWorkouts").value(true));
        mockMvc.perform(get("/api/users/" + me.username()).header("Authorization", other.auth()))
                .andExpect(jsonPath("$.followsYou").value(true));

        String list = mockMvc.perform(get("/api/users/" + other.username() + "/workouts").header("Authorization", me.auth()))
                .andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].volumeKg").value(400.0))
                .andExpect(jsonPath("$[0].exercises[0].setCount").value(1))
                .andReturn().getResponse().getContentAsString();
        String workoutId = JsonPath.read(list, "$[0].id");
        mockMvc.perform(get("/api/workouts/" + workoutId + "/view").header("Authorization", me.auth()))
                .andExpect(jsonPath("$.workout.name").value("Push"))
                .andExpect(jsonPath("$.workout.notes").doesNotExist())
                .andExpect(jsonPath("$.summary.author.username").value(other.username()));

        mockMvc.perform(get("/api/users/" + other.username() + "/followers").header("Authorization", me.auth()))
                .andExpect(jsonPath("$[0].username").value(me.username()));
        mockMvc.perform(get("/api/users/" + me.username() + "/following").header("Authorization", me.auth()))
                .andExpect(jsonPath("$[0].username").value(other.username()));

        mockMvc.perform(delete("/api/users/" + other.username() + "/follow").header("Authorization", me.auth())).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/users/" + other.username() + "/workouts").header("Authorization", me.auth())).andExpect(jsonPath("$.length()").value(0));
        mockMvc.perform(get("/api/workouts/" + workoutId + "/view").header("Authorization", me.auth())).andExpect(status().isNotFound());
    }

    @Test
    void privateProfileRequiresApprovedRequest() throws Exception {
        User me = newUser("Per", false);
        User priv = newUser("Lise", true);

        mockMvc.perform(get("/api/users/" + priv.username()).header("Authorization", me.auth()))
                .andExpect(jsonPath("$.isPrivate").value(true))
                .andExpect(jsonPath("$.followerCount").doesNotExist());
        mockMvc.perform(get("/api/users/" + priv.username() + "/followers").header("Authorization", me.auth())).andExpect(status().isForbidden());

        mockMvc.perform(post("/api/users/" + priv.username() + "/follow").header("Authorization", me.auth()))
                .andExpect(jsonPath("$.followStatus").value("PENDING"));
        mockMvc.perform(get("/api/users/" + priv.username() + "/workouts").header("Authorization", me.auth())).andExpect(status().isForbidden());

        mockMvc.perform(get("/api/me/follow-requests").header("Authorization", priv.auth()))
                .andExpect(jsonPath("$[0].username").value(me.username()));
        mockMvc.perform(post("/api/me/follow-requests/" + me.username() + "/accept").header("Authorization", priv.auth()))
                .andExpect(status().isNoContent());
        mockMvc.perform(get("/api/me/follow-requests").header("Authorization", priv.auth())).andExpect(jsonPath("$.length()").value(0));

        mockMvc.perform(get("/api/users/" + priv.username()).header("Authorization", me.auth()))
                .andExpect(jsonPath("$.followStatus").value("FOLLOWING"))
                .andExpect(jsonPath("$.canViewWorkouts").value(true));

        // Eieren kan fjerne følgeren igjen.
        mockMvc.perform(delete("/api/me/followers/" + me.username()).header("Authorization", priv.auth())).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/users/" + priv.username()).header("Authorization", me.auth()))
                .andExpect(jsonPath("$.followStatus").value("NONE"));
    }

    @Test
    void cannotFollowYourself() throws Exception {
        User me = newUser("Solo", false);
        mockMvc.perform(post("/api/users/" + me.username() + "/follow").header("Authorization", me.auth())).andExpect(status().isBadRequest());
    }
}
