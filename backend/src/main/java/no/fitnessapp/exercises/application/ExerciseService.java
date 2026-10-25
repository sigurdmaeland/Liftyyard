package no.fitnessapp.exercises.application;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.common.ConflictException;
import no.fitnessapp.common.NotFoundException;
import no.fitnessapp.exercises.api.ExerciseRequest;
import no.fitnessapp.exercises.api.ExerciseResponse;
import no.fitnessapp.exercises.domain.Muscle;
import no.fitnessapp.exercises.domain.MuscleRole;
import no.fitnessapp.exercises.persistence.ExerciseEntity;
import no.fitnessapp.exercises.persistence.ExerciseMuscle;
import no.fitnessapp.exercises.persistence.ExerciseRepository;
import no.fitnessapp.favorites.FavoriteStore;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ExerciseService {

    public record SaveResult(ExerciseResponse exercise, boolean created) {}

    private final ExerciseRepository exercises;
    private final FavoriteStore favorites;

    public ExerciseService(ExerciseRepository exercises, FavoriteStore favorites) {
        this.exercises = exercises;
        this.favorites = favorites;
    }

    @Transactional(readOnly = true)
    public List<ExerciseResponse> list(UUID userId) {
        Set<UUID> fav = favorites.exerciseIds(userId);
        return exercises.findVisibleTo(userId).stream()
                .map(e -> ExerciseResponse.from(e, fav.contains(e.getId())))
                .toList();
    }

    /** Oppretter eller oppdaterer en egendefinert øvelse. Katalogøvelser kan ikke endres. */
    @Transactional
    public SaveResult save(UUID userId, UUID id, ExerciseRequest request) {
        Set<Muscle> primary = new HashSet<>(request.primaryMuscles());
        Set<Muscle> secondary = new HashSet<>(request.secondaryMuscles());
        for (Muscle m : secondary) {
            if (primary.contains(m)) throw new BadRequestException("En muskel kan ikke være både primær og sekundær: " + m);
        }
        Set<ExerciseMuscle> muscles = new HashSet<>();
        primary.forEach(m -> muscles.add(new ExerciseMuscle(m, MuscleRole.PRIMARY)));
        secondary.forEach(m -> muscles.add(new ExerciseMuscle(m, MuscleRole.SECONDARY)));

        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        var existing = exercises.findById(id);
        boolean created = existing.isEmpty();
        ExerciseEntity entity;
        if (existing.isPresent()) {
            entity = existing.get();
            if (entity.getOwnerUserId() == null || !entity.getOwnerUserId().equals(userId)) {
                throw new ConflictException("Øvelsen kan ikke endres");
            }
        } else {
            entity = new ExerciseEntity(id, userId, now);
        }
        entity.update(request.name().trim(), request.exerciseType(), request.equipment(),
                blankToNull(request.instructions()), muscles, now);
        exercises.saveAndFlush(entity);
        return new SaveResult(ExerciseResponse.from(entity, favorites.exerciseIds(userId).contains(id)), created);
    }

    /** Arkiverer egen øvelse. Historikk og rutiner som bruker den, beholder navnet. Idempotent. */
    @Transactional
    public void archive(UUID userId, UUID id) {
        exercises.findById(id)
                .filter(e -> userId.equals(e.getOwnerUserId()))
                .ifPresent(e -> e.archive(Instant.now().truncatedTo(ChronoUnit.MICROS)));
    }

    @Transactional
    public void setFavorite(UUID userId, UUID id, boolean favorite) {
        if (exercises.findById(id).filter(e -> e.isVisibleTo(userId)).isEmpty()) {
            throw new NotFoundException("Fant ikke øvelsen");
        }
        if (favorite) favorites.addExercise(userId, id);
        else favorites.removeExercise(userId, id);
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
