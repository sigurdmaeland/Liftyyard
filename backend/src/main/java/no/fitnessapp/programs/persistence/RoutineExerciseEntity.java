package no.fitnessapp.programs.persistence;

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

@Entity
@Table(name = "routine_exercises")
public class RoutineExerciseEntity {

    @Id
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "routine_id", nullable = false)
    private RoutineEntity routine;

    @Column(nullable = false)
    private int position;

    @Column(name = "exercise_id")
    private UUID exerciseId;

    @Column(name = "exercise_name", nullable = false)
    private String exerciseName;

    @Enumerated(EnumType.STRING)
    @Column(name = "exercise_type", nullable = false)
    private ExerciseType exerciseType;

    private String notes;

    @Column(name = "rest_seconds")
    private Integer restSeconds;

    @OneToMany(mappedBy = "routineExercise", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    private List<RoutineSetEntity> sets = new ArrayList<>();

    protected RoutineExerciseEntity() {}

    public RoutineExerciseEntity(
            UUID id, int position, UUID exerciseId, String exerciseName, ExerciseType exerciseType,
            String notes, Integer restSeconds) {
        this.id = id;
        this.position = position;
        this.exerciseId = exerciseId;
        this.exerciseName = exerciseName;
        this.exerciseType = exerciseType;
        this.notes = notes;
        this.restSeconds = restSeconds;
    }

    void attachTo(RoutineEntity routine) {
        this.routine = routine;
    }

    public void addSet(RoutineSetEntity set) {
        set.attachTo(this);
        sets.add(set);
    }

    public UUID getId() { return id; }
    public int getPosition() { return position; }
    public UUID getExerciseId() { return exerciseId; }
    public String getExerciseName() { return exerciseName; }
    public ExerciseType getExerciseType() { return exerciseType; }
    public String getNotes() { return notes; }
    public Integer getRestSeconds() { return restSeconds; }
    public List<RoutineSetEntity> getSets() { return sets; }
}
