package no.fitnessapp.users;

import java.util.UUID;
import no.fitnessapp.social.FollowStatus;

/**
 * En profil slik andre ser den. Fødselsdato, kjønn, vekt og kroppsmål tas aldri med.
 * Er profilen privat og du ikke følger den, vises bare navn, brukernavn, bilde og bio (tallene er null).
 * canViewWorkouts: profilen er åpen for deg (eier, offentlig profil eller godtatt følger). Hvilke økter
 * du ser, avgjøres per økt (PUBLIC/FOLLOWERS/PRIVATE).
 * blockedByYou: du har blokkert brukeren; da vises bare navn og bilde, så du kan oppheve blokkeringen.
 */
public record PublicProfileDto(
        UUID id,
        String username,
        String displayName,
        String bio,
        String avatarUrl,
        boolean isPrivate,
        boolean isSelf,
        Long workoutCount,
        Long followerCount,
        Long followingCount,
        FollowStatus followStatus,
        boolean followsYou,
        boolean canViewWorkouts,
        String instagram,
        String tiktok,
        String youtube,
        String website,
        boolean blockedByYou) {}
