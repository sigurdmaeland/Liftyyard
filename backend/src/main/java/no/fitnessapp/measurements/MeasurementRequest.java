package no.fitnessapp.measurements;

import jakarta.validation.constraints.DecimalMax;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.Instant;

public record MeasurementRequest(
        @NotNull MeasurementKind kind,
        @NotNull @DecimalMin(value = "0", inclusive = false) @DecimalMax("1000") BigDecimal value,
        @NotNull Instant measuredAt) {}
