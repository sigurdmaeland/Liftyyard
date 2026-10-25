package no.fitnessapp.users;

import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;

/** Regler for brukernavn: 3–30 tegn, a–z, 0–9, punktum og understrek, ikke punktum først/sist eller to på rad. */
public final class UsernameRules {

    private static final Pattern ALLOWED = Pattern.compile("^[a-z0-9._]{3,30}$");
    private static final Set<String> RESERVED = Set.of(
            "admin", "administrator", "support", "help", "hjelp", "treningsapp", "system", "root", "moderator", "mod",
            "staff", "official", "offisiell", "api", "www", "me", "meg", "du", "settings", "innstillinger", "login",
            "logout", "search", "sok", "null", "undefined", "anonymous", "anonym", "user", "users", "bruker", "brukere");

    private UsernameRules() {}

    public static String normalize(String username) {
        String u = username == null ? "" : username.trim().toLowerCase(Locale.ROOT);
        return u.startsWith("@") ? u.substring(1) : u;
    }

    /** Hvorfor brukernavnet ikke kan brukes, eller tom hvis formatet er gyldig (ledighet sjekkes separat). */
    public static Optional<String> problem(String normalized) {
        if (normalized.length() < 3) return Optional.of("Minst 3 tegn");
        if (normalized.length() > 30) return Optional.of("Maks 30 tegn");
        if (!ALLOWED.matcher(normalized).matches()) return Optional.of("Bare bokstavene a–z, tall, punktum og understrek");
        if (normalized.startsWith(".") || normalized.endsWith(".") || normalized.contains("..")) {
            return Optional.of("Punktum kan ikke stå først, sist eller to på rad");
        }
        if (RESERVED.contains(normalized)) return Optional.of("Brukernavnet er reservert");
        return Optional.empty();
    }
}
