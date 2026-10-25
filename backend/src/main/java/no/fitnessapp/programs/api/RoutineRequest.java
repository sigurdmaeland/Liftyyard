package no.fitnessapp.programs.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.programs.domain.Visibility;
import no.fitnessapp.workouts.domain.SetType;

/**
 * Hele rutinen sendes samlet (øvelser → målsett). programId er null for frittstående rutiner.
 * copiedFromRoutineId (valgfri, bare ved oppretting): egen rutine dette er en duplikat av; kreditten følges med.
 * visibility gjelder frittstående rutiner; null beholder lagret verdi (ny rutine: PRIVATE).
 * Rekkefølgen i listene er rekkefølgen i rutinen. ID-er lages av appen, så forespørselen kan gjentas.
 */
public record RoutineRequest(
        UUID programId,
        @Min(0) @Max(1000) Integer position,
        @NotBlank @Size(max = 100) String name,
        @Size(max = 2000) String notes,
        @NotNull @Size(max = 50) List<@NotNull @Valid ExerciseEntry> exercises,
        Visibility visibility,
        UUID copiedFromRoutineId) {

    public record ExerciseEntry(
            @NotNull UUID id,
            @NotNull UUID exerciseId,
            @Size(max = 1000) String notes,
            @Min(0) @Max(3600) Integer restSeconds,
            @NotNull @Size(max = 50) List<@NotNull @Valid SetEntry> sets) {}

    public record SetEntry(
            @NotNull UUID id,
            SetType setType,
            @Min(0) @Max(1000) Integer targetReps,
            @DecimalMin("0") @DecimalMax("2000") BigDecimal targetWeightKg,
            @Min(0) @Max(86400) Integer targetDurationSeconds) {}
}
