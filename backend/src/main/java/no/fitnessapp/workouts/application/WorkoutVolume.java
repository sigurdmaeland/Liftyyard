package no.fitnessapp.workouts.application;

import java.math.BigDecimal;
import no.fitnessapp.workouts.domain.SetType;
import no.fitnessapp.workouts.persistence.WorkoutEntity;
import no.fitnessapp.workouts.persistence.WorkoutSetEntity;

/**
 * Volum = summen av vekt (kg) × reps for fullførte sett som ikke er oppvarming.
 * Sett uten vekt eller reps bidrar ikke. Definisjonen er dokumentert i docs/database-schema.md.
 */
public final class WorkoutVolume {

    private WorkoutVolume() {}

    public static boolean countsTowardsVolume(WorkoutSetEntity set) {
        return set.getCompletedAt() != null
                && set.getSetType() != SetType.WARMUP
                && set.getWeightKg() != null
                && set.getReps() != null;
    }

    public static BigDecimal totalKg(WorkoutEntity workout) {
        return workout.getExercises().stream()
                .flatMap(e -> e.getSets().stream())
                .filter(WorkoutVolume::countsTowardsVolume)
                .map(s -> s.getWeightKg().multiply(BigDecimal.valueOf(s.getReps())))
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
}
