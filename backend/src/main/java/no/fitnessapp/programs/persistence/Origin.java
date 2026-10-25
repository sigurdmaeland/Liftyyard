package no.fitnessapp.programs.persistence;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.util.UUID;

/**
 * Hvem som laget originalen til en kopi (program eller rutine). Peker alltid til første opphav,
 * så kreditten følger med selv om kopien lastes ned og deles videre i flere ledd. Navnene er
 * øyeblikksbilder, slik at kreditten står igjen hvis originalen eller kontoen slettes.
 * id-kolonnen settes per entitet (origin_program_id / origin_routine_id).
 */
@Embeddable
public class Origin {

    private UUID id;

    @Column(name = "origin_user_id")
    private UUID userId;

    @Column(name = "origin_author_name")
    private String authorName;

    @Column(name = "origin_name")
    private String name;

    protected Origin() {}

    public Origin(UUID id, UUID userId, String authorName, String name) {
        this.id = id;
        this.userId = userId;
        this.authorName = authorName;
        this.name = name;
    }

    /** Kreditten en ny kopi skal ha: originalens egen kreditt hvis den har en, ellers originalen selv. */
    public static Origin forCopyOf(Origin sourceOrigin, UUID sourceId, UUID sourceOwnerId, String sourceOwnerName, String sourceName) {
        if (sourceOrigin != null && sourceOrigin.id != null) {
            return new Origin(sourceOrigin.id, sourceOrigin.userId, sourceOrigin.authorName, sourceOrigin.name);
        }
        return new Origin(sourceId, sourceOwnerId, sourceOwnerName, sourceName);
    }

    public UUID getId() { return id; }
    public UUID getUserId() { return userId; }
    public String getAuthorName() { return authorName; }
    public String getName() { return name; }
}
