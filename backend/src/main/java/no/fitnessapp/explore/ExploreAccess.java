package no.fitnessapp.explore;

/** Synlighetsregelen for delte programmer og rutiner, tilgjengelig for andre pakker (f.eks. rapportering). */
public final class ExploreAccess {

    private ExploreAccess() {}

    /** SQL-betingelse: :viewer kan se det delte elementet med alias `a` (eier-alias u). */
    public static String shared(String a) {
        return ExploreService.shared(a);
    }
}
