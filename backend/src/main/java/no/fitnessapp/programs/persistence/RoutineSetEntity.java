package no.fitnessapp.programs.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import java.math.BigDecimal;
import java.util.UUID;
import no.fitnessapp.workouts.domain.SetType;

/** Et målsett i en rutine (f.eks. 3 × 8 reps). */
@Entity
@Table(name = "routine_sets")
public class RoutineSetEntity {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "routine_exercise_id", nullable = false)
    private RoutineExerciseEntity routineExercise;

    @Column(nullable = false)
    private int position;

    @Enumerated(EnumType.STRING)
    @Column(name = "set_type", nullable = false)
    private SetType setType;

    @Column(name = "target_reps")
    private Integer targetReps;

    @Column(name = "target_weight_kg", precision = 7, scale = 2)
    private BigDecimal targetWeightKg;

    @Column(name = "target_duration_seconds")
    private Integer targetDurationSeconds;

    protected RoutineSetEntity() {}

    public RoutineSetEntity(
            UUID id, int position, SetType setType, Integer targetReps, BigDecimal targetWeightKg,
            Integer targetDurationSeconds) {
        this.id = id;
        this.position = position;
        this.setType = setType;
        this.targetReps = targetReps;
        this.targetWeightKg = targetWeightKg;
        this.targetDurationSeconds = targetDurationSeconds;
    }

    void attachTo(RoutineExerciseEntity routineExercise) {
        this.routineExercise = routineExercise;
    }

    public UUID getId() { return id; }
    public int getPosition() { return position; }
    public SetType getSetType() { return setType; }
    public Integer getTargetReps() { return targetReps; }
    public BigDecimal getTargetWeightKg() { return targetWeightKg; }
    public Integer getTargetDurationSeconds() { return targetDurationSeconds; }
}
