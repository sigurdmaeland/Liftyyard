package no.fitnessapp.users;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Past;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

/**
 * Det brukeren selv kan endre med PUT /api/me. Brukernavn endres med PUT /api/me/username og
 * profilbilde med /api/me/avatar. Brukernavn i sosiale medier lagres uten «@». visibility = null
 * beholder nåværende synlighet.
 */
public record ProfileUpdate(
        @NotBlank @Size(max = 50) String firstName,
        @Size(max = 50) String lastName,
        @Size(max = 300) String bio,
        @Past LocalDate birthDate,
        @Pattern(regexp = "MALE|FEMALE|OTHER") String gender,
        @Size(max = 30) @Pattern(regexp = "[A-Za-z0-9._]*") String instagram,
        @Size(max = 30) @Pattern(regexp = "[A-Za-z0-9._]*") String tiktok,
        @Size(max = 100) @Pattern(regexp = "[A-Za-z0-9._-]*") String youtube,
        @Size(max = 200) String website,
        @Pattern(regexp = "PUBLIC|PRIVATE") String visibility) {

    /** Navnet som vises for andre: «Fornavn Etternavn». */
    public String displayName() {
        String last = lastName == null ? "" : lastName.trim();
        return (firstName.trim() + " " + last).trim();
    }
}
