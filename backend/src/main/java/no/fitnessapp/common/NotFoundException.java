package no.fitnessapp.common;

/** Ressursen finnes ikke, eller tilhører en annen bruker (vi skiller ikke, for ikke å lekke informasjon). */
public class NotFoundException extends RuntimeException {
    public NotFoundException(String message) {
        super(message);
    }
}
