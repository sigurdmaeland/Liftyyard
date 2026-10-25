package no.fitnessapp.workouts.api;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Instant;
import java.util.UUID;
import no.fitnessapp.workouts.application.WorkoutVolume;
import no.fitnessapp.workouts.persistence.WorkoutEntity;

/** Kortform brukt i historikklisten. */
public record WorkoutSummaryResponse(
        UUID id, String name, Instant startedAt, Instant endedAt, Totals totals) {

    public record Totals(int exerciseCount, int completedSetCount, BigDecimal volumeKg) {

        public static Totals of(WorkoutEntity w) {
            int completed = (int) w.getExercises().stream()
                    .flatMap(e -> e.getSets().stream())
                    .filter(s -> s.getCompletedAt() != null)
                    .count();
            return new Totals(
                    w.getExercises().size(), completed, WorkoutVolume.totalKg(w).setScale(2, RoundingMode.HALF_UP));
        }
    }

    public static WorkoutSummaryResponse from(WorkoutEntity w) {
        return new WorkoutSummaryResponse(w.getId(), w.getName(), w.getStartedAt(), w.getEndedAt(), Totals.of(w));
    }
}
