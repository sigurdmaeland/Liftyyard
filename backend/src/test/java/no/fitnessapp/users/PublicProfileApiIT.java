package no.fitnessapp.users;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.awt.image.BufferedImage;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
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

/** Brukernavn, synlighet, offentlig profil og profilbilde. */
@SpringBootTest(classes = FitnessApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Import({TestcontainersConfiguration.class, TestAuthConfiguration.class})
class PublicProfileApiIT {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    TestAuthConfiguration.CapturingMailer mailer;

    /** Logger inn en ny bruker med e-post og returnerer «Bearer <token>». */
    private String newUser() throws Exception {
        String email = "u-" + UUID.randomUUID() + "@example.com";
        mockMvc.perform(post("/api/auth/email/start").contentType(MediaType.APPLICATION_JSON).content("{\"email\": \"" + email + "\"}"));
        String json = mockMvc.perform(post("/api/auth/email/verify").contentType(MediaType.APPLICATION_JSON)
                        .content("{\"email\": \"" + email + "\", \"code\": \"" + mailer.codes.get(email) + "\"}"))
                .andReturn().getResponse().getContentAsString();
        String token = JsonPath.read(json, "$.accessToken");
        mockMvc.perform(put("/api/me").header("Authorization", "Bearer " + token).contentType(MediaType.APPLICATION_JSON)
                .content("{\"firstName\": \"Kari\", \"lastName\": \"Nordmann\", \"birthDate\": \"1995-05-05\", \"gender\": \"FEMALE\"}"));
        return "Bearer " + token;
    }

    private static String randomName() {
        return "u_" + UUID.randomUUID().toString().replace("-", "").substring(0, 12);
    }

    @Test
    void usernameRulesAndUniqueness() throws Exception {
        String a = newUser();
        String b = newUser();
        String name = randomName();
        mockMvc.perform(get("/api/usernames/ab").header("Authorization", a))
                .andExpect(jsonPath("$.available").value(false)).andExpect(jsonPath("$.reason").value("Minst 3 tegn"));
        mockMvc.perform(get("/api/usernames/admin").header("Authorization", a)).andExpect(jsonPath("$.available").value(false));
        mockMvc.perform(get("/api/usernames/abc-def").header("Authorization", a)).andExpect(jsonPath("$.available").value(false));

        // Store bokstaver og «@» normaliseres.
        mockMvc.perform(put("/api/me/username").header("Authorization", a).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\": \"@" + name.toUpperCase() + "\"}"))
                .andExpect(status().isOk()).andExpect(jsonPath("$.username").value(name));
        mockMvc.perform(get("/api/usernames/" + name).header("Authorization", a)).andExpect(jsonPath("$.available").value(true));
        mockMvc.perform(get("/api/usernames/" + name).header("Authorization", b))
                .andExpect(jsonPath("$.available").value(false)).andExpect(jsonPath("$.reason").value("Brukernavnet er tatt"));
        mockMvc.perform(put("/api/me/username").header("Authorization", b).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\": \"" + name + "\"}"))
                .andExpect(status().isConflict());
    }

    @Test
    void publicProfileHidesPrivateDataAndRespectsVisibility() throws Exception {
        String owner = newUser();
        String viewer = newUser();
        String name = randomName();
        mockMvc.perform(put("/api/me/username").header("Authorization", owner).contentType(MediaType.APPLICATION_JSON)
                .content("{\"username\": \"" + name + "\"}"));

        String json = mockMvc.perform(get("/api/users/" + name).header("Authorization", viewer))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.displayName").value("Kari Nordmann"))
                .andExpect(jsonPath("$.isPrivate").value(false))
                .andExpect(jsonPath("$.isSelf").value(false))
                .andExpect(jsonPath("$.workoutCount").value(0))
                .andReturn().getResponse().getContentAsString();
        assertThat(json).doesNotContain("birthDate").doesNotContain("1995").doesNotContain("FEMALE");

        mockMvc.perform(put("/api/me").header("Authorization", owner).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"firstName\": \"Kari\", \"lastName\": \"Nordmann\", \"visibility\": \"PRIVATE\"}"))
                .andExpect(jsonPath("$.visibility").value("PRIVATE"));
        mockMvc.perform(get("/api/users/" + name).header("Authorization", viewer))
                .andExpect(jsonPath("$.isPrivate").value(true))
                .andExpect(jsonPath("$.workoutCount").doesNotExist());
        // Eieren ser alltid alt.
        mockMvc.perform(get("/api/users/" + name).header("Authorization", owner))
                .andExpect(jsonPath("$.isSelf").value(true))
                .andExpect(jsonPath("$.workoutCount").value(0));
        mockMvc.perform(get("/api/users/finnes_ikke_" + UUID.randomUUID().toString().substring(0, 6)).header("Authorization", viewer))
                .andExpect(status().isNotFound());
    }

    @Test
    void avatarIsCroppedResizedAndServed() throws Exception {
        String user = newUser();
        BufferedImage image = new BufferedImage(1200, 800, BufferedImage.TYPE_INT_RGB);
        ByteArrayOutputStream png = new ByteArrayOutputStream();
        ImageIO.write(image, "png", png);

        String json = mockMvc.perform(multipart(HttpMethod.PUT, "/api/me/avatar")
                        .file(new MockMultipartFile("file", "bilde.png", "image/png", png.toByteArray()))
                        .header("Authorization", user))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String url = JsonPath.read(json, "$.avatarUrl");
        assertThat(url).startsWith("http://localhost:8080/media/avatars/").endsWith(".jpg");
        mockMvc.perform(get("/api/me").header("Authorization", user)).andExpect(jsonPath("$.avatarUrl").value(url));

        byte[] served = mockMvc.perform(get(url.substring("http://localhost:8080".length())))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsByteArray();
        BufferedImage avatar = ImageIO.read(new ByteArrayInputStream(served));
        assertThat(avatar.getWidth()).isEqualTo(512);
        assertThat(avatar.getHeight()).isEqualTo(512);

        mockMvc.perform(multipart(HttpMethod.PUT, "/api/me/avatar")
                        .file(new MockMultipartFile("file", "tekst.jpg", "image/jpeg", "ikke et bilde".getBytes()))
                        .header("Authorization", user))
                .andExpect(status().isBadRequest());
    }
}
