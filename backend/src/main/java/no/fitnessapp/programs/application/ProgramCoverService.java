package no.fitnessapp.programs.application;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.common.NotFoundException;
import no.fitnessapp.media.ImageProcessor;
import no.fitnessapp.media.MediaStorage;
import no.fitnessapp.programs.persistence.ProgramEntity;
import no.fitnessapp.programs.persistence.ProgramRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Forsidebilder på programmer. Bildet beskjæres til kvadrat, skaleres til maks 1080×1080 og lagres
 * som ny JPEG uten metadata (covers/<program>/<id>.jpg). Bare eieren kan endre bildet. Forrige bilde slettes.
 */
@Service
public class ProgramCoverService {

    static final long MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
    static final int SIZE = 1080;

    private final ProgramRepository programs;
    private final MediaStorage storage;

    public ProgramCoverService(ProgramRepository programs, MediaStorage storage) {
        this.programs = programs;
        this.storage = storage;
    }

    /** Setter nytt forsidebilde. Returnerer den offentlige adressen. */
    @Transactional
    public String replace(UUID userId, UUID programId, byte[] original) {
        if (original.length == 0) throw new BadRequestException("Tom fil");
        if (original.length > MAX_UPLOAD_BYTES) throw new BadRequestException("Bildet er større enn 10 MB");
        ProgramEntity program = owned(userId, programId);
        String key = newKey(programId);
        storage.write(key, ImageProcessor.squareJpeg(original, SIZE));
        String previous = program.getCoverKey();
        program.setCoverKey(key, now());
        if (previous != null) storage.delete(previous);
        return storage.publicUrl(key);
    }

    /** Fjerner forsidebildet (idempotent). */
    @Transactional
    public void remove(UUID userId, UUID programId) {
        ProgramEntity program = owned(userId, programId);
        String previous = program.getCoverKey();
        if (previous == null) return;
        program.setCoverKey(null, now());
        storage.delete(previous);
    }

    /**
     * Gir en nedlastet kopi sitt eget eksemplar av originalens bilde, så kopien beholder bildet selv om
     * originalen endres eller slettes. Returnerer den nye nøkkelen, eller null hvis originalen ikke har bilde.
     */
    public String copyFor(String sourceKey, UUID copyProgramId) {
        if (sourceKey == null) return null;
        return storage.read(sourceKey).map(bytes -> {
            String key = newKey(copyProgramId);
            storage.write(key, bytes);
            return key;
        }).orElse(null);
    }

    private ProgramEntity owned(UUID userId, UUID programId) {
        return programs.findByIdAndOwnerUserId(programId, userId).orElseThrow(() -> new NotFoundException("Fant ikke programmet"));
    }

    private static String newKey(UUID programId) {
        return "covers/" + programId + "/" + UUID.randomUUID() + ".jpg";
    }

    private static Instant now() {
        return Instant.now().truncatedTo(ChronoUnit.MICROS);
    }
}
