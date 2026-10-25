package no.fitnessapp.auth;

import java.io.IOException;
import java.util.List;
import java.util.UUID;

import org.springframework.security.core.context.SecurityContext;
import org.springframework.http.HttpHeaders;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.filter.OncePerRequestFilter;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;

/**
 * Lokal utvikling: en forespørsel uten Authorization-header kjøres som utviklingsbrukeren.
 * Legges bare inn når app.dev-user.enabled=true (local-profilen). Med token brukes alltid tokenet.
 * Ikke en Spring-bean, slik at den ikke registreres som et vanlig servlet-filter i tillegg.
 */
class DevUserAuthenticationFilter extends OncePerRequestFilter {

    private final UUID devUserId;

    DevUserAuthenticationFilter(UUID devUserId) {
        this.devUserId = devUserId;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (request.getHeader(HttpHeaders.AUTHORIZATION) == null
                && SecurityContextHolder.getContext().getAuthentication() == null) {
            SecurityContext context = SecurityContextHolder.createEmptyContext();
            context.setAuthentication(UsernamePasswordAuthenticationToken.authenticated(devUserId.toString(), null, List.of()));
            SecurityContextHolder.setContext(context);
        }
        chain.doFilter(request, response);
    }
}
