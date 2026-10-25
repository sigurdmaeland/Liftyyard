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
import org.springframework.test.web.servlet.ResultActions;
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder;

/** Svar og liker på kommentarer, @omtale, treningspartnere, forslag, rekorder og supersett. */
@SpringBootTest(classes = FitnessApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Import({TestcontainersConfiguration.class, TestAuthConfiguration.class})
class CommunityApiIT {

    static final String BENCH = "01960000-0000-7000-8000-000000000001";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    TestAuthConfiguration.CapturingMailer mailer;

    record User(String auth, String username) {}

    private User newUser(String firstName) throws Exception {
        String email = "c-" + UUID.randomUUID() + "@example.com";
        mockMvc.perform(post("/api/auth/email/start").contentType(MediaType.APPLICATION_JSON).content("{\"email\": \"" + email + "\"}"));
        String json = mockMvc.perform(post("/api/auth/email/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"" + email + "\", \"code\": \"" + mailer.codes.get(email) + "\"}"))
                .andReturn().getResponse().getContentAsString();
        String auth = "Bearer " + JsonPath.<String>read(json, "$.accessToken");
        String username = firstName.toLowerCase() + "_" + UUID.randomUUID().toString().substring(0, 8);
        as(new User(auth, username), put("/api/me/username").content("{\"username\": \"" + username + "\"}")).andExpect(status().isOk());
        as(new User(auth, username), put("/api/me").content("{\"firstName\": \"" + firstName + "\"}")).andExpect(status().isOk());
        return new User(auth, username);
    }

    private ResultActions as(User u, MockHttpServletRequestBuilder req) throws Exception {
        return mockMvc.perform(req.header("Authorization", u.auth()).contentType(MediaType.APPLICATION_JSON));
    }

    private UUID workout(User u, String day, double weight, int reps, Integer superset) throws Exception {
        UUID id = UUID.randomUUID();
        as(u, put("/api/workouts/" + id).content("""
                {"name": "Push", "visibility": "PUBLIC", "startedAt": "2026-10-%sT16:00:00Z", "endedAt": "2026-10-%sT17:00:00Z",
                 "exercises": [{"id": "%s", "exerciseId": "%s", "position": 0, "supersetGroup": %s,
                   "sets": [{"id": "%s", "position": 0, "setType": "NORMAL", "weightKg": %s, "reps": %d, "completedAt": "2026-10-%sT16:10:00Z"}]}]}
                """.formatted(day, day, UUID.randomUUID(), BENCH, superset == null ? "null" : superset, UUID.randomUUID(), weight, reps, day)))
                .andExpect(status().is2xxSuccessful());
        return id;
    }

    @Test
    void repliesLikesAndMentionsNotifyTheRightPeople() throws Exception {
        User owner = newUser("Ane");
        User commenter = newUser("Bo");
        User mentioned = newUser("Cia");
        UUID w = workout(owner, "10", 80, 5, null);

        UUID first = UUID.randomUUID();
        as(commenter, post("/api/workouts/" + w + "/comments").content("{\"id\": \"" + first + "\", \"body\": \"Sterkt! @" + mentioned.username() + "\"}"))
                .andExpect(status().isOk());
        UUID reply = UUID.randomUUID();
        as(owner, post("/api/workouts/" + w + "/comments").content("{\"id\": \"" + reply + "\", \"body\": \"Takk!\", \"parentId\": \"" + first + "\"}"))
                .andExpect(jsonPath("$[1].parentId").value(first.toString()));
        as(owner, put("/api/comments/" + first + "/like")).andExpect(status().isNoContent());
        as(owner, put("/api/comments/" + first + "/like")).andExpect(status().isNoContent());

        as(commenter, get("/api/workouts/" + w + "/comments"))
                .andExpect(jsonPath("$[0].likeCount").value(1))
                .andExpect(jsonPath("$[0].likedByMe").value(false));
        as(commenter, get("/api/notifications"))
                .andExpect(jsonPath("$[?(@.type == 'REPLY')]").exists())
                .andExpect(jsonPath("$[?(@.type == 'COMMENT_LIKE')]").exists());
        as(mentioned, get("/api/notifications")).andExpect(jsonPath("$[0].type").value("MENTION"));

        as(owner, delete("/api/comments/" + first + "/like")).andExpect(status().isNoContent());
        as(commenter, get("/api/notifications")).andExpect(jsonPath("$[?(@.type == 'COMMENT_LIKE')]").doesNotExist());
    }

    @Test
    void partnersMustBeConnectedAndAreShownOnTheWorkout() throws Exception {
        User owner = newUser("Dag");
        User friend = newUser("Eli");
        User stranger = newUser("Fia");
        UUID w = workout(owner, "11", 60, 8, null);

        as(owner, put("/api/workouts/" + w + "/partners").content("{\"usernames\": [\"" + friend.username() + "\"]}"))
                .andExpect(status().isBadRequest());
        as(friend, post("/api/users/" + owner.username() + "/follow")).andExpect(status().isOk());
        as(owner, put("/api/workouts/" + w + "/partners").content("{\"usernames\": [\"" + friend.username() + "\"]}"))
                .andExpect(status().isNoContent());
        as(owner, put("/api/workouts/" + w + "/partners").content("{\"usernames\": [\"" + stranger.username() + "\"]}"))
                .andExpect(status().isBadRequest());

        as(friend, get("/api/workouts/" + w + "/view")).andExpect(jsonPath("$.summary.partners[0].username").value(friend.username()));
        as(friend, get("/api/notifications")).andExpect(jsonPath("$[0].type").value("TAG"));

        as(friend, delete("/api/workouts/" + w + "/partners/me")).andExpect(status().isNoContent());
        as(owner, get("/api/workouts/" + w + "/view")).andExpect(jsonPath("$.summary.partners.length()").value(0));
    }

    @Test
    void suggestionsPreferFriendsOfFriends() throws Exception {
        User me = newUser("Gro");
        User friend = newUser("Hal");
        User friendOfFriend = newUser("Ida");
        as(me, post("/api/users/" + friend.username() + "/follow")).andExpect(status().isOk());
        as(friend, post("/api/users/" + friendOfFriend.username() + "/follow")).andExpect(status().isOk());
        as(me, get("/api/users/suggestions"))
                .andExpect(jsonPath("$[0].user.username").value(friendOfFriend.username()))
                .andExpect(jsonPath("$[0].mutualCount").value(1))
                .andExpect(jsonPath("$[?(@.user.username == '" + friend.username() + "')]").doesNotExist());
    }

    @Test
    void recordsAndSupersetsAreReturned() throws Exception {
        User u = newUser("Jon");
        workout(u, "12", 80, 5, null);
        UUID pr = workout(u, "13", 85, 5, 1);
        as(u, get("/api/workouts/" + pr + "/view"))
                .andExpect(jsonPath("$.summary.recordCount").value(3))
                .andExpect(jsonPath("$.summary.recordMedals[0]").value(1))
                .andExpect(jsonPath("$.workout.exercises[0].supersetGroup").value(1));
        as(u, get("/api/feed")).andExpect(jsonPath("$[?(@.id == '" + pr + "')].recordCount").value(3));
    }
}
