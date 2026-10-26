package no.fitnessapp.programs.api;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import java.io.IOException;
import java.util.Map;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.programs.application.ProgramCoverService;
import no.fitnessapp.programs.application.ProgramService;
import no.fitnessapp.users.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/programs")
@Tag(name = "Programs")
public class ProgramController {

    private final ProgramService service;
    private final ProgramCoverService covers;
    private final CurrentUser currentUser;

    public ProgramController(ProgramService service, ProgramCoverService covers, CurrentUser currentUser) {
        this.service = service;
        this.covers = covers;
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

    @RequestMapping(path = "/{id}/cover", method = {RequestMethod.PUT, RequestMethod.POST}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Laster opp forsidebilde for et eget program (multipart, felt «file», JPEG eller PNG, maks 10 MB)")
    public Map<String, String> uploadCover(@PathVariable UUID id, @RequestPart("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) throw new BadRequestException("Tom fil");
        return Map.of("coverUrl", covers.replace(currentUser.requireId(), id, file.getBytes()));
    }

    @DeleteMapping("/{id}/cover")
    @Operation(summary = "Fjerner forsidebildet (idempotent)")
    public ResponseEntity<Void> removeCover(@PathVariable UUID id) {
        covers.remove(currentUser.requireId(), id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Sletter et program og rutinene i det (idempotent)")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        service.delete(currentUser.requireId(), id);
        return ResponseEntity.noContent().build();
    }
}
