package no.fitnessapp.workouts.application;

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
import no.fitnessapp.common.PageResponse;
import no.fitnessapp.exercises.persistence.ExerciseEntity;
import no.fitnessapp.exercises.persistence.ExerciseRepository;
import no.fitnessapp.workouts.api.WorkoutRequest;
import no.fitnessapp.workouts.api.WorkoutResponse;
import no.fitnessapp.workouts.api.WorkoutSummaryResponse;
import no.fitnessapp.workouts.domain.SetType;
import no.fitnessapp.workouts.persistence.WorkoutEntity;
import no.fitnessapp.workouts.persistence.WorkoutExerciseEntity;
import no.fitnessapp.workouts.persistence.WorkoutRepository;
import no.fitnessapp.workouts.persistence.WorkoutSetEntity;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class WorkoutService {

    public record SaveResult(WorkoutResponse workout, boolean created) {}

    private final WorkoutRepository workouts;
    private final ExerciseRepository exercises;
    private final EntityManager em;

    public WorkoutService(WorkoutRepository workouts, ExerciseRepository exercises, EntityManager em) {
        this.workouts = workouts;
        this.exercises = exercises;
        this.em = em;
    }

    /**
     * Oppretter eller erstatter hele økten (idempotent). Samme forespørsel to ganger gir samme
     * resultat og aldri duplikater. Ved konflikt mellom enheter gjelder foreløpig «siste skriving vinner».
     */
    @Transactional
    public SaveResult save(UUID userId, UUID workoutId, WorkoutRequest request) {
        requireUniqueIds(request);

        // PostgreSQL lagrer mikrosekunder; vi avrunder slik at svar og lagret verdi er like.
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        Instant createdAt = now;
        boolean created = true;
        String visibility = request.visibility() == null ? "FOLLOWERS" : request.visibility();
        var existing = workouts.findOwnership(workoutId);
        if (existing.isPresent()) {
            if (!existing.get().getUserId().equals(userId)) {
                throw new ConflictException("ID-en er allerede i bruk");
            }
            createdAt = existing.get().getCreatedAt();
            if (request.visibility() == null) visibility = existing.get().getVisibility();
            created = false;
            // Økten oppdateres på stedet (bare øvelser og sett byttes ut), så liker, kommentarer og bilder består.
            workouts.deleteExercises(workoutId);
        }

        Map<UUID, ExerciseEntity> library = loadExercises(userId, request);

        WorkoutEntity workout = new WorkoutEntity(
                workoutId, userId, request.name().trim(), blankToNull(request.description()),
                blankToNull(request.notes()), request.perceivedEffort(), request.sourceRoutineId(),
                request.startedAt(), request.endedAt(), createdAt, now, visibility);

        List<WorkoutRequest.ExerciseEntry> entries = request.exercises();
        for (int i = 0; i < entries.size(); i++) {
            WorkoutRequest.ExerciseEntry entry = entries.get(i);
            ExerciseEntity source = library.get(entry.exerciseId());
            // Øyeblikksbilde: navn og type kopieres inn i økten.
            WorkoutExerciseEntity we = new WorkoutExerciseEntity(
                    entry.id(), i, source.getId(), source.getName(), source.getExerciseType(),
                    blankToNull(entry.notes()));
            we.setSupersetGroup(entry.supersetGroup());
            List<WorkoutRequest.SetEntry> sets = entry.sets();
            for (int j = 0; j < sets.size(); j++) {
                WorkoutRequest.SetEntry s = sets.get(j);
                we.addSet(new WorkoutSetEntity(
                        s.id(), j, s.setType() == null ? SetType.NORMAL : s.setType(),
                        s.weightKg(), s.reps(), s.rpe(), s.durationSeconds(), s.distanceM(), s.completedAt()));
            }
            workout.addExercise(we);
        }

        WorkoutEntity saved = created ? workout : em.merge(workout);
        if (created) em.persist(workout);
        em.flush(); // Avdekk eventuelle databasebrudd her, ikke ved commit.
        return new SaveResult(WorkoutResponse.from(saved), created);
    }

    @Transactional(readOnly = true)
    public WorkoutResponse get(UUID userId, UUID workoutId) {
        return workouts.findByIdAndUserId(workoutId, userId)
                .map(WorkoutResponse::from)
                .orElseThrow(() -> new NotFoundException("Fant ikke økten"));
    }

    @Transactional(readOnly = true)
    public PageResponse<WorkoutSummaryResponse> list(UUID userId, int page, int size) {
        var pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "startedAt"));
        return PageResponse.of(workouts.findByUserId(userId, pageable), WorkoutSummaryResponse::from);
    }

    /** Idempotent: sletting av en økt som ikke finnes (lenger) er ikke en feil. */
    @Transactional
    public void delete(UUID userId, UUID workoutId) {
        workouts.deleteOwned(workoutId, userId);
    }

    private Map<UUID, ExerciseEntity> loadExercises(UUID userId, WorkoutRequest request) {
        Set<UUID> ids = request.exercises().stream()
                .map(WorkoutRequest.ExerciseEntry::exerciseId)
                .collect(Collectors.toSet());
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

    private static void requireUniqueIds(WorkoutRequest request) {
        Set<UUID> seen = new HashSet<>();
        for (var e : request.exercises()) {
            if (!seen.add(e.id())) {
                throw new BadRequestException("Duplisert ID: " + e.id());
            }
            for (var s : e.sets()) {
                if (!seen.add(s.id())) {
                    throw new BadRequestException("Duplisert ID: " + s.id());
                }
            }
        }
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
