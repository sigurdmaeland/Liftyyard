package no.fitnessapp.explore;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.programs.api.Credit;
import no.fitnessapp.programs.api.RoutineResponse;
import no.fitnessapp.programs.domain.Visibility;

/**
 * En delt, frittstående rutine i Utforsk. preview er øvelsene i kortform (for kortet i listen);
 * routine er hele rutinen og bare med i detaljvisningen.
 */
public record ExploreRoutineResponse(
        UUID id,
        String name,
        String notes,
        AuthorSummary author,
        Visibility visibility,
        boolean mine,
        boolean fromFollowing,
        int exerciseCount,
        int setCount,
        int downloadCount,
        Credit basedOn,
        Instant createdAt,
        List<PreviewExercise> preview,
        RoutineResponse routine) {

    public record PreviewExercise(UUID exerciseId, String name, int setCount) {}
}
