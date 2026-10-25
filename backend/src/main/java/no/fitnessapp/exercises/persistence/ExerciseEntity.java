package no.fitnessapp.exercises.persistence;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;
import no.fitnessapp.exercises.domain.Equipment;
import no.fitnessapp.exercises.domain.ExerciseType;

@Entity
@Table(name = "exercises")
public class ExerciseEntity {

    @Id
    private UUID id;

    /** null = felles katalog. */
    @Column(name = "owner_user_id")
    private UUID ownerUserId;

    @Column(nullable = false)
    private String name;

    @Enumerated(EnumType.STRING)
    @Column(name = "exercise_type", nullable = false)
    private ExerciseType exerciseType;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Equipment equipment;

    private String instructions;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "archived_at")
    private Instant archivedAt;

    @ElementCollection
    @CollectionTable(name = "exercise_muscles", joinColumns = @JoinColumn(name = "exercise_id"))
    private Set<ExerciseMuscle> muscles = new HashSet<>();

    protected ExerciseEntity() {}

    /** Ny egendefinert øvelse for en bruker. */
    public ExerciseEntity(UUID id, UUID ownerUserId, Instant now) {
        this.id = id;
        this.ownerUserId = ownerUserId;
        this.createdAt = now;
        this.updatedAt = now;
    }

    public void update(
            String name, ExerciseType exerciseType, Equipment equipment, String instructions,
            Set<ExerciseMuscle> muscles, Instant now) {
        this.name = name;
        this.exerciseType = exerciseType;
        this.equipment = equipment;
        this.instructions = instructions;
        this.muscles.clear();
        this.muscles.addAll(muscles);
        this.archivedAt = null;
        this.updatedAt = now;
    }

    public void archive(Instant now) {
        this.archivedAt = now;
        this.updatedAt = now;
    }

    public boolean isVisibleTo(UUID userId) {
        return archivedAt == null && (ownerUserId == null || ownerUserId.equals(userId));
    }

    public UUID getId() {
        return id;
    }

    public UUID getOwnerUserId() {
        return ownerUserId;
    }

    public String getName() {
        return name;
    }

    public ExerciseType getExerciseType() {
        return exerciseType;
    }

    public Equipment getEquipment() {
        return equipment;
    }

    public String getInstructions() {
        return instructions;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Set<ExerciseMuscle> getMuscles() {
        return muscles;
    }
}
