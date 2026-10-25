package no.fitnessapp.diagnostics;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import no.fitnessapp.users.CurrentUser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/**
 * Enkel feilrapportering fra appen: uventede feil logges på serveren (med bruker-ID, ikke
 * personopplysninger), så vi ser krasj før brukerne melder dem. Maks 20 rapporter per bruker
 * per time. Kan byttes ut med Sentry eller lignende senere.
 */
@RestController
@Tag(name = "Diagnostics")
public class ClientErrorController {

    private static final Logger log = LoggerFactory.getLogger("client-errors");
    private static final int MAX_PER_HOUR = 20;

    public record ClientError(
            @NotBlank @Size(max = 500) String message,
            @Size(max = 4000) String stack,
            @Size(max = 200) String screen,
            @Size(max = 50) String appVersion,
            @Size(max = 50) String platform) {}

    private record Window(Instant start, int count) {}

    private final Map<UUID, Window> windows = new ConcurrentHashMap<>();
    private final CurrentUser currentUser;

    public ClientErrorController(CurrentUser currentUser) {
        this.currentUser = currentUser;
    }

    @PostMapping("/api/client-errors")
    @Operation(summary = "Rapporterer en uventet feil i appen (logges på serveren)")
    public ResponseEntity<Void> report(@Valid @RequestBody ClientError e) {
        UUID user = currentUser.requireId();
        Instant now = Instant.now();
        Window w = windows.compute(user, (k, old) ->
                old == null || old.start().isBefore(now.minusSeconds(3600)) ? new Window(now, 1) : new Window(old.start(), old.count() + 1));
        if (w.count() <= MAX_PER_HOUR) {
            log.warn("Feil i appen: user={} platform={} version={} screen={} message={}\n{}", user, e.platform(), e.appVersion(), e.screen(),
                    e.message(), e.stack() == null ? "" : e.stack());
        }
        return ResponseEntity.accepted().build();
    }
}
