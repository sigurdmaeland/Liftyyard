package no.fitnessapp.workouts.domain;

public enum SetType {
    /** Vanlig arbeidssett. */
    NORMAL,
    /** Oppvarming. Telles ikke i volum eller PR. */
    WARMUP,
    /** Sett kjørt til failure. */
    FAILURE,
    /** Dropsett (redusert vekt rett etter forrige sett). */
    DROP
}
