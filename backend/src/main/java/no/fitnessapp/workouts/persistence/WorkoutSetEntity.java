package no.fitnessapp.workouts.persistence;

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
import java.time.Instant;
import java.util.UUID;
import no.fitnessapp.workouts.domain.SetType;

@Entity
@Table(name = "workout_sets")
public class WorkoutSetEntity {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workout_exercise_id", nullable = false)
    private WorkoutExerciseEntity workoutExercise;

    @Column(nullable = false)
    private int position;

    @Enumerated(EnumType.STRING)
    @Column(name = "set_type", nullable = false)
    private SetType setType;

    @Column(name = "weight_kg", precision = 7, scale = 2)
    private BigDecimal weightKg;

    private Integer reps;

    @Column(precision = 3, scale = 1)
    private BigDecimal rpe;

    @Column(name = "duration_seconds")
    private Integer durationSeconds;

    @Column(name = "distance_m", precision = 9, scale = 2)
    private BigDecimal distanceM;

    @Column(name = "completed_at")
    private Instant completedAt;

    protected WorkoutSetEntity() {}

    public WorkoutSetEntity(
            UUID id, int position, SetType setType, BigDecimal weightKg, Integer reps, BigDecimal rpe,
            Integer durationSeconds, BigDecimal distanceM, Instant completedAt) {
        this.id = id;
        this.position = position;
        this.setType = setType;
        this.weightKg = weightKg;
        this.reps = reps;
        this.rpe = rpe;
        this.durationSeconds = durationSeconds;
        this.distanceM = distanceM;
        this.completedAt = completedAt;
    }

    void attachTo(WorkoutExerciseEntity workoutExercise) {
        this.workoutExercise = workoutExercise;
    }

    public UUID getId() {
        return id;
    }

    public int getPosition() {
        return position;
    }

    public SetType getSetType() {
        return setType;
    }

    public BigDecimal getWeightKg() {
        return weightKg;
    }

    public Integer getReps() {
        return reps;
    }

    public BigDecimal getRpe() {
        return rpe;
    }

    public Integer getDurationSeconds() {
        return durationSeconds;
    }

    public BigDecimal getDistanceM() {
        return distanceM;
    }

    public Instant getCompletedAt() {
        return completedAt;
    }
}
