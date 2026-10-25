package no.fitnessapp.exercises.domain;

/** Bestemmer hvilke felt et sett for øvelsen bruker. */
public enum ExerciseType {
    /** Vekt + reps (benkpress). */
    WEIGHT_REPS,
    /** Bare reps (armhevinger). */
    BODYWEIGHT_REPS,
    /** Ekstra vekt + reps (pull-up med vektbelte). */
    WEIGHTED_BODYWEIGHT,
    /** Assistansevekt + reps (assistert pull-up). */
    ASSISTED_BODYWEIGHT,
    /** Varighet (planke). */
    DURATION,
    /** Distanse + varighet (romaskin). */
    DISTANCE_DURATION
}
