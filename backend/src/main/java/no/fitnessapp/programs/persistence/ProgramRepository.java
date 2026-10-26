package no.fitnessapp.programs.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface ProgramRepository extends JpaRepository<ProgramEntity, UUID> {

    interface Ownership {
        UUID getOwnerUserId();

        Instant getCreatedAt();
    }

    @Query("select p.ownerUserId as ownerUserId, p.createdAt as createdAt from ProgramEntity p where p.id = :id")
    Optional<Ownership> findOwnership(UUID id);

    Optional<ProgramEntity> findByIdAndOwnerUserId(UUID id, UUID ownerUserId);

    List<ProgramEntity> findByOwnerUserIdOrderByUpdatedAtDesc(UUID ownerUserId);

    List<ProgramEntity> findByVisibilityOrderByDownloadCountDescCreatedAtDesc(no.fitnessapp.programs.domain.Visibility visibility);

    Optional<ProgramEntity> findByIdAndVisibility(UUID id, no.fitnessapp.programs.domain.Visibility visibility);

    @Query("select p.coverKey from ProgramEntity p where p.ownerUserId = :ownerUserId and p.coverKey is not null")
    List<String> coverKeysOwnedBy(UUID ownerUserId);

    @Modifying
    @Query("update ProgramEntity p set p.downloadCount = p.downloadCount + 1 where p.id = :id")
    int incrementDownloads(UUID id);

    /** Sletter programmet. Rutiner, øvelser og sett slettes av databasen (ON DELETE CASCADE). */
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from ProgramEntity p where p.id = :id and p.ownerUserId = :ownerUserId")
    int deleteOwned(UUID id, UUID ownerUserId);
}
