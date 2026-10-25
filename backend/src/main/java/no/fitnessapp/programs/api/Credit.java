package no.fitnessapp.programs.api;

import java.util.UUID;

/**
 * «Basert på»: originalen en kopi kom fra, og hvem som laget den. authorUsername er null hvis
 * kontoen er slettet (eller for appens egne programmer); da vises authorName fra øyeblikksbildet.
 */
public record Credit(UUID id, String name, UUID authorId, String authorUsername, String authorName, String authorAvatarUrl) {}
