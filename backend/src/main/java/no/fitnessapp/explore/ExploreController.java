package no.fitnessapp.explore;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.programs.api.ProgramResponse;
import no.fitnessapp.programs.api.RoutineResponse;
import no.fitnessapp.social.FollowService;
import no.fitnessapp.users.CurrentUser;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Community: delte programmer og rutiner som kan lastes ned (kopieres) til eget bibliotek. */
@RestController
@Tag(name = "Explore")
public class ExploreController {

    private final ExploreService service;
    private final FollowService follows;
    private final CurrentUser currentUser;

    public ExploreController(ExploreService service, FollowService follows, CurrentUser currentUser) {
        this.service = service;
        this.follows = follows;
        this.currentUser = currentUser;
    }

    @GetMapping("/api/explore/programs")
    @Operation(summary = "Delte programmer brukeren kan se, mest lastet ned først (q søker i navnet)")
    public List<ExploreProgramResponse> programs(@RequestParam(required = false) String q) {
        return service.listPrograms(currentUser.requireId(), q);
    }

    @GetMapping("/api/explore/programs/{id}")
    @Operation(summary = "Ett delt program med rutiner")
    public ExploreProgramResponse program(@PathVariable UUID id) {
        return service.getProgram(currentUser.requireId(), id);
    }

    @PostMapping("/api/explore/programs/{id}/download")
    @Operation(summary = "Kopierer programmet til brukerens bibliotek (idempotent på copyId)")
    public ProgramResponse download(@PathVariable UUID id, @Valid @RequestBody DownloadRequest body) {
        return service.downloadProgram(currentUser.requireId(), id, body.copyId());
    }

    @GetMapping("/api/explore/routines")
    @Operation(summary = "Delte frittstående rutiner brukeren kan se, mest lastet ned først (q søker i navnet)")
    public List<ExploreRoutineResponse> routines(@RequestParam(required = false) String q) {
        return service.listRoutines(currentUser.requireId(), q);
    }

    @GetMapping("/api/explore/routines/{id}")
    @Operation(summary = "Én delt rutine med øvelser og målsett")
    public ExploreRoutineResponse routine(@PathVariable UUID id) {
        return service.getRoutine(currentUser.requireId(), id);
    }

    @PostMapping("/api/explore/routines/{id}/download")
    @Operation(summary = "Kopierer rutinen til brukerens bibliotek som frittstående rutine (idempotent på copyId)")
    public RoutineResponse downloadRoutine(@PathVariable UUID id, @Valid @RequestBody DownloadRequest body) {
        return service.downloadRoutine(currentUser.requireId(), id, body.copyId());
    }

    @GetMapping("/api/users/{username}/programs")
    @Operation(summary = "Programmer brukeren har delt og som innlogget bruker kan se")
    public List<ExploreProgramResponse> programsBy(@PathVariable String username) {
        UUID viewer = currentUser.requireId();
        return service.programsBy(viewer, follows.requireVisibleUserId(viewer, username));
    }

    @GetMapping("/api/users/{username}/routines")
    @Operation(summary = "Frittstående rutiner brukeren har delt og som innlogget bruker kan se")
    public List<ExploreRoutineResponse> routinesBy(@PathVariable String username) {
        UUID viewer = currentUser.requireId();
        return service.routinesBy(viewer, follows.requireVisibleUserId(viewer, username));
    }
}
