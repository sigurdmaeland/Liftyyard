package no.fitnessapp.users;

import java.time.LocalDate;

/**
 * Brukerens egen profil slik den vises for brukeren selv. Fødselsdato og kjønn er private og
 * vises aldri for andre (se PublicProfileDto). role er USER, MODERATOR eller ADMIN.
 */
public record ProfileDto(
        String username,
        String firstName,
        String lastName,
        String bio,
        LocalDate birthDate,
        String gender,
        String instagram,
        String tiktok,
        String youtube,
        String website,
        String visibility,
        String avatarUrl,
        String role,
        String acceptedTermsVersion,
        String currentTermsVersion) {

    /** Må brukeren godta (nye) vilkår før appen kan brukes? */
    public boolean mustAcceptTerms() {
        return currentTermsVersion != null && !currentTermsVersion.equals(acceptedTermsVersion);
    }
}
