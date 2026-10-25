package no.fitnessapp.auth;

import java.time.Duration;
import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/** Innstillinger for innlogging (application.yml under app.auth). Hemmeligheter kommer fra miljøvariabler. */
@ConfigurationProperties("app.auth")
public record AuthProperties(
        String jwtSecret,
        Duration accessTokenTtl,
        Duration refreshTokenTtl,
        List<String> googleClientIds,
        String mailFrom,
        boolean logCodes,
        /** Maks antall e-postkoder per adresse i timen. 0 = ingen grense (bare for lokal testing). */
        Integer maxCodesPerHour) {

    public AuthProperties {
        if (jwtSecret == null || jwtSecret.length() < 32) {
            throw new IllegalStateException(
                    "app.auth.jwt-secret mangler eller er kortere enn 32 tegn. Sett AUTH_JWT_SECRET i .env (se .env.example).");
        }
        maxCodesPerHour = maxCodesPerHour == null ? 5 : maxCodesPerHour;
        googleClientIds = googleClientIds == null ? List.of() : googleClientIds.stream().filter(s -> !s.isBlank()).toList();
    }
}
