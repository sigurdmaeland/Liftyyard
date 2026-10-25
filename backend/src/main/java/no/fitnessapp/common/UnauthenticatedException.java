package no.fitnessapp.common;

public class UnauthenticatedException extends RuntimeException {
    public UnauthenticatedException() {
        super("Innlogging kreves");
    }
}
