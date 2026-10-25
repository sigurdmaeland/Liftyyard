package no.fitnessapp.programs.api;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.exercises.domain.ExerciseType;
import no.fitnessapp.programs.domain.Visibility;
import no.fitnessapp.programs.persistence.RoutineEntity;
import no.fitnessapp.programs.persistence.RoutineExerciseEntity;
import no.fitnessapp.programs.persistence.RoutineSetEntity;
import no.fitnessapp.workouts.domain.SetType;

public record RoutineResponse(
        UUID id,
        UUID programId,
        int position,
        String name,
        String notes,
        boolean favorite,
        Visibility visibility,
        int downloadCount,
        UUID sourceRoutineId,
        Credit basedOn,
        Instant createdAt,
        Instant updatedAt,
        List<Exercise> exercises) {

    public record Exercise(
            UUID id, UUID exerciseId, String exerciseName, ExerciseType exerciseType, String notes,
            Integer restSeconds, List<TargetSet> sets) {}

    public record TargetSet(
            UUID id, SetType setType, Integer targetReps, BigDecimal targetWeightKg, Integer targetDurationSeconds) {}

    public static RoutineResponse from(RoutineEntity r, boolean favorite, Credit basedOn) {
        return new RoutineResponse(
                r.getId(), r.getProgramId(), r.getPosition(), r.getName(), r.getNotes(), favorite,
                r.getVisibility(), r.getDownloadCount(), r.getSourceRoutineId(), basedOn,
                r.getCreatedAt(), r.getUpdatedAt(), r.getExercises().stream().map(RoutineResponse::exercise).toList());
    }

    private static Exercise exercise(RoutineExerciseEntity e) {
        return new Exercise(
                e.getId(), e.getExerciseId(), e.getExerciseName(), e.getExerciseType(), e.getNotes(), e.getRestSeconds(),
                e.getSets().stream().map(RoutineResponse::set).toList());
    }

    private static TargetSet set(RoutineSetEntity s) {
        return new TargetSet(s.getId(), s.getSetType(), s.getTargetReps(), s.getTargetWeightKg(), s.getTargetDurationSeconds());
    }
}
