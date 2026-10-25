package no.fitnessapp.workouts.persistence;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.exercises.domain.ExerciseType;

/** En øvelse slik den ble gjennomført i en økt (øyeblikksbilde av navn og type). */
@Entity
@Table(name = "workout_exercises")
public class WorkoutExerciseEntity {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "workout_id", nullable = false)
    private WorkoutEntity workout;

    @Column(nullable = false)
    private int position;

    /** Referanse til biblioteket. Kan bli null hvis øvelsen slettes; navnet under består. */
    @Column(name = "exercise_id")
    private UUID exerciseId;

    @Column(name = "exercise_name", nullable = false)
    private String exerciseName;

    @Enumerated(EnumType.STRING)
    @Column(name = "exercise_type", nullable = false)
    private ExerciseType exerciseType;

    private String notes;

    /** Samme tall på flere øvelser i økten betyr supersett. */
    @Column(name = "superset_group", columnDefinition = "smallint")
    @org.hibernate.annotations.JdbcTypeCode(java.sql.Types.SMALLINT)
    private Integer supersetGroup;

    @OneToMany(mappedBy = "workoutExercise", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    private List<WorkoutSetEntity> sets = new ArrayList<>();

    protected WorkoutExerciseEntity() {}

    public WorkoutExerciseEntity(
            UUID id, int position, UUID exerciseId, String exerciseName, ExerciseType exerciseType, String notes) {
        this.id = id;
        this.position = position;
        this.exerciseId = exerciseId;
        this.exerciseName = exerciseName;
        this.exerciseType = exerciseType;
        this.notes = notes;
    }

    public void setSupersetGroup(Integer supersetGroup) {
        this.supersetGroup = supersetGroup;
    }

    public Integer getSupersetGroup() {
        return supersetGroup;
    }

    void attachTo(WorkoutEntity workout) {
        this.workout = workout;
    }

    public void addSet(WorkoutSetEntity set) {
        set.attachTo(this);
        sets.add(set);
    }

    public UUID getId() {
        return id;
    }

    public int getPosition() {
        return position;
    }

    public UUID getExerciseId() {
        return exerciseId;
    }

    public String getExerciseName() {
        return exerciseName;
    }

    public ExerciseType getExerciseType() {
        return exerciseType;
    }

    public String getNotes() {
        return notes;
    }

    public List<WorkoutSetEntity> getSets() {
        return sets;
    }
}
