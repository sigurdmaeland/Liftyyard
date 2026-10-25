package no.fitnessapp.media;

import java.util.Optional;

/** Lagring av filer under nøkler som «avatars/<bruker>/<id>.jpg». */
public interface MediaStorage {

    void write(String key, byte[] data);

    Optional<byte[]> read(String key);

    void delete(String key);

    /** Offentlig adresse for filer som skal kunne vises for alle (profilbilder). */
    String publicUrl(String key);
}
