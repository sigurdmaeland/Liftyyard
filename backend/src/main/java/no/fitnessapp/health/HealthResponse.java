package no.fitnessapp.health;

import java.time.Instant;

/** Svar fra GET /api/health. Speiles av HealthResponse i mobilappen. */
public record HealthResponse(Status status, Status database, String version, Instant timestamp) {

    public enum Status { UP, DOWN }
}
