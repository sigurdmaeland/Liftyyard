package no.fitnessapp.workouts.persistence;

import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/** En fullført økt. Aggregatrot: øvelser og sett lagres og erstattes alltid sammen med økten. */
@Entity
@Table(name = "workouts")
public class WorkoutEntity {

    @Id
    private UUID id;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(nullable = false)
    private String name;

    private String description;

    /** Private notater. */
    private String notes;

    @Column(name = "perceived_effort")
    private Integer perceivedEffort;

    /** Rutinen økten ble startet fra, hvis noen (ingen FK – økten består om rutinen slettes). */
    @Column(name = "source_routine_id")
    private UUID sourceRoutineId;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "ended_at", nullable = false)
    private Instant endedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
    /** PUBLIC, FOLLOWERS (standard) eller PRIVATE. */
    @Column(nullable = false)
    private String visibility;

    @OneToMany(mappedBy = "workout", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    private List<WorkoutExerciseEntity> exercises = new ArrayList<>();

    protected WorkoutEntity() {}

    public WorkoutEntity(
            UUID id, UUID userId, String name, String description, String notes, Integer perceivedEffort,
            UUID sourceRoutineId, Instant startedAt, Instant endedAt, Instant createdAt, Instant updatedAt, String visibility) {
        this.visibility = visibility;
        this.sourceRoutineId = sourceRoutineId;
        this.id = id;
        this.userId = userId;
        this.name = name;
        this.description = description;
        this.notes = notes;
        this.perceivedEffort = perceivedEffort;
        this.startedAt = startedAt;
        this.endedAt = endedAt;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public void addExercise(WorkoutExerciseEntity exercise) {
        exercise.attachTo(this);
        exercises.add(exercise);
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public String getName() {
        return name;
    }

    public String getDescription() {
        return description;
    }

    public String getNotes() {
        return notes;
    }

    public Integer getPerceivedEffort() {
        return perceivedEffort;
    }

    public UUID getSourceRoutineId() {
        return sourceRoutineId;
    }

    public Instant getStartedAt() {
        return startedAt;
    }

    public Instant getEndedAt() {
        return endedAt;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
    public String getVisibility() {
        return visibility;
    }

    public List<WorkoutExerciseEntity> getExercises() {
        return exercises;
    }
}
