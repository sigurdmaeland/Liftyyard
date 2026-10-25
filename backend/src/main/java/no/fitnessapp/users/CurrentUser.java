package no.fitnessapp.users;

import java.util.UUID;
import no.fitnessapp.common.UnauthenticatedException;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

/**
 * Gir ID-en til brukeren som gjør forespørselen, fra tilgangstokenet («sub») som Spring Security
 * har kontrollert. Alle brukeravhengige operasjoner skal gå via denne.
 */
@Component
public class CurrentUser {

    public UUID requireId() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            throw new UnauthenticatedException();
        }
        try {
            return UUID.fromString(auth.getName());
        } catch (IllegalArgumentException e) {
            throw new UnauthenticatedException();
        }
    }
}
