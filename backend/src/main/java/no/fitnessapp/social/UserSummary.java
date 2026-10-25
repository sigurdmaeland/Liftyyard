package no.fitnessapp.social;

import java.util.UUID;

/** En bruker i søk og lister: bare offentlige felt, og forholdet til den som ser. */
public record UserSummary(UUID id, String username, String displayName, String avatarUrl, boolean isPrivate, boolean isSelf, FollowStatus followStatus) {}
