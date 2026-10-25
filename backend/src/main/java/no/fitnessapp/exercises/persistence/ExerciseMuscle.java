package no.fitnessapp.exercises.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import java.util.Objects;
import no.fitnessapp.exercises.domain.Muscle;
import no.fitnessapp.exercises.domain.MuscleRole;

@Embeddable
public class ExerciseMuscle {

    @Enumerated(EnumType.STRING)
    @Column(name = "muscle", nullable = false)
    private Muscle muscle;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false)
    private MuscleRole role;

    protected ExerciseMuscle() {}

    public ExerciseMuscle(Muscle muscle, MuscleRole role) {
        this.muscle = muscle;
        this.role = role;
    }

    public Muscle getMuscle() {
        return muscle;
    }

    public MuscleRole getRole() {
        return role;
    }

    @Override
    public boolean equals(Object o) {
        return o instanceof ExerciseMuscle other && muscle == other.muscle && role == other.role;
    }

    @Override
    public int hashCode() {
        return Objects.hash(muscle, role);
    }
}
