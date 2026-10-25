package no.fitnessapp.social;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

/** En økt i feeden eller på en profil: kortform med forfatter, øvelser, bilder, liker og kommentarer. */
public record FeedItem(
        UUID id,
        String name,
        String description,
        Instant startedAt,
        Instant endedAt,
        String visibility,
        UserSummary author,
        List<ExerciseLine> exercises,
        int completedSetCount,
        BigDecimal volumeKg,
        List<String> photoUrls,
        long likeCount,
        boolean likedByMe,
        long commentCount,
        /** Antall rekorder (medaljer) i økten, og hvilke medaljefarger (1 gull, 2 sølv, 3 bronse) som finnes. */
        int recordCount,
        List<Integer> recordMedals,
        /** Hvem eieren trente sammen med (bare de du kan se). */
        List<UserSummary> partners) {

    public record ExerciseLine(UUID exerciseId, String exerciseName, int setCount) {}
}
