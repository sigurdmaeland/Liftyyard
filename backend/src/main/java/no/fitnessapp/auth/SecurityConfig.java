package no.fitnessapp.auth;

import no.fitnessapp.users.DevUserProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwtDecoder;
import org.springframework.security.oauth2.jwt.JwtValidators;
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder;
import org.springframework.security.oauth2.server.resource.web.BearerTokenAuthenticationEntryPoint;
import org.springframework.security.oauth2.server.resource.web.authentication.BearerTokenAuthenticationFilter;
import org.springframework.security.web.SecurityFilterChain;

/**
 * Alle /api-endepunkter krever et gyldig tilgangstoken (Authorization: Bearer ...), unntatt helsesjekk,
 * innlogging og API-dokumentasjon. Ingen sesjoner eller cookies, derfor heller ikke CSRF.
 */
@Configuration
public class SecurityConfig {

    @Bean
    SecurityFilterChain apiSecurity(HttpSecurity http, DevUserProperties devUser) throws Exception {
        http.csrf(c -> c.disable())
                .sessionManagement(s -> s.sessionCreationPolicy(SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(a -> a
                        .requestMatchers("/api/auth/claim-dev-data").authenticated()
                        .requestMatchers(
                                "/api/health", "/api/health/**", "/api/auth/**", "/media/**", "/actuator/health", "/actuator/health/**",
                                "/v3/api-docs", "/v3/api-docs/**", "/swagger-ui.html", "/swagger-ui/**", "/error")
                        .permitAll()
                        .anyRequest().authenticated())
                .oauth2ResourceServer(o -> o.jwt(j -> {}))
                .exceptionHandling(e -> e.authenticationEntryPoint(new BearerTokenAuthenticationEntryPoint()));
        if (devUser.enabled() && devUser.id() != null) {
            // Bare lokalt: forespørsler uten token behandles som utviklingsbrukeren (curl, Swagger, tester).
            http.addFilterBefore(new DevUserAuthenticationFilter(devUser.id()), BearerTokenAuthenticationFilter.class);
        }
        return http.build();
    }

    @Bean
    JwtDecoder jwtDecoder(AuthProperties props) {
        NimbusJwtDecoder decoder = NimbusJwtDecoder.withSecretKey(TokenService.signingKey(props))
                .macAlgorithm(MacAlgorithm.HS256)
                .build();
        decoder.setJwtValidator(JwtValidators.createDefaultWithIssuer(TokenService.ISSUER));
        return decoder;
    }
}
