package no.fitnessapp.media;

import java.util.UUID;
import no.fitnessapp.common.BadRequestException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Profilbilder: originalen beskjæres til kvadrat, skaleres til 512×512 og lagres som ny JPEG uten
 * metadata (avatars/<bruker>/<id>.jpg). Originalen lagres aldri. Forrige bilde slettes.
 */
@Service
public class AvatarService {

    static final long MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
    static final int SIZE = 512;

    private final MediaStorage storage;
    private final JdbcClient jdbc;

    public AvatarService(MediaStorage storage, JdbcClient jdbc) {
        this.storage = storage;
        this.jdbc = jdbc;
    }

    /** Gjør et opplastet bilde til profilbilde. Returnerer den offentlige adressen. */
    public String replace(UUID userId, byte[] original) {
        if (original.length == 0) throw new BadRequestException("Tom fil");
        if (original.length > MAX_UPLOAD_BYTES) throw new BadRequestException("Bildet er større enn 10 MB");
        byte[] avatar = ImageProcessor.squareJpeg(original, SIZE);
        String key = "avatars/" + userId + "/" + UUID.randomUUID() + ".jpg";
        storage.write(key, avatar);
        String previous = currentKey(userId);
        jdbc.sql("UPDATE users SET avatar_key = :k, updated_at = now() WHERE id = :id").param("k", key).param("id", userId).update();
        if (previous != null) storage.delete(previous);
        return storage.publicUrl(key);
    }

    public void remove(UUID userId) {
        String previous = currentKey(userId);
        jdbc.sql("UPDATE users SET avatar_key = NULL, updated_at = now() WHERE id = :id").param("id", userId).update();
        if (previous != null) storage.delete(previous);
    }

    public String urlFor(String avatarKey) {
        return avatarKey == null ? null : storage.publicUrl(avatarKey);
    }

    private String currentKey(UUID userId) {
        return jdbc.sql("SELECT avatar_key FROM users WHERE id = :id").param("id", userId).query(String.class).optional().orElse(null);
    }
}
