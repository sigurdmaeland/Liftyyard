package no.fitnessapp.media;

import java.time.Duration;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RestController;

/**
 * Serverer offentlige bilder (profilbilder) lokalt. Hvert bilde har en unik nøkkel og endres aldri,
 * så det kan mellomlagres lenge. I drift tas dette over av objektlagringen/CDN.
 */
@RestController
public class MediaController {

    private final MediaStorage storage;

    public MediaController(MediaStorage storage) {
        this.storage = storage;
    }

    /**
     * Profilbilder og øktbilder. Øktbilder har uforutsigbare adresser (tilfeldig ID) som bare deles med
     * dem som kan se økten. I drift erstattes dette av kortlivede signerte lenker fra objektlagringen.
     */
    @GetMapping("/media/{kind:avatars|photos}/{userId}/{file}")
    public ResponseEntity<byte[]> file(@PathVariable String kind, @PathVariable String userId, @PathVariable String file) {
        return storage.read(kind + "/" + userId + "/" + file)
                .map(bytes -> ResponseEntity.ok()
                        .contentType(MediaType.IMAGE_JPEG)
                        .cacheControl(CacheControl.maxAge(Duration.ofDays(365)).cachePublic().immutable())
                        .body(bytes))
                .orElseGet(() -> ResponseEntity.notFound().build());
    }
}
