package no.fitnessapp.programs.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.programs.application.RoutineService;
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
@RequestMapping("/api/routines")
@Tag(name = "Routines")
public class RoutineController {

    private final RoutineService service;
    private final CurrentUser currentUser;

    public RoutineController(RoutineService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @PutMapping("/{id}")
    @Operation(summary = "Lagrer en rutine med øvelser og målsett (oppretter eller erstatter, idempotent)")
    public ResponseEntity<RoutineResponse> save(@PathVariable UUID id, @Valid @RequestBody RoutineRequest body) {
        var result = service.save(currentUser.requireId(), id, body);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.routine());
    }

    @GetMapping("/{id}")
    public RoutineResponse get(@PathVariable UUID id) {
        return service.get(currentUser.requireId(), id);
    }

    @GetMapping
    @Operation(summary = "Alle brukerens rutiner, sist endret først")
    public List<RoutineResponse> list() {
        return service.list(currentUser.requireId());
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(currentUser.requireId(), id);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/{id}/favorite")
    @Operation(summary = "Legger rutinen i favoritter (idempotent)")
    public ResponseEntity<Void> favorite(@PathVariable UUID id) {
        service.setFavorite(currentUser.requireId(), id, true);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}/favorite")
    @Operation(summary = "Fjerner rutinen fra favoritter (idempotent)")
    public ResponseEntity<Void> unfavorite(@PathVariable UUID id) {
        service.setFavorite(currentUser.requireId(), id, false);
        return ResponseEntity.noContent().build();
    }
}
