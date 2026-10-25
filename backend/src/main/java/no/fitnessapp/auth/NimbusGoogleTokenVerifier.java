package no.fitnessapp.auth;

import java.util.Set;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.common.UnauthenticatedException;
import org.springframework.security.oauth2.core.DelegatingOAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2Error;
import org.springframework.security.oauth2.core.OAuth2TokenValidator;
import org.springframework.security.oauth2.core.OAuth2TokenValidatorResult;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.security.oauth2.jwt.JwtException;
import org.springframework.security.oauth2.jwt.JwtTimestampValidator;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.stereotype.Component;

/**
 * Kontrollerer Google ID-tokens: signatur mot Googles offentlige nøkler (hentes og mellomlagres
 * automatisk), utsteder, mottaker (vår OAuth-klient) og utløpstid.
 */
@Component
class NimbusGoogleTokenVerifier implements GoogleTokenVerifier {

    private static final Set<String> ISSUERS = Set.of("https://accounts.google.com", "accounts.google.com");

    private final AuthProperties props;
    private final NimbusJwtDecoder decoder;

    NimbusGoogleTokenVerifier(AuthProperties props) {
        this.props = props;
        this.decoder = NimbusJwtDecoder.withJwkSetUri("https://www.googleapis.com/oauth2/v3/certs").build();
        OAuth2TokenValidator<Jwt> issuer = jwt -> ISSUERS.contains(jwt.getClaimAsString("iss"))
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Feil utsteder", null));
        OAuth2TokenValidator<Jwt> audience = jwt -> jwt.getAudience().stream().anyMatch(props.googleClientIds()::contains)
                ? OAuth2TokenValidatorResult.success()
                : OAuth2TokenValidatorResult.failure(new OAuth2Error("invalid_token", "Feil mottaker", null));
        decoder.setJwtValidator(new DelegatingOAuth2TokenValidator<>(new JwtTimestampValidator(), issuer, audience));
    }

    @Override
    public GoogleIdentity verify(String idToken) {
        if (props.googleClientIds().isEmpty()) {
            throw new BadRequestException("Google-innlogging er ikke satt opp på serveren (GOOGLE_CLIENT_IDS)");
        }
        try {
            Jwt jwt = decoder.decode(idToken);
            return new GoogleIdentity(
                    jwt.getSubject(),
                    jwt.getClaimAsString("email"),
                    Boolean.TRUE.equals(jwt.getClaimAsBoolean("email_verified")),
                    jwt.getClaimAsString("name"));
        } catch (JwtException e) {
            throw new UnauthenticatedException();
        }
    }
}
