package no.fitnessapp.media;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.NoSuchFileException;
import java.nio.file.Path;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/** Lagrer filer i en mappe på disken (utvikling). Nøkler kontrolleres slik at ingen kan nå filer utenfor mappen. */
@Component
@ConditionalOnProperty(name = "app.media.storage", havingValue = "local", matchIfMissing = true)
class LocalMediaStorage implements MediaStorage {

    private static final Pattern SAFE_KEY = Pattern.compile("^[a-z]+(/[A-Za-z0-9-]+)+(\\.jpg)?$");

    private final Path root;
    private final MediaProperties props;

    LocalMediaStorage(MediaProperties props) {
        this.props = props;
        this.root = Path.of(props.dir()).toAbsolutePath().normalize();
    }

    private Path resolve(String key) {
        if (key == null || !SAFE_KEY.matcher(key).matches()) throw new IllegalArgumentException("Ugyldig nøkkel");
        Path path = root.resolve(key).normalize();
        if (!path.startsWith(root)) throw new IllegalArgumentException("Ugyldig nøkkel");
        return path;
    }

    @Override
    public void write(String key, byte[] data) {
        try {
            Path path = resolve(key);
            Files.createDirectories(path.getParent());
            Files.write(path, data);
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public Optional<byte[]> read(String key) {
        try {
            return Optional.of(Files.readAllBytes(resolve(key)));
        } catch (NoSuchFileException | IllegalArgumentException e) {
            return Optional.empty();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public void delete(String key) {
        try {
            Files.deleteIfExists(resolve(key));
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    @Override
    public String publicUrl(String key) {
        return props.publicUrl().replaceAll("/$", "") + "/" + key;
    }
}
