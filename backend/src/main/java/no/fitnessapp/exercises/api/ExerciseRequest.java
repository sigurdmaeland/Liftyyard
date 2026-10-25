package no.fitnessapp.exercises.api;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.util.List;
import no.fitnessapp.exercises.domain.Equipment;
import no.fitnessapp.exercises.domain.ExerciseType;
import no.fitnessapp.exercises.domain.Muscle;

/** Egendefinert øvelse. En muskel kan ikke være både primær og sekundær. */
public record ExerciseRequest(
        @NotBlank @Size(max = 100) String name,
        @NotNull ExerciseType exerciseType,
        @NotNull Equipment equipment,
        @Size(max = 4000) String instructions,
        @NotNull @Size(max = 17) List<@NotNull Muscle> primaryMuscles,
        @NotNull @Size(max = 17) List<@NotNull Muscle> secondaryMuscles) {}
