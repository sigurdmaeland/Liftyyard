package no.fitnessapp.social;

/**
 * SQL-byggesteiner for blokkering og sperrede kontoer. Krever parameteren :viewer.
 * Brukes overalt der andres innhold vises (feed, profiler, søk, kommentarer, Utforsk, varsler).
 */
public final class Blocks {

    private Blocks() {}

    /**
     * Betingelse: brukeren med id-uttrykket `userId` er :viewer selv, eller ingen av dem har blokkert
     * den andre og kontoen er ikke sperret.
     */
    public static String visibleUser(String userId) {
        return """
                (%1$s = :viewer OR (NOT EXISTS (SELECT 1 FROM blocks bl
                                                WHERE (bl.blocker_id = :viewer AND bl.blocked_id = %1$s)
                                                   OR (bl.blocker_id = %1$s AND bl.blocked_id = :viewer))
                                    AND NOT EXISTS (SELECT 1 FROM users su WHERE su.id = %1$s AND su.suspended_at IS NOT NULL)))
                """.formatted(userId).strip();
    }
}
