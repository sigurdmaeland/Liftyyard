package no.fitnessapp.exercises.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.exercises.application.ExerciseService;
import no.fitnessapp.users.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/exercises")
@Tag(name = "Exercises")
public class ExerciseController {

    private final ExerciseService service;
    private final CurrentUser currentUser;

    public ExerciseController(ExerciseService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    /**
     * Hele katalogen brukeren har tilgang til, inkludert egne øvelser og favorittmarkering.
     * Appen lagrer den lokalt og søker offline.
     */
    @GetMapping
    @Operation(summary = "Lister øvelser brukeren har tilgang til")
    public List<ExerciseResponse> list() {
        return service.list(currentUser.requireId());
    }

    @PutMapping("/{id}")
    @Operation(summary = "Oppretter eller oppdaterer en egendefinert øvelse (idempotent)")
    public ResponseEntity<ExerciseResponse> save(@PathVariable UUID id, @Valid @RequestBody ExerciseRequest body) {
        var result = service.save(currentUser.requireId(), id, body);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.exercise());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Arkiverer en egendefinert øvelse (idempotent)")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.archive(currentUser.requireId(), id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/favorite")
    public ResponseEntity<Void> favorite(@PathVariable UUID id) {
        service.setFavorite(currentUser.requireId(), id, true);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/favorite")
    public ResponseEntity<Void> unfavorite(@PathVariable UUID id) {
        service.setFavorite(currentUser.requireId(), id, false);
        return ResponseEntity.noContent().build();
    }
}
