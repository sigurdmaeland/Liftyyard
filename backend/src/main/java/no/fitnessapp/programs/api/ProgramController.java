package no.fitnessapp.programs.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.programs.application.ProgramService;
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
@RequestMapping("/api/programs")
@Tag(name = "Programs")
public class ProgramController {

    private final ProgramService service;
    private final CurrentUser currentUser;

    public ProgramController(ProgramService service, CurrentUser currentUser) {
        this.service = service;
        this.currentUser = currentUser;
    }

    @PutMapping("/{id}")
    @Operation(summary = "Oppretter eller oppdaterer et program (navn og beskrivelse, idempotent)")
    public ResponseEntity<ProgramResponse> save(@PathVariable UUID id, @Valid @RequestBody ProgramRequest body) {
        var result = service.save(currentUser.requireId(), id, body);
        return ResponseEntity.status(result.created() ? HttpStatus.CREATED : HttpStatus.OK).body(result.program());
    }

    @GetMapping("/{id}")
    @Operation(summary = "Henter ett program med rutinene i det")
    public ProgramResponse get(@PathVariable UUID id) {
        return service.get(currentUser.requireId(), id);
    }

    @GetMapping
    @Operation(summary = "Brukerens programmer, sist endret først")
    public List<ProgramSummaryResponse> list() {
        return service.list(currentUser.requireId());
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Sletter et program og rutinene i det (idempotent)")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(currentUser.requireId(), id);
        return ResponseEntity.noContent().build();
    }
}
