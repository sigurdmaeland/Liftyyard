package no.fitnessapp.measurements;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.Pattern;
import java.math.BigDecimal;

/**
 * Brukerinnstillinger. goalWeightKg og weeklyWorkoutGoal er null når de ikke er satt.
 * weightUnit (KG/LB) styrer bare visning og inntasting i appen; alle vekter lagres i kg.
 */
public record SettingsDto(
        @DecimalMin(value = "0", inclusive = false) @DecimalMax("500") BigDecimal goalWeightKg,
        @Min(1) @Max(14) Integer weeklyWorkoutGoal,
        @Pattern(regexp = "KG|LB") String weightUnit) {}
