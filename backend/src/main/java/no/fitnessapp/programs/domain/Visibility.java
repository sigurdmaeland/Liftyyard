package no.fitnessapp.programs.domain;

/**
 * Hvem kan se (og laste ned) et program eller en rutine.
 * PRIVATE: bare eieren. FOLLOWERS: godtatte følgere. PUBLIC: alle som kan se eierens profil.
 */
public enum Visibility {
    PRIVATE, FOLLOWERS, PUBLIC
}
