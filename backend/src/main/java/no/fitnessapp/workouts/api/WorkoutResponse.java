package no.fitnessapp.workouts.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.exercises.domain.ExerciseType;
import no.fitnessapp.workouts.domain.SetType;
import no.fitnessapp.workouts.persistence.WorkoutEntity;
import no.fitnessapp.workouts.persistence.WorkoutExerciseEntity;
import no.fitnessapp.workouts.persistence.WorkoutSetEntity;

public record WorkoutResponse(
        UUID id,
        String name,
        String description,
        String notes,
        Integer perceivedEffort,
        UUID sourceRoutineId,
        Instant startedAt,
        Instant endedAt,
        Instant createdAt,
        Instant updatedAt,
        WorkoutSummaryResponse.Totals totals,
        List<ExerciseItem> exercises,
        String visibility) {

    public record ExerciseItem(
            UUID id, UUID exerciseId, String exerciseName, ExerciseType exerciseType, String notes,
            List<SetItem> sets, Integer supersetGroup) {}

    public record SetItem(
            UUID id, SetType setType, BigDecimal weightKg, Integer reps, BigDecimal rpe,
            Integer durationSeconds, BigDecimal distanceM, Instant completedAt) {}

    public static WorkoutResponse from(WorkoutEntity w) {
        return new WorkoutResponse(
                w.getId(), w.getName(), w.getDescription(), w.getNotes(), w.getPerceivedEffort(), w.getSourceRoutineId(),
                w.getStartedAt(), w.getEndedAt(),
                w.getCreatedAt(), w.getUpdatedAt(),
                WorkoutSummaryResponse.Totals.of(w),
                w.getExercises().stream().map(WorkoutResponse::exercise).toList(),
                w.getVisibility());
    }

    private static ExerciseItem exercise(WorkoutExerciseEntity e) {
        return new ExerciseItem(
                e.getId(), e.getExerciseId(), e.getExerciseName(), e.getExerciseType(), e.getNotes(),
                e.getSets().stream().map(WorkoutResponse::set).toList(), e.getSupersetGroup());
    }

    private static SetItem set(WorkoutSetEntity s) {
        return new SetItem(
                s.getId(), s.getSetType(), s.getWeightKg(), s.getReps(), s.getRpe(),
                s.getDurationSeconds(), s.getDistanceM(), s.getCompletedAt());
    }
}
