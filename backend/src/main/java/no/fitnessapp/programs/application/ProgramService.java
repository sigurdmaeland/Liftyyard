package no.fitnessapp.programs.application;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;
import no.fitnessapp.common.ConflictException;
import no.fitnessapp.common.NotFoundException;
import no.fitnessapp.favorites.FavoriteStore;
import no.fitnessapp.programs.api.ProgramRequest;
import no.fitnessapp.programs.api.ProgramResponse;
import no.fitnessapp.programs.api.ProgramSummaryResponse;
import no.fitnessapp.programs.api.RoutineResponse;
import no.fitnessapp.programs.domain.Visibility;
import no.fitnessapp.programs.persistence.ProgramEntity;
import no.fitnessapp.programs.persistence.ProgramRepository;
import no.fitnessapp.programs.persistence.RoutineRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class ProgramService {

    public record SaveResult(ProgramResponse program, boolean created) {}

    private final ProgramRepository programs;
    private final RoutineRepository routines;
    private final FavoriteStore favorites;
    private final CreditResolver credits;

    public ProgramService(ProgramRepository programs, RoutineRepository routines, FavoriteStore favorites, CreditResolver credits) {
        this.programs = programs;
        this.routines = routines;
        this.favorites = favorites;
        this.credits = credits;
    }

    /** Oppretter eller oppdaterer programmets navn og beskrivelse (idempotent). */
    @Transactional
    public SaveResult save(UUID userId, UUID programId, ProgramRequest request) {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        String name = request.name().trim();
        String description = blankToNull(request.description());
        var existing = programs.findById(programId);
        ProgramEntity program;
        boolean created = existing.isEmpty();
        if (existing.isPresent()) {
            program = existing.get();
            if (!program.getOwnerUserId().equals(userId)) {
                throw new ConflictException("ID-en er allerede i bruk");
            }
            program.update(name, description, request.visibility(), request.level(), request.daysPerWeek(), now);
        } else {
            program = new ProgramEntity(programId, userId, name, description, Visibility.PRIVATE, now, now);
            program.update(name, description, request.visibility(), request.level(), request.daysPerWeek(), now);
            program = programs.save(program);
        }
        programs.flush();
        return new SaveResult(ProgramResponse.from(program, routinesOf(userId, programId), credits.forOrigin(program.getOrigin())), created);
    }

    @Transactional(readOnly = true)
    public ProgramResponse get(UUID userId, UUID programId) {
        ProgramEntity p = programs.findByIdAndOwnerUserId(programId, userId)
                .orElseThrow(() -> new NotFoundException("Fant ikke programmet"));
        return ProgramResponse.from(p, routinesOf(userId, programId), credits.forOrigin(p.getOrigin()));
    }

    @Transactional(readOnly = true)
    public List<ProgramSummaryResponse> list(UUID userId) {
        Map<UUID, Long> counts = routines.countPerProgram(userId).stream()
                .collect(Collectors.toMap(RoutineRepository.ProgramCount::getProgramId, RoutineRepository.ProgramCount::getCount));
        return programs.findByOwnerUserIdOrderByUpdatedAtDesc(userId).stream()
                .map(p -> ProgramSummaryResponse.from(p, counts.getOrDefault(p.getId(), 0L)))
                .toList();
    }

    /** Sletter programmet og rutinene i det (ON DELETE CASCADE). Idempotent. */
    @Transactional
    public void delete(UUID userId, UUID programId) {
        programs.deleteOwned(programId, userId);
    }

    private List<RoutineResponse> routinesOf(UUID userId, UUID programId) {
        Set<UUID> fav = favorites.routineIds(userId);
        var list = routines.findInProgram(programId, userId);
        var credit = credits.forOrigins(list.stream().map(r -> r.getOrigin()).toList());
        return list.stream()
                .map(r -> RoutineResponse.from(r, fav.contains(r.getId()), credit.apply(r.getOrigin())))
                .toList();
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
