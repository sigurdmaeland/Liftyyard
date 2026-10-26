package no.fitnessapp.feedback;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.users.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Feedback")
public class FeedbackController {

    public record FeedbackRequest(
            @NotNull UUID id,
            @NotNull FeedbackService.Kind kind,
            @NotBlank @Size(max = 4000) String message,
            @Size(max = 50) String appVersion,
            @Size(max = 50) String platform) {}

    private final FeedbackService feedback;
    private final CurrentUser currentUser;

    public FeedbackController(FeedbackService feedback, CurrentUser currentUser) {
        this.feedback = feedback;
        this.currentUser = currentUser;
    }

    @PostMapping("/api/feedback")
    @Operation(summary = "Sender en feilmelding, et forslag eller et spørsmål til support (idempotent på id)")
    public ResponseEntity<Void> submit(@Valid @RequestBody FeedbackRequest body) {
        feedback.submit(currentUser.requireId(), body.id(), body.kind(), body.message(), body.appVersion(), body.platform());
        return ResponseEntity.accepted().build();
    }

    @GetMapping("/api/moderation/feedback")
    @Operation(summary = "Tilbakemeldinger (bare moderatorer). status: OPEN (standard) eller DONE")
    public List<FeedbackService.Item> list(@RequestParam(required = false) String status) {
        return feedback.list(currentUser.requireId(), status);
    }

    @PostMapping("/api/moderation/feedback/{id}/done")
    @Operation(summary = "Markerer en tilbakemelding som behandlet")
    public ResponseEntity<Void> done(@PathVariable UUID id) {
        feedback.markDone(currentUser.requireId(), id);
        return ResponseEntity.noContent().build();
    }
}
