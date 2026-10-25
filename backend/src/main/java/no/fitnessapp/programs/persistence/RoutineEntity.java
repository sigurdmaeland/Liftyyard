package no.fitnessapp.programs.persistence;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.CascadeType;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.OneToMany;
import jakarta.persistence.OrderBy;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;
import java.util.function.UnaryOperator;
import no.fitnessapp.programs.domain.Visibility;

/**
 * En rutine (gjenbrukbar treningsøkt-mal). Aggregatrot: øvelser og målsett lagres og erstattes
 * sammen. Kan tilhøre et program (programId) eller stå alene (programId = null).
 */
@Entity
@Table(name = "routines")
public class RoutineEntity {

    @Id
    private UUID id;

    @Column(name = "owner_user_id", nullable = false)
    private UUID ownerUserId;

    @Column(name = "program_id")
    private UUID programId;

    @Column(nullable = false)
    private int position;

    @Column(nullable = false)
    private String name;

    private String notes;

    /** Gjelder frittstående rutiner. Rutiner i et program deles sammen med programmet. */
    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Visibility visibility = Visibility.PRIVATE;

    @Column(name = "download_count", nullable = false)
    private int downloadCount;

    /** Satt på kopier av en frittstående rutine lastet ned fra Utforsk. */
    @Column(name = "source_routine_id")
    private UUID sourceRoutineId;

    /** Kreditt: hvem som laget originalen (første opphav). Null for egne rutiner. */
    @Embedded
    @AttributeOverride(name = "id", column = @Column(name = "origin_routine_id"))
    private Origin origin;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "routine", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("position")
    private List<RoutineExerciseEntity> exercises = new ArrayList<>();

    protected RoutineEntity() {}

    public RoutineEntity(
            UUID id, UUID ownerUserId, UUID programId, int position, String name, String notes,
            Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.ownerUserId = ownerUserId;
        this.programId = programId;
        this.position = position;
        this.name = name;
        this.notes = notes;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    /** Dyp kopi (nye ID-er) til en annen eier og et annet program. */
    public static RoutineEntity copyOf(RoutineEntity source, UUID ownerUserId, UUID programId, Instant now, String sourceOwnerName) {
        return copyOf(source, UUID.randomUUID(), ownerUserId, programId, now, UnaryOperator.identity(), sourceOwnerName);
    }

    /**
     * Dyp kopi med gitt ID. exerciseIds oversetter øvelses-ID-er (f.eks. til kopier av forfatterens
     * egne øvelser). Kopien er privat; for frittstående rutiner huskes originalen i sourceRoutineId.
     */
    public static RoutineEntity copyOf(
            RoutineEntity source, UUID id, UUID ownerUserId, UUID programId, Instant now, UnaryOperator<UUID> exerciseIds,
            String sourceOwnerName) {
        RoutineEntity copy = new RoutineEntity(id, ownerUserId, programId, source.position, source.name, source.notes, now, now);
        copy.origin = Origin.forCopyOf(source.origin, source.id, source.ownerUserId, sourceOwnerName, source.name);
        if (programId == null) {
            copy.position = 0;
            copy.sourceRoutineId = source.id;
        }
        for (RoutineExerciseEntity e : source.exercises) {
            UUID exerciseId = e.getExerciseId() == null ? null : exerciseIds.apply(e.getExerciseId());
            RoutineExerciseEntity ec = new RoutineExerciseEntity(
                    UUID.randomUUID(), e.getPosition(), exerciseId, e.getExerciseName(), e.getExerciseType(),
                    e.getNotes(), e.getRestSeconds());
            for (RoutineSetEntity s : e.getSets()) {
                ec.addSet(new RoutineSetEntity(
                        UUID.randomUUID(), s.getPosition(), s.getSetType(), s.getTargetReps(), s.getTargetWeightKg(),
                        s.getTargetDurationSeconds()));
            }
            copy.addExercise(ec);
        }
        return copy;
    }

    /** Setter kreditten (ved ny lagring av en kopi, eller når en kopi dupliseres). */
    public void keepOrigin(Origin origin) {
        this.origin = origin == null || origin.getId() == null ? null : origin;
    }

    /** Beholder deling og nedlastingstall når rutinen erstattes (lagres på nytt). */
    public void keepSharing(Visibility visibility, int downloadCount, UUID sourceRoutineId) {
        this.visibility = visibility == null ? Visibility.PRIVATE : visibility;
        this.downloadCount = downloadCount;
        this.sourceRoutineId = sourceRoutineId;
    }

    public void addExercise(RoutineExerciseEntity exercise) {
        exercise.attachTo(this);
        exercises.add(exercise);
    }

    public UUID getId() { return id; }
    public UUID getOwnerUserId() { return ownerUserId; }
    public UUID getProgramId() { return programId; }
    public int getPosition() { return position; }
    public String getName() { return name; }
    public String getNotes() { return notes; }
    public Visibility getVisibility() { return visibility; }
    public int getDownloadCount() { return downloadCount; }
    public UUID getSourceRoutineId() { return sourceRoutineId; }
    public Origin getOrigin() { return origin; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
    public List<RoutineExerciseEntity> getExercises() { return exercises; }
}
