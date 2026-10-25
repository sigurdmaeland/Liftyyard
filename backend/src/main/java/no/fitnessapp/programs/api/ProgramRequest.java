package no.fitnessapp.programs.api;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import no.fitnessapp.programs.domain.Level;
import no.fitnessapp.programs.domain.Visibility;

/**
 * Programmets egne felt. Rutinene lagres hver for seg (PUT /api/routines/{id} med programId).
 * visibility, level og daysPerWeek er valgfrie: utelatt (null) beholder det som er lagret.
 */
public record ProgramRequest(
        @NotBlank @Size(max = 100) String name,
        @Size(max = 2000) String description,
        Visibility visibility,
        Level level,
        @Min(1) @Max(7) Integer daysPerWeek) {

    public ProgramRequest(String name, String description) {
        this(name, description, null, null, null);
    }
}
