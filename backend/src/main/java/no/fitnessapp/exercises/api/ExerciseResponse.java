package no.fitnessapp.exercises.api;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.exercises.domain.Equipment;
import no.fitnessapp.exercises.domain.ExerciseType;
import no.fitnessapp.exercises.domain.Muscle;
import no.fitnessapp.exercises.domain.MuscleRole;
import no.fitnessapp.exercises.persistence.ExerciseEntity;
import no.fitnessapp.exercises.persistence.ExerciseMuscle;

public record ExerciseResponse(
        UUID id,
        String name,
        ExerciseType exerciseType,
        Equipment equipment,
        List<Muscle> primaryMuscles,
        List<Muscle> secondaryMuscles,
        String instructions,
        boolean custom,
        boolean favorite,
        Instant updatedAt) {

    public static ExerciseResponse from(ExerciseEntity e, boolean favorite) {
        return new ExerciseResponse(
                e.getId(),
                e.getName(),
                e.getExerciseType(),
                e.getEquipment(),
                muscles(e, MuscleRole.PRIMARY),
                muscles(e, MuscleRole.SECONDARY),
                e.getInstructions(),
                e.getOwnerUserId() != null,
                favorite,
                e.getUpdatedAt());
    }

    private static List<Muscle> muscles(ExerciseEntity e, MuscleRole role) {
        return e.getMuscles().stream()
                .filter(m -> m.getRole() == role)
                .map(ExerciseMuscle::getMuscle)
                .sorted(Comparator.naturalOrder())
                .toList();
    }
}
