package no.fitnessapp.social;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.util.List;
import java.util.UUID;
import javax.imageio.ImageIO;
import no.fitnessapp.FitnessApplication;
import no.fitnessapp.TestcontainersConfiguration;
import no.fitnessapp.auth.TestAuthConfiguration;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.webmvc.test.autoconfigure.AutoConfigureMockMvc;
import org.springframework.context.annotation.Import;
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/** Synlighet per økt, feed, liker, kommentarer, bilder og varsler. */
@SpringBootTest(classes = FitnessApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Import({TestcontainersConfiguration.class, TestAuthConfiguration.class})
class FeedApiIT {

    static final String BENCH = "01960000-0000-7000-8000-000000000001";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    TestAuthConfiguration.CapturingMailer mailer;

    record User(String auth, String username) {}

    private User newUser(String firstName) throws Exception {
        String email = "f-" + UUID.randomUUID() + "@example.com";
        mockMvc.perform(post("/api/auth/email/start").contentType(MediaType.APPLICATION_JSON).content("{\"email\": \"" + email + "\"}"));
        String json = mockMvc.perform(post("/api/auth/email/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"" + email + "\", \"code\": \"" + mailer.codes.get(email) + "\"}"))
                .andReturn().getResponse().getContentAsString();
        String auth = "Bearer " + JsonPath.<String>read(json, "$.accessToken");
        String username = firstName.toLowerCase() + "_" + UUID.randomUUID().toString().substring(0, 8);
        mockMvc.perform(put("/api/me/username").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\": \"" + username + "\"}")).andExpect(status().isOk());
        mockMvc.perform(put("/api/me").header("Authorization", auth).contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\": \"" + firstName + "\"}")).andExpect(status().isOk());
        return new User(auth, username);
    }

    private String workoutJson(String name, String startedAt, String visibility, String exerciseId, String setId) {
        return """
                {"name": "%s", "startedAt": "%s", "endedAt": "%s", %s
                 "exercises": [{"id": "%s", "exerciseId": "%s",
                   "sets": [{"id": "%s", "setType": "NORMAL", "weightKg": 100, "reps": 3, "completedAt": "%s"}]}]}
                """.formatted(name, startedAt, startedAt, visibility == null ? "" : "\"visibility\": \"" + visibility + "\",",
                exerciseId, BENCH, setId, startedAt);
    }

    private String addWorkout(User u, String name, String startedAt, String visibility) throws Exception {
        String id = UUID.randomUUID().toString();
        mockMvc.perform(put("/api/workouts/" + id).header("Authorization", u.auth()).contentType(MediaType.APPLICATION_JSON)
                        .content(workoutJson(name, startedAt, visibility, UUID.randomUUID().toString(), UUID.randomUUID().toString())))
                .andExpect(status().is2xxSuccessful());
        return id;
    }

    private void follow(User from, User to) throws Exception {
        mockMvc.perform(post("/api/users/" + to.username() + "/follow").header("Authorization", from.auth())).andExpect(status().isOk());
    }

    @Test
    void feedShowsOwnAndFollowedWorkoutsRespectingVisibility() throws Exception {
        User me = newUser("Mia");
        User friend = newUser("Jon");
        User stranger = newUser("Eva");
        follow(me, friend);
        String mine = addWorkout(me, "Min økt", "2026-10-20T08:00:00Z", "PRIVATE");
        addWorkout(friend, "Venn følgere", "2026-10-21T08:00:00Z", null);
        addWorkout(friend, "Venn privat", "2026-10-22T08:00:00Z", "PRIVATE");
        addWorkout(friend, "Venn offentlig", "2026-10-19T08:00:00Z", "PUBLIC");
        addWorkout(stranger, "Fremmed offentlig", "2026-10-21T09:00:00Z", "PUBLIC");

        String json = mockMvc.perform(get("/api/feed").header("Authorization", me.auth()))
                .andExpect(status().isOk()).andReturn().getResponse().getContentAsString();
        List<String> names = JsonPath.read(json, "$[*].name");
        assertThat(names).containsExactly("Venn følgere", "Min økt", "Venn offentlig");
        assertThat(JsonPath.<String>read(json, "$[1].id")).isEqualTo(mine);

        // Sider: før «Min økt» kommer bare den eldste.
        mockMvc.perform(get("/api/feed").param("before", "2026-10-20T08:00:00Z").header("Authorization", me.auth()))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].name").value("Venn offentlig"));

        // Den fremmede ser bare vennens offentlige økt på profilen hans.
        mockMvc.perform(get("/api/users/" + friend.username() + "/workouts").header("Authorization", stranger.auth()))
                .andExpect(jsonPath("$.length()").value(1)).andExpect(jsonPath("$[0].name").value("Venn offentlig"));
    }

    @Test
    void likesAndCommentsSurviveResyncAndNotifyOwner() throws Exception {
        User owner = newUser("Ola");
        User fan = newUser("Kari");
        follow(fan, owner);
        String workoutId = UUID.randomUUID().toString();
        String exerciseId = UUID.randomUUID().toString();
        String setId = UUID.randomUUID().toString();
        String body = workoutJson("Bein", "2026-10-22T10:00:00Z", null, exerciseId, setId);
        mockMvc.perform(put("/api/workouts/" + workoutId).header("Authorization", owner.auth()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isCreated());

        mockMvc.perform(put("/api/workouts/" + workoutId + "/like").header("Authorization", fan.auth())).andExpect(status().isNoContent());
        mockMvc.perform(put("/api/workouts/" + workoutId + "/like").header("Authorization", fan.auth())).andExpect(status().isNoContent());
        String commentId = UUID.randomUUID().toString();
        String comment = "{\"id\": \"" + commentId + "\", \"body\": \"Sterkt!\"}";
        mockMvc.perform(post("/api/workouts/" + workoutId + "/comments").header("Authorization", fan.auth()).contentType(MediaType.APPLICATION_JSON).content(comment))
                .andExpect(jsonPath("$.length()").value(1));
        mockMvc.perform(post("/api/workouts/" + workoutId + "/comments").header("Authorization", fan.auth()).contentType(MediaType.APPLICATION_JSON).content(comment))
                .andExpect(jsonPath("$.length()").value(1));

        // Økten synkes på nytt (f.eks. redigert): liker og kommentarer skal bestå, og synligheten beholdes.
        mockMvc.perform(put("/api/workouts/" + workoutId).header("Authorization", owner.auth()).contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isOk()).andExpect(jsonPath("$.visibility").value("FOLLOWERS"));
        mockMvc.perform(get("/api/workouts/" + workoutId + "/view").header("Authorization", fan.auth()))
                .andExpect(jsonPath("$.summary.likeCount").value(1))
                .andExpect(jsonPath("$.summary.likedByMe").value(true))
                .andExpect(jsonPath("$.summary.commentCount").value(1));

        mockMvc.perform(get("/api/notifications/unread-count").header("Authorization", owner.auth())).andExpect(jsonPath("$.count").value(3));
        mockMvc.perform(get("/api/notifications").header("Authorization", owner.auth()))
                .andExpect(jsonPath("$[0].type").value("COMMENT"))
                .andExpect(jsonPath("$[0].commentPreview").value("Sterkt!"))
                .andExpect(jsonPath("$[1].type").value("LIKE"))
                .andExpect(jsonPath("$[2].type").value("FOLLOW"));
        mockMvc.perform(post("/api/notifications/read").header("Authorization", owner.auth())).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/notifications/unread-count").header("Authorization", owner.auth())).andExpect(jsonPath("$.count").value(0));

        // Eieren kan slette andres kommentar; en tredje bruker kan ikke se (eller kommentere) en følgerøkt.
        User other = newUser("Per");
        mockMvc.perform(post("/api/workouts/" + workoutId + "/comments").header("Authorization", other.auth()).contentType(MediaType.APPLICATION_JSON)
                .content("{\"id\": \"" + UUID.randomUUID() + "\", \"body\": \"Hei\"}")).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/comments/" + commentId).header("Authorization", owner.auth())).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/workouts/" + workoutId + "/comments").header("Authorization", fan.auth())).andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void photosAreLimitedToOwnerAndFour() throws Exception {
        User owner = newUser("Foto");
        User other = newUser("Annen");
        String workoutId = addWorkout(owner, "Med bilder", "2026-10-22T12:00:00Z", "PUBLIC");
        BufferedImage image = new BufferedImage(2400, 1200, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(image, "png", png);
        MockMultipartFile file = new MockMultipartFile("file", "b.png", "image/png", png.toByteArray());

        for (int i = 0; i < 4; i++) {
            mockMvc.perform(multipart(HttpMethod.PUT, "/api/workouts/" + workoutId + "/photos/" + UUID.randomUUID()).file(file)
                    .header("Authorization", owner.auth())).andExpect(status().isOk());
        }
        mockMvc.perform(multipart(HttpMethod.PUT, "/api/workouts/" + workoutId + "/photos/" + UUID.randomUUID()).file(file)
                .header("Authorization", owner.auth())).andExpect(status().isBadRequest());
        mockMvc.perform(multipart(HttpMethod.PUT, "/api/workouts/" + workoutId + "/photos/" + UUID.randomUUID()).file(file)
                .header("Authorization", other.auth())).andExpect(status().isNotFound());

        String json = mockMvc.perform(get("/api/users/" + owner.username() + "/workouts").header("Authorization", other.auth()))
                .andExpect(jsonPath("$[0].photoUrls.length()").value(4)).andReturn().getResponse().getContentAsString();
        String url = JsonPath.read(json, "$[0].photoUrls[0]");
        byte[] served = mockMvc.perform(get(url.substring("http://localhost:8080".length()))).andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        BufferedImage stored = ImageIO.read(new java.io.ByteArrayInputStream(served));
        assertThat(stored.getWidth()).isEqualTo(1600);
        assertThat(stored.getHeight()).isEqualTo(800);
    }
}
