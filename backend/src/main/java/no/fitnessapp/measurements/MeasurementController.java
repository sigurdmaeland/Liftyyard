package no.fitnessapp.measurements;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.users.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

@RestController
@Tag(name = "Measurements")
public class MeasurementController {

    private final MeasurementStore store;
    private final CurrentUser currentUser;

    public MeasurementController(MeasurementStore store, CurrentUser currentUser) {
        this.store = store;
        this.currentUser = currentUser;
    }

    @PutMapping("/api/measurements/{id}")
    @Operation(summary = "Lagrer en kroppsmåling (idempotent)")
    public MeasurementResponse save(@PathVariable UUID id, @Valid @RequestBody MeasurementRequest body) {
        return store.save(currentUser.requireId(), id, body);
    }

    @GetMapping("/api/measurements")
    @Operation(summary = "Alle brukerens målinger, nyeste først")
    public List<MeasurementResponse> list() {
        return store.list(currentUser.requireId());
    }

    @DeleteMapping("/api/measurements/{id}")
    public ResponseEntity<Void> delete(@PathVariable UUID id) {
        store.delete(currentUser.requireId(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/settings")
    public SettingsDto settings() {
        return store.settings(currentUser.requireId());
    }

    @PutMapping("/api/settings")
    @Operation(summary = "Lagrer brukerinnstillinger (vektmål)")
    public SettingsDto saveSettings(@Valid @RequestBody SettingsDto body) {
        return store.saveSettings(currentUser.requireId(), body);
    }
}
