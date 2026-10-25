package no.fitnessapp.exercises.persistence;

import java.util.List;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

public interface ExerciseRepository extends JpaRepository<ExerciseEntity, UUID> {

    /** Felles katalog + brukerens egne øvelser, uten arkiverte. */
    @Query("""
            select e from ExerciseEntity e
            where e.archivedAt is null and (e.ownerUserId is null or e.ownerUserId = :userId)
            order by lower(e.name)
            """)
    List<ExerciseEntity> findVisibleTo(UUID userId);
}
