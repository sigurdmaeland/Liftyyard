package no.fitnessapp.programs.persistence;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;

public interface RoutineRepository extends JpaRepository<RoutineEntity, UUID> {

    interface Ownership {
        UUID getOwnerUserId();

        Instant getCreatedAt();
        no.fitnessapp.programs.domain.Visibility getVisibility();
        int getDownloadCount();
        UUID getSourceRoutineId();
    }

    @Query("""
            select r.ownerUserId as ownerUserId, r.createdAt as createdAt, r.visibility as visibility,
                   r.downloadCount as downloadCount, r.sourceRoutineId as sourceRoutineId
            from RoutineEntity r where r.id = :id
            """)
    Optional<Ownership> findOwnership(UUID id);

    @Query("select r.origin from RoutineEntity r where r.id = :id and r.ownerUserId = :ownerUserId")
    Optional<Origin> findOrigin(UUID id, UUID ownerUserId);

    Optional<RoutineEntity> findByIdAndOwnerUserId(UUID id, UUID ownerUserId);

    List<RoutineEntity> findByOwnerUserIdOrderByUpdatedAtDesc(UUID ownerUserId);

    @Query("""
            select r from RoutineEntity r
            where r.programId = :programId and r.ownerUserId = :ownerUserId
            order by r.position, r.createdAt
            """)
    List<RoutineEntity> findInProgram(UUID programId, UUID ownerUserId);

    @Query("select r.programId as programId, count(r) as count from RoutineEntity r where r.ownerUserId = :ownerUserId and r.programId is not null group by r.programId")
    List<ProgramCount> countPerProgram(UUID ownerUserId);

    interface ProgramCount {
        UUID getProgramId();

        long getCount();
    }

    @Modifying
    @Query("update RoutineEntity r set r.downloadCount = r.downloadCount + 1 where r.id = :id")
    int incrementDownloads(UUID id);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query("delete from RoutineEntity r where r.id = :id and r.ownerUserId = :ownerUserId")
    int deleteOwned(UUID id, UUID ownerUserId);
}
