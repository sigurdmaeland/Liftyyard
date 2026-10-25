package no.fitnessapp.common;

/** Brukeren er innlogget, men har ikke tilgang (f.eks. økter på en privat profil man ikke følger). */
public class ForbiddenException extends RuntimeException {
    public ForbiddenException(String message) {
        super(message);
    }
}
