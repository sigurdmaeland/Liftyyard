package no.fitnessapp.explore;

import java.util.UUID;

/** Hvem som har laget et delt program eller en delt rutine. username er null for appens egne programmer. */
public record AuthorSummary(UUID id, String username, String displayName, String avatarUrl) {}
