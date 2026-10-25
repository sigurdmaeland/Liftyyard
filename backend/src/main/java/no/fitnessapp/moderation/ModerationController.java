package no.fitnessapp.moderation;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import no.fitnessapp.social.BlockService;
import no.fitnessapp.social.UserSummary;
import no.fitnessapp.users.CurrentUser;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

/** Trygghet: blokkering, rapportering og moderering. */
@RestController
@Tag(name = "Safety")
public class ModerationController {

    public record ReportRequest(
            @NotNull UUID id,
            @NotNull ReportService.TargetType targetType,
            @NotNull UUID targetId,
            @NotNull ReportService.Reason reason,
            @Size(max = 1000) String details) {}

    public record ResolveRequest(@NotNull ModerationService.Action action, @Size(max = 1000) String note) {}

    private final ReportService reports;
    private final ModerationService moderation;
    private final BlockService blocks;
    private final CurrentUser currentUser;

    public ModerationController(ReportService reports, ModerationService moderation, BlockService blocks, CurrentUser currentUser) {
        this.reports = reports;
        this.moderation = moderation;
        this.blocks = blocks;
        this.currentUser = currentUser;
    }

    @PostMapping("/api/reports")
    @Operation(summary = "Rapporterer en bruker, økt, kommentar, program eller rutine (idempotent på id)")
    public ResponseEntity<Map<String, String>> report(@Valid @RequestBody ReportRequest body) {
        reports.report(currentUser.requireId(), body.id(), body.targetType(), body.targetId(), body.reason(), body.details());
        return ResponseEntity.status(HttpStatus.ACCEPTED).body(Map.of("status", "RECEIVED"));
    }

    @PutMapping("/api/users/{username}/block")
    @Operation(summary = "Blokkerer brukeren (idempotent). Fjerner følging begge veier.")
    public ResponseEntity<Void> block(@PathVariable String username) {
        blocks.block(currentUser.requireId(), username);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/users/{username}/block")
    @Operation(summary = "Opphever blokkeringen (idempotent)")
    public ResponseEntity<Void> unblock(@PathVariable String username) {
        blocks.unblock(currentUser.requireId(), username);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/me/blocks")
    @Operation(summary = "Brukere du har blokkert")
    public List<UserSummary> blocked() {
        return blocks.blocked(currentUser.requireId());
    }

    @GetMapping("/api/moderation/reports")
    @Operation(summary = "Rapporter (bare moderatorer). status: OPEN (standard), RESOLVED eller DISMISSED")
    public List<ModerationService.ReportItem> list(@RequestParam(required = false) String status) {
        return moderation.list(currentUser.requireId(), status);
    }

    @PostMapping("/api/moderation/reports/{id}/resolve")
    @Operation(summary = "Behandler en rapport (og alle åpne rapporter på samme innhold)")
    public ResponseEntity<Void> resolve(@PathVariable UUID id, @Valid @RequestBody ResolveRequest body) {
        moderation.resolve(currentUser.requireId(), id, body.action(), body.note());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/moderation/users/{userId}/suspension")
    @Operation(summary = "Opphever sperring av en konto")
    public ResponseEntity<Void> unsuspend(@PathVariable UUID userId) {
        moderation.unsuspend(currentUser.requireId(), userId);
        return ResponseEntity.noContent().build();
    }
}
