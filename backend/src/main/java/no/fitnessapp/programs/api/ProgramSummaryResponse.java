package no.fitnessapp.programs.api;

import java.time.Instant;
import java.util.UUID;
import no.fitnessapp.programs.domain.Visibility;
import no.fitnessapp.programs.persistence.ProgramEntity;

/** Kortform for bibliotekslisten. */
public record ProgramSummaryResponse(
        UUID id, String name, String description, Visibility visibility, long routineCount, String coverUrl, Instant updatedAt) {

    public static ProgramSummaryResponse from(ProgramEntity p, long routineCount, String coverUrl) {
        return new ProgramSummaryResponse(p.getId(), p.getName(), p.getDescription(), p.getVisibility(), routineCount, coverUrl, p.getUpdatedAt());
    }
}
