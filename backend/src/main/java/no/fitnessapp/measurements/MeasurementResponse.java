package no.fitnessapp.measurements;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.UUID;

public record MeasurementResponse(UUID id, MeasurementKind kind, BigDecimal value, Instant measuredAt) {}
