package no.fitnessapp.auth;

/** Kontrollerer et ID-token fra Google-innlogging på telefonen. Kaster UnauthenticatedException ved ugyldig token. */
public interface GoogleTokenVerifier {

    record GoogleIdentity(String subject, String email, boolean emailVerified, String name) {}

    GoogleIdentity verify(String idToken);
}
