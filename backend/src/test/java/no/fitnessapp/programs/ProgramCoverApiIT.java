package no.fitnessapp.programs;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.awt.Color;
import java.awt.image.BufferedImage;
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
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.ResultActions;

/** Forsidebilde på programmer: opplasting, visning, tilgang, fjerning og kopi ved nedlasting. */
@SpringBootTest(classes = FitnessApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Import({TestcontainersConfiguration.class, TestAuthConfiguration.class})
class ProgramCoverApiIT {

    @Autowired
    MockMvc mockMvc;

    @Autowired
    TestAuthConfiguration.CapturingMailer mailer;

    private String newUser(String firstName) throws Exception {
        String email = "cover-" + UUID.randomUUID() + "@example.com";
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
        return auth;
    }

    private static byte[] png(int w, int h) throws Exception {
        BufferedImage img = new BufferedImage(w, h, BufferedImage.TYPE_INT_RGB);
        var g = img.createGraphics();
        g.setColor(new Color(42, 100, 240));
        g.fillRect(0, 0, w, h);
        g.dispose();
        var out = new ByteArrayOutputStream();
        ImageIO.write(img, "png", out);
        return out.toByteArray();
    }

    private ResultActions upload(String auth, UUID program) throws Exception {
        return mockMvc.perform(multipart("/api/programs/" + program + "/cover")
                .file(new MockMultipartFile("file", "cover.png", "image/png", png(800, 600)))
                .header("Authorization", auth));
    }

    @Test
    void ownerCanSetReplaceAndRemoveCover() throws Exception {
        String owner = newUser("Ida");
        String other = newUser("Ola");
        UUID program = UUID.randomUUID();
        mockMvc.perform(put("/api/programs/" + program).header("Authorization", owner).contentType(MediaType.APPLICATION_JSON)
                        .content("{\"name\": \"Bilde-program\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.coverUrl").doesNotExist());

        String first = JsonPath.read(upload(owner, program).andExpect(status().isOk()).andReturn().getResponse().getContentAsString(), "$.coverUrl");
        assertThat(first).contains("/covers/" + program + "/").endsWith(".jpg");
        mockMvc.perform(get("/api/programs/" + program).header("Authorization", owner)).andExpect(jsonPath("$.coverUrl").value(first));
        mockMvc.perform(get("/api/programs").header("Authorization", owner))
                .andExpect(jsonPath("$[?(@.id == '" + program + "')].coverUrl").value(first));

        // Bildet er beskåret til kvadrat og kan hentes.
        String path = first.substring(first.indexOf("/media/"));
        byte[] stored = mockMvc.perform(get(path)).andExpect(status().isOk()).andReturn().getResponse().getContentAsByteArray();
        BufferedImage img = ImageIO.read(new java.io.ByteArrayInputStream(stored));
        assertThat(img.getWidth()).isEqualTo(img.getHeight()).isEqualTo(600);

        // Andre kan ikke endre bildet.
        upload(other, program).andExpect(status().isNotFound());
        mockMvc.perform(delete("/api/programs/" + program + "/cover").header("Authorization", other)).andExpect(status().isNotFound());

        // Nytt bilde erstatter det gamle, som slettes.
        String second = JsonPath.read(upload(owner, program).andReturn().getResponse().getContentAsString(), "$.coverUrl");
        assertThat(second).isNotEqualTo(first);
        mockMvc.perform(get(path)).andExpect(status().isNotFound());

        mockMvc.perform(delete("/api/programs/" + program + "/cover").header("Authorization", owner)).andExpect(status().isNoContent());
        mockMvc.perform(delete("/api/programs/" + program + "/cover").header("Authorization", owner)).andExpect(status().isNoContent());
        mockMvc.perform(get("/api/programs/" + program).header("Authorization", owner)).andExpect(jsonPath("$.coverUrl").doesNotExist());
    }

    @Test
    void sharedProgramShowsCoverAndDownloadedCopyGetsItsOwn() throws Exception {
        String author = newUser("Siv");
        String viewer = newUser("Per");
        UUID program = UUID.randomUUID();
        mockMvc.perform(put("/api/programs/" + program).header("Authorization", author).contentType(MediaType.APPLICATION_JSON)
                .content("{\"name\": \"Delt med bilde\", \"visibility\": \"PUBLIC\"}")).andExpect(status().isCreated());
        String cover = JsonPath.read(upload(author, program).andReturn().getResponse().getContentAsString(), "$.coverUrl");

        mockMvc.perform(get("/api/explore/programs/" + program).header("Authorization", viewer)).andExpect(jsonPath("$.coverUrl").value(cover));

        UUID copyId = UUID.randomUUID();
        String copy = mockMvc.perform(post("/api/explore/programs/" + program + "/download").header("Authorization", viewer)
                        .contentType(MediaType.APPLICATION_JSON).content("{\"copyId\": \"" + copyId + "\"}"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();
        String copyCover = JsonPath.read(copy, "$.coverUrl");
        assertThat(copyCover).contains("/covers/" + copyId + "/").isNotEqualTo(cover);

        // Forfatteren fjerner sitt bilde; kopien beholder sitt.
        mockMvc.perform(delete("/api/programs/" + program + "/cover").header("Authorization", author)).andExpect(status().isNoContent());
        mockMvc.perform(get(copyCover.substring(copyCover.indexOf("/media/")))).andExpect(status().isOk());

        // Sletter mottakeren kopien, forsvinner kopiens bilde.
        mockMvc.perform(delete("/api/programs/" + copyId).header("Authorization", viewer)).andExpect(status().isNoContent());
        mockMvc.perform(get(copyCover.substring(copyCover.indexOf("/media/")))).andExpect(status().isNotFound());
    }
}
