package no.fitnessapp.explore;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.util.List;
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

/** Deling av programmer og rutiner: synlighet, nedlasting (med egne øvelser) og varsler. */
@SpringBootTest(classes = FitnessApplication.class)
@AutoConfigureMockMvc
@ActiveProfiles("local")
@Import({TestcontainersConfiguration.class, TestAuthConfiguration.class})
class SharingApiIT {

    static final String BENCH = "01960000-0000-7000-8000-000000000001";

    @Autowired
    MockMvc mockMvc;

    @Autowired
    TestAuthConfiguration.CapturingMailer mailer;

    record User(String auth, String username) {}

    private User newUser(String firstName) throws Exception {
        String email = "share-" + UUID.randomUUID() + "@example.com";
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

    private ResultActions putJson(User u, String path, String body) throws Exception {
        return mockMvc.perform(put(path).header("Authorization", u.auth()).contentType(MediaType.APPLICATION_JSON).content(body));
    }

    private ResultActions getAs(User u, String path) throws Exception {
        return mockMvc.perform(get(path).header("Authorization", u.auth()));
    }

    private ResultActions download(User u, String kind, String id, UUID copyId) throws Exception {
        return mockMvc.perform(post("/api/explore/" + kind + "/" + id + "/download").header("Authorization", u.auth())
                .contentType(MediaType.APPLICATION_JSON).content("{\"copyId\": \"" + copyId + "\"}"));
    }

    private UUID customExercise(User u, String name) throws Exception {
        UUID id = UUID.randomUUID();
        putJson(u, "/api/exercises/" + id, """
                {"name": "%s", "exerciseType": "WEIGHT_REPS", "equipment": "OTHER", "primaryMuscles": ["CHEST"], "secondaryMuscles": ["TRICEPS"]}
                """.formatted(name)).andExpect(status().isCreated());
        return id;
    }

    private String routineJson(UUID programId, String name, UUID exerciseId, String visibility) {
        return """
                {"programId": %s, "position": 0, "name": "%s", "visibility": %s,
                 "exercises": [{"id": "%s", "exerciseId": "%s", "restSeconds": 90,
                   "sets": [{"id": "%s", "targetReps": 8}, {"id": "%s", "targetReps": 8}]}]}
                """.formatted(programId == null ? "null" : "\"" + programId + "\"", name, visibility == null ? "null" : "\"" + visibility + "\"",
                UUID.randomUUID(), exerciseId, UUID.randomUUID(), UUID.randomUUID());
    }

    @Test
    void publicProgramCanBeFoundAndDownloadedWithCustomExercises() throws Exception {
        User author = newUser("Siri");
        User viewer = newUser("Tor");
        UUID custom = customExercise(author, "Landmine-press");
        UUID program = UUID.randomUUID();
        String name = "Styrke " + UUID.randomUUID().toString().substring(0, 6);

        putJson(author, "/api/programs/" + program, """
                {"name": "%s", "description": "Tre dager", "visibility": "PUBLIC", "level": "BEGINNER", "daysPerWeek": 3}
                """.formatted(name))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.visibility").value("PUBLIC"))
                .andExpect(jsonPath("$.daysPerWeek").value(3));
        putJson(author, "/api/routines/" + UUID.randomUUID(), routineJson(program, "Dag A", custom, null)).andExpect(status().isCreated());

        // Navn uten synlighet beholder synligheten.
        putJson(author, "/api/programs/" + program, "{\"name\": \"" + name + "\"}").andExpect(jsonPath("$.visibility").value("PUBLIC"));

        getAs(viewer, "/api/explore/programs?q=" + name)
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].author.username").value(author.username()))
                .andExpect(jsonPath("$[0].mine").value(false))
                .andExpect(jsonPath("$[0].fromFollowing").value(false))
                .andExpect(jsonPath("$[0].routineCount").value(1));
        getAs(viewer, "/api/users/" + author.username() + "/programs").andExpect(jsonPath("$[0].name").value(name));
        getAs(author, "/api/explore/programs?q=" + name).andExpect(jsonPath("$[0].mine").value(true));

        UUID copyId = UUID.randomUUID();
        String copy = download(viewer, "programs", program.toString(), copyId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.visibility").value("PRIVATE"))
                .andExpect(jsonPath("$.routines[0].exercises[0].exerciseName").value("Landmine-press"))
                .andReturn().getResponse().getContentAsString();
        download(viewer, "programs", program.toString(), copyId).andExpect(status().isOk());

        // Mottakeren har fått sin egen kopi av forfatterens øvelse, og rutinen peker dit.
        String copiedExercise = JsonPath.read(copy, "$.routines[0].exercises[0].exerciseId");
        assertThat(copiedExercise).isNotEqualTo(custom.toString());
        String exercises = getAs(viewer, "/api/exercises").andReturn().getResponse().getContentAsString();
        assertThat(JsonPath.<List<Object>>read(exercises, "$[?(@.id == '" + copiedExercise + "')]")).hasSize(1);

        getAs(viewer, "/api/explore/programs/" + program).andExpect(jsonPath("$.downloadCount").value(1));
        getAs(author, "/api/notifications")
                .andExpect(jsonPath("$[0].type").value("DOWNLOAD"))
                .andExpect(jsonPath("$[0].actor.username").value(viewer.username()))
                .andExpect(jsonPath("$[0].programId").value(program.toString()))
                .andExpect(jsonPath("$[0].targetName").value(name));
    }

    @Test
    void followersRoutineIsOnlyVisibleToFollowers() throws Exception {
        User author = newUser("Mia");
        User viewer = newUser("Even");
        UUID routine = UUID.randomUUID();
        putJson(author, "/api/routines/" + routine, routineJson(null, "Overkropp", UUID.fromString(BENCH), "FOLLOWERS"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.visibility").value("FOLLOWERS"));

        getAs(viewer, "/api/explore/routines/" + routine).andExpect(status().isNotFound());
        getAs(viewer, "/api/users/" + author.username() + "/routines").andExpect(jsonPath("$.length()").value(0));
        download(viewer, "routines", routine.toString(), UUID.randomUUID()).andExpect(status().isNotFound());

        mockMvc.perform(post("/api/users/" + author.username() + "/follow").header("Authorization", viewer.auth())).andExpect(status().isOk());
        getAs(viewer, "/api/explore/routines")
                .andExpect(jsonPath("$[?(@.id == '" + routine + "')].fromFollowing").value(true))
                .andExpect(jsonPath("$[?(@.id == '" + routine + "')].setCount").value(2))
                .andExpect(jsonPath("$[?(@.id == '" + routine + "')].preview[0].name").value("Bench Press"));
        getAs(viewer, "/api/explore/routines/" + routine).andExpect(jsonPath("$.routine.exercises[0].sets.length()").value(2));

        UUID copyId = UUID.randomUUID();
        download(viewer, "routines", routine.toString(), copyId)
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(copyId.toString()))
                .andExpect(jsonPath("$.programId").doesNotExist())
                .andExpect(jsonPath("$.visibility").value("PRIVATE"))
                .andExpect(jsonPath("$.sourceRoutineId").value(routine.toString()))
                .andExpect(jsonPath("$.exercises[0].exerciseId").value(BENCH));
        download(viewer, "routines", routine.toString(), copyId).andExpect(status().isOk());

        // Ny lagring uten synlighet beholder deling og nedlastingstall; PRIVATE skjuler rutinen.
        putJson(author, "/api/routines/" + routine, routineJson(null, "Overkropp 2", UUID.fromString(BENCH), null))
                .andExpect(jsonPath("$.visibility").value("FOLLOWERS"))
                .andExpect(jsonPath("$.downloadCount").value(1));
        putJson(author, "/api/routines/" + routine, routineJson(null, "Overkropp 2", UUID.fromString(BENCH), "PRIVATE"))
                .andExpect(jsonPath("$.visibility").value("PRIVATE"));
        getAs(viewer, "/api/explore/routines/" + routine).andExpect(status().isNotFound());
    }

    @Test
    void copiesCreditTheOriginalAuthorThroughReshares() throws Exception {
        User kari = newUser("Kari");
        User ola = newUser("Ola");
        User per = newUser("Per");
        UUID program = UUID.randomUUID();
        String name = "Original " + UUID.randomUUID().toString().substring(0, 6);
        putJson(kari, "/api/programs/" + program, "{\"name\": \"" + name + "\", \"visibility\": \"PUBLIC\"}").andExpect(status().isCreated());
        putJson(kari, "/api/routines/" + UUID.randomUUID(), routineJson(program, "Dag A", UUID.fromString(BENCH), null)).andExpect(status().isCreated());

        // Ola laster ned, endrer og deler videre.
        UUID olaCopy = UUID.randomUUID();
        download(ola, "programs", program.toString(), olaCopy)
                .andExpect(jsonPath("$.basedOn.id").value(program.toString()))
                .andExpect(jsonPath("$.basedOn.name").value(name))
                .andExpect(jsonPath("$.basedOn.authorUsername").value(kari.username()))
                .andExpect(jsonPath("$.routines[0].basedOn.authorUsername").value(kari.username()));
        String remix = name + " (Olas versjon)";
        putJson(ola, "/api/programs/" + olaCopy, "{\"name\": \"" + remix + "\", \"visibility\": \"PUBLIC\"}")
                .andExpect(jsonPath("$.basedOn.authorUsername").value(kari.username()));

        // Per ser Olas versjon med kreditt til Kari, og laster den ned: kreditten går fortsatt til Kari.
        getAs(per, "/api/explore/programs?q=" + remix)
                .andExpect(jsonPath("$[0].author.username").value(ola.username()))
                .andExpect(jsonPath("$[0].basedOn.authorUsername").value(kari.username()));
        download(per, "programs", olaCopy.toString(), UUID.randomUUID())
                .andExpect(jsonPath("$.basedOn.id").value(program.toString()))
                .andExpect(jsonPath("$.basedOn.authorUsername").value(kari.username()));
        getAs(per, "/api/explore/programs/" + program).andExpect(jsonPath("$.remixCount").value(1));

        // Frittstående rutine: kreditten overlever ny lagring og duplisering.
        UUID routine = UUID.randomUUID();
        putJson(kari, "/api/routines/" + routine, routineJson(null, "Bein", UUID.fromString(BENCH), "PUBLIC")).andExpect(status().isCreated());
        UUID copy = UUID.randomUUID();
        download(ola, "routines", routine.toString(), copy).andExpect(jsonPath("$.basedOn.authorUsername").value(kari.username()));
        putJson(ola, "/api/routines/" + copy, routineJson(null, "Mine bein", UUID.fromString(BENCH), null))
                .andExpect(jsonPath("$.basedOn.id").value(routine.toString()));
        UUID duplicate = UUID.randomUUID();
        putJson(ola, "/api/routines/" + duplicate, routineJson(null, "Mine bein (kopi)", UUID.fromString(BENCH), null)
                        .replace("\"visibility\": null", "\"visibility\": null, \"copiedFromRoutineId\": \"" + copy + "\""))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.basedOn.authorUsername").value(kari.username()));
    }
}
