package no.fitnessapp.programs.api;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.programs.domain.Level;
import no.fitnessapp.programs.domain.Visibility;
import no.fitnessapp.programs.persistence.ProgramEntity;

public record ProgramResponse(
        UUID id,
        String name,
        String description,
        Visibility visibility,
        Level level,
        Integer daysPerWeek,
        UUID sourceProgramId,
        int downloadCount,
        Credit basedOn,
        Instant createdAt,
        Instant updatedAt,
        List<RoutineResponse> routines) {

    public static ProgramResponse from(ProgramEntity p, List<RoutineResponse> routines, Credit basedOn) {
        return new ProgramResponse(
                p.getId(), p.getName(), p.getDescription(), p.getVisibility(), p.getLevel(), p.getDaysPerWeek(),
                p.getSourceProgramId(), p.getDownloadCount(), basedOn, p.getCreatedAt(), p.getUpdatedAt(), routines);
    }
}
