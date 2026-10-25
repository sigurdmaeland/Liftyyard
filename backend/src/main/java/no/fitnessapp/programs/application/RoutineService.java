package no.fitnessapp.programs.application;

import jakarta.persistence.EntityManager;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.Function;
import java.util.stream.Collectors;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.common.ConflictException;
import no.fitnessapp.common.NotFoundException;
import no.fitnessapp.exercises.persistence.ExerciseEntity;
import no.fitnessapp.exercises.persistence.ExerciseRepository;
import no.fitnessapp.favorites.FavoriteStore;
import no.fitnessapp.programs.api.RoutineRequest;
import no.fitnessapp.programs.api.RoutineResponse;
import no.fitnessapp.programs.domain.Visibility;
import no.fitnessapp.programs.persistence.Origin;
import no.fitnessapp.programs.persistence.ProgramRepository;
import no.fitnessapp.programs.persistence.RoutineEntity;
import no.fitnessapp.programs.persistence.RoutineExerciseEntity;
import no.fitnessapp.programs.persistence.RoutineRepository;
import no.fitnessapp.programs.persistence.RoutineSetEntity;
import no.fitnessapp.workouts.domain.SetType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class RoutineService {

    public record SaveResult(RoutineResponse routine, boolean created) {}

    private final RoutineRepository routines;
    private final ProgramRepository programs;
    private final ExerciseRepository exercises;
    private final FavoriteStore favorites;
    private final EntityManager em;
    private final CreditResolver credits;

    public RoutineService(
            RoutineRepository routines, ProgramRepository programs, ExerciseRepository exercises,
            FavoriteStore favorites, EntityManager em, CreditResolver credits) {
        this.routines = routines;
        this.programs = programs;
        this.exercises = exercises;
        this.favorites = favorites;
        this.em = em;
        this.credits = credits;
    }

    /** Oppretter eller erstatter hele rutinen (idempotent). */
    @Transactional
    public SaveResult save(UUID userId, UUID routineId, RoutineRequest request) {
        requireUniqueIds(request);
        if (request.programId() != null && programs.findByIdAndOwnerUserId(request.programId(), userId).isEmpty()) {
            throw new BadRequestException("Ukjent program: " + request.programId());
        }
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        Instant createdAt = now;
        boolean created = true;
        boolean wasFavorite = false;
        Visibility visibility = request.visibility() == null ? Visibility.PRIVATE : request.visibility();
        int downloadCount = 0;
        UUID sourceRoutineId = null;
        // En duplisert kopi beholder kreditten til originalen den kom fra.
        Origin origin = request.copiedFromRoutineId() == null ? null
                : routines.findOrigin(request.copiedFromRoutineId(), userId).orElse(null);
        var existing = routines.findOwnership(routineId);
        if (existing.isPresent()) {
            if (!existing.get().getOwnerUserId().equals(userId)) {
                throw new ConflictException("ID-en er allerede i bruk");
            }
            createdAt = existing.get().getCreatedAt();
            created = false;
            if (request.visibility() == null) visibility = existing.get().getVisibility();
            downloadCount = existing.get().getDownloadCount();
            sourceRoutineId = existing.get().getSourceRoutineId();
            origin = routines.findOrigin(routineId, userId).orElse(null);
            // Erstatning sletter raden (og favoritten via CASCADE); husk favoritten og legg den tilbake.
            wasFavorite = favorites.routineIds(userId).contains(routineId);
            routines.deleteOwned(routineId, userId);
        }

        Map<UUID, ExerciseEntity> library = loadExercises(userId, request);
        RoutineEntity routine = new RoutineEntity(
                routineId, userId, request.programId(), request.position() == null ? 0 : request.position(),
                request.name().trim(), blankToNull(request.notes()), createdAt, now);
        routine.keepSharing(visibility, downloadCount, sourceRoutineId);
        routine.keepOrigin(origin);
        for (int e = 0; e < request.exercises().size(); e++) {
            var ee = request.exercises().get(e);
            ExerciseEntity source = library.get(ee.exerciseId());
            RoutineExerciseEntity rex = new RoutineExerciseEntity(
                    ee.id(), e, source.getId(), source.getName(), source.getExerciseType(), blankToNull(ee.notes()), ee.restSeconds());
            for (int s = 0; s < ee.sets().size(); s++) {
                var se = ee.sets().get(s);
                rex.addSet(new RoutineSetEntity(
                        se.id(), s, se.setType() == null ? SetType.NORMAL : se.setType(),
                        se.targetReps(), se.targetWeightKg(), se.targetDurationSeconds()));
            }
            routine.addExercise(rex);
        }
        em.persist(routine);
        em.flush();
        if (wasFavorite) favorites.addRoutine(userId, routineId);
        return new SaveResult(RoutineResponse.from(routine, wasFavorite, credits.forOrigin(routine.getOrigin())), created);
    }

    @Transactional(readOnly = true)
    public RoutineResponse get(UUID userId, UUID routineId) {
        RoutineEntity r = routines.findByIdAndOwnerUserId(routineId, userId)
                .orElseThrow(() -> new NotFoundException("Fant ikke rutinen"));
        return RoutineResponse.from(r, favorites.routineIds(userId).contains(routineId), credits.forOrigin(r.getOrigin()));
    }

    @Transactional(readOnly = true)
    public List<RoutineResponse> list(UUID userId) {
        Set<UUID> fav = favorites.routineIds(userId);
        var list = routines.findByOwnerUserIdOrderByUpdatedAtDesc(userId);
        var credit = credits.forOrigins(list.stream().map(RoutineEntity::getOrigin).toList());
        return list.stream()
                .map(r -> RoutineResponse.from(r, fav.contains(r.getId()), credit.apply(r.getOrigin())))
                .toList();
    }

    @Transactional
    public void delete(UUID userId, UUID routineId) {
        routines.deleteOwned(routineId, userId);
    }

    /** Favoritt kan bare settes på egne rutiner (deling av andres rutiner kommer med community). */
    @Transactional
    public void setFavorite(UUID userId, UUID routineId, boolean favorite) {
        if (routines.findOwnership(routineId).filter(o -> o.getOwnerUserId().equals(userId)).isEmpty()) {
            throw new NotFoundException("Fant ikke rutinen");
        }
        if (favorite) favorites.addRoutine(userId, routineId);
        else favorites.removeRoutine(userId, routineId);
    }

    private Map<UUID, ExerciseEntity> loadExercises(UUID userId, RoutineRequest request) {
        Set<UUID> ids = request.exercises().stream().map(RoutineRequest.ExerciseEntry::exerciseId).collect(Collectors.toSet());
        Map<UUID, ExerciseEntity> found = exercises.findAllById(ids).stream()
                .filter(e -> e.isVisibleTo(userId))
                .collect(Collectors.toMap(ExerciseEntity::getId, Function.identity()));
        for (UUID id : ids) {
            if (!found.containsKey(id)) {
                throw new BadRequestException("Ukjent øvelse: " + id);
            }
        }
        return found;
    }

    private static void requireUniqueIds(RoutineRequest request) {
        Set<UUID> seen = new HashSet<>();
        for (var e : request.exercises()) {
            if (!seen.add(e.id())) throw new BadRequestException("Duplisert ID: " + e.id());
            for (var s : e.sets()) {
                if (!seen.add(s.id())) throw new BadRequestException("Duplisert ID: " + s.id());
            }
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
