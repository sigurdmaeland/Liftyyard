package no.fitnessapp.common;

/** Forespørselen er syntaktisk gyldig, men bryter en forretningsregel. */
public class BadRequestException extends RuntimeException {
    public BadRequestException(String message) {
        super(message);
    }
}
