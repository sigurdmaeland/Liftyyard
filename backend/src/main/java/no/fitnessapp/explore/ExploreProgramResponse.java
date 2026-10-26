package no.fitnessapp.explore;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import no.fitnessapp.programs.api.Credit;
import no.fitnessapp.programs.api.RoutineResponse;
import no.fitnessapp.programs.domain.Level;
import no.fitnessapp.programs.domain.Visibility;

/**
 * Et delt program i Utforsk. routines er tom i listen og fylt ut i detaljvisningen.
 * basedOn: originalen hvis dette er en delt kopi. remixCount: delte programmer som bygger på dette.
 * mine: brukerens eget program. fromFollowing: laget av noen brukeren følger.
 */
public record ExploreProgramResponse(
        UUID id,
        String name,
        String description,
        String authorName,
        AuthorSummary author,
        Visibility visibility,
        boolean mine,
        boolean fromFollowing,
        Level level,
        Integer daysPerWeek,
        int routineCount,
        int downloadCount,
        Credit basedOn,
        int remixCount,
        /** Offentlig adresse til forsidebildet, eller null (appen viser da en generert forside). */
        String coverUrl,
        Instant createdAt,
        List<RoutineResponse> routines) {}
