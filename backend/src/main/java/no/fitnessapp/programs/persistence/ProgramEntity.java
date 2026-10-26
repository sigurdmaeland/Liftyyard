package no.fitnessapp.programs.persistence;

import jakarta.persistence.AttributeOverride;
import jakarta.persistence.Column;
import jakarta.persistence.Embedded;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import java.time.Instant;
import java.util.UUID;
import no.fitnessapp.programs.domain.Level;
import no.fitnessapp.programs.domain.Visibility;

/** Treningsprogram: navn og beskrivelse. Rutinene er egne aggregater som peker hit (program_id). */
@Entity
@Table(name = "programs")
public class ProgramEntity {

    @Id
    private UUID id;

    @Column(name = "owner_user_id", nullable = false)
    private UUID ownerUserId;

    @Column(nullable = false)
    private String name;

    private String description;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Visibility visibility;

    @Enumerated(EnumType.STRING)
    private Level level;

    @Column(name = "days_per_week")
    private Integer daysPerWeek;

    @Column(name = "download_count", nullable = false)
    private int downloadCount;

    /** Satt på kopier lastet ned fra Utforsk. */
    @Column(name = "source_program_id")
    private UUID sourceProgramId;

    /** Kreditt: hvem som laget originalen (første opphav). Null for egne programmer. */
    @Embedded
    @AttributeOverride(name = "id", column = @Column(name = "origin_program_id"))
    private Origin origin;

    /** Forsidebildet i bildelagringen, eller null (appen viser da en farget standardforside). */
    @Column(name = "cover_key")
    private String coverKey;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    protected ProgramEntity() {}

    /** Kopi av et offentlig program, lastet ned til en brukers bibliotek. */
    public static ProgramEntity copyOf(ProgramEntity source, UUID id, UUID ownerUserId, Instant now, String sourceOwnerName) {
        ProgramEntity copy = new ProgramEntity(id, ownerUserId, source.name, source.description, Visibility.PRIVATE, now, now);
        copy.level = source.level;
        copy.daysPerWeek = source.daysPerWeek;
        copy.sourceProgramId = source.id;
        copy.origin = Origin.forCopyOf(source.origin, source.id, source.ownerUserId, sourceOwnerName, source.name);
        return copy;
    }

    /** Oppdaterer programmet. null for visibility, level eller daysPerWeek beholder lagret verdi. */
    public void update(String name, String description, Visibility visibility, Level level, Integer daysPerWeek, Instant updatedAt) {
        this.name = name;
        this.description = description;
        if (visibility != null) this.visibility = visibility;
        if (level != null) this.level = level;
        if (daysPerWeek != null) this.daysPerWeek = daysPerWeek;
        this.updatedAt = updatedAt;
    }

    public ProgramEntity(
            UUID id, UUID ownerUserId, String name, String description, Visibility visibility,
            Instant createdAt, Instant updatedAt) {
        this.id = id;
        this.ownerUserId = ownerUserId;
        this.name = name;
        this.description = description;
        this.visibility = visibility;
        this.createdAt = createdAt;
        this.updatedAt = updatedAt;
    }

    public UUID getId() { return id; }
    public UUID getOwnerUserId() { return ownerUserId; }
    public String getName() { return name; }
    public String getDescription() { return description; }
    public Visibility getVisibility() { return visibility; }
    public Level getLevel() { return level; }
    public Integer getDaysPerWeek() { return daysPerWeek; }
    public int getDownloadCount() { return downloadCount; }
    public UUID getSourceProgramId() { return sourceProgramId; }
    public Origin getOrigin() { return origin; }
    public String getCoverKey() { return coverKey; }
    public Instant getCreatedAt() { return createdAt; }

    /** Nytt (eller null for intet) forsidebilde. Teller som en endring av programmet. */
    public void setCoverKey(String coverKey, Instant updatedAt) {
        this.coverKey = coverKey;
        this.updatedAt = updatedAt;
    }
    public Instant getUpdatedAt() { return updatedAt; }
}
