package no.fitnessapp.workouts.api;

import jakarta.validation.Valid;
import jakarta.validation.constraints.AssertTrue;
import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.workouts.domain.SetType;

/**
 * Hele økten sendes samlet. Rekkefølgen i listene er rekkefølgen i økten.
 * Alle ID-er lages av appen, slik at samme forespørsel kan sendes flere ganger trygt.
 * notes er private notater; description kan deles når community kommer.
 */
public record WorkoutRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 2000) String description,
        @Size(max = 2000) String notes,
        @Min(1) @Max(10) Integer perceivedEffort,
        UUID sourceRoutineId,
        @NotNull Instant startedAt,
        @NotNull Instant endedAt,
        @NotNull @Size(max = 50) List<@NotNull @Valid ExerciseEntry> exercises,
        /** PUBLIC, FOLLOWERS eller PRIVATE. null = beholder nåværende (FOLLOWERS for nye økter). */
        @Pattern(regexp = "PUBLIC|FOLLOWERS|PRIVATE") String visibility) {

    @AssertTrue(message = "endedAt kan ikke være før startedAt")
    public boolean isEndedAfterStarted() {
        return startedAt == null || endedAt == null || !endedAt.isBefore(startedAt);
    }

    public record ExerciseEntry(
            @NotNull UUID id,
            @NotNull UUID exerciseId,
            @Size(max = 1000) String notes,
            @NotNull @Size(max = 50) List<@NotNull @Valid SetEntry> sets,
            /** Samme tall på flere øvelser = supersett. null = vanlig øvelse. */
            @jakarta.validation.constraints.Min(1) @jakarta.validation.constraints.Max(50) Integer supersetGroup) {}

    public record SetEntry(
            @NotNull UUID id,
            SetType setType,
            @DecimalMin("0") @DecimalMax("2000") BigDecimal weightKg,
            @Min(0) @Max(1000) Integer reps,
            @DecimalMin("1") @DecimalMax("10") BigDecimal rpe,
            @Min(0) @Max(86400) Integer durationSeconds,
            @DecimalMin("0") @DecimalMax("1000000") BigDecimal distanceM,
            Instant completedAt) {}
}
