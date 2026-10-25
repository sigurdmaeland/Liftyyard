package no.fitnessapp.users;

import java.util.UUID;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Midlertidig utviklingsbruker frem til innlogging (Apple/Google) er på plass.
 * Er bare aktiv når app.dev-user.enabled=true, som kun settes i local-profilen.
 */
@ConfigurationProperties("app.dev-user")
public record DevUserProperties(boolean enabled, UUID id, String displayName) {}
