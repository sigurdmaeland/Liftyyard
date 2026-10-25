package no.fitnessapp.workouts.persistence;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface WorkoutRepository extends JpaRepository<WorkoutEntity, UUID> {

    interface Ownership {
        UUID getUserId();

        Instant getCreatedAt();

        String getVisibility();
    }

    /** Henter bare eier og opprettelsestid, uten å laste øvelser og sett. */
    @Query("select w.userId as userId, w.createdAt as createdAt, w.visibility as visibility from WorkoutEntity w where w.id = :id")
    Optional<Ownership> findOwnership(UUID id);

    Optional<WorkoutEntity> findByIdAndUserId(UUID id, UUID userId);

    Page<WorkoutEntity> findByUserId(UUID userId, Pageable pageable);

    /**
     * Sletter øvelsene (og settene, via ON DELETE CASCADE) i en økt, men ikke selve økten. Brukes når
     * en økt erstattes, slik at liker, kommentarer og bilder som peker på økten består.
     */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "delete from workout_exercises where workout_id = :id", nativeQuery = true)
    int deleteExercises(UUID id);

    /** Sletter økten. Øvelser og sett slettes av databasen (ON DELETE CASCADE). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from WorkoutEntity w where w.id = :id and w.userId = :userId")
    int deleteOwned(UUID id, UUID userId);
}
