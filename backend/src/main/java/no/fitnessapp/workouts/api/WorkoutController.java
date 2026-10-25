package no.fitnessapp.workouts.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import java.util.UUID;
import no.fitnessapp.common.PageResponse;
import no.fitnessapp.social.InteractionService;
import no.fitnessapp.users.CurrentUser;
import no.fitnessapp.workouts.application.WorkoutService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/workouts")
@Tag(name = "Workouts")
public class WorkoutController {

    private final WorkoutService service;
    private final CurrentUser currentUser;
    private final InteractionService interactions;

    public WorkoutController(WorkoutService service, CurrentUser currentUser, InteractionService interactions) {
        this.service = service;
        this.currentUser = currentUser;
        this.interactions = interactions;
    }

    @PutMapping("/{id}")
    @Operation(summary = "Lagrer en fullført økt (oppretter eller erstatter, idempotent)")
    public ResponseEntity<WorkoutResponse> save(@PathVariable UUID id, @Valid @RequestBody WorkoutRequest body) {
        var result = service.save(currentUser.requireId(), id, body);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.workout());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Henter én økt med øvelser og sett")
    public WorkoutResponse get(@PathVariable UUID id) {
        return service.get(currentUser.requireId(), id);
    }

    @GetMapping
    @Operation(summary = "Historikk: økter sortert med nyeste først")
    public PageResponse<WorkoutSummaryResponse> list(
            @RequestParam(defaultValue = "0") @Min(0) int page,
            @RequestParam(defaultValue = "20") @Min(1) @Max(100) int size) {
        return service.list(currentUser.requireId(), page, size);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Sletter en økt (idempotent)")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        interactions.deletePhotoFilesForWorkout(currentUser.requireId(), id);
        service.delete(currentUser.requireId(), id);
        return ResponseEntity.noContent().build();
    }
}
