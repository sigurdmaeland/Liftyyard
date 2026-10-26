package no.fitnessapp.media;

import java.net.URI;
import java.util.Optional;
import java.util.regex.Pattern;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;
import software.amazon.awssdk.auth.credentials.AwsBasicCredentials;
import software.amazon.awssdk.auth.credentials.StaticCredentialsProvider;
import software.amazon.awssdk.core.checksums.RequestChecksumCalculation;
import software.amazon.awssdk.core.checksums.ResponseChecksumValidation;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

/**
 * Lagrer filer i Cloudflare R2 (S3-kompatibel). Bildene leses av telefonen direkte fra bøttens
 * offentlige domene (publicUrl), så backend sender ikke bildedata i drift. Nøklene inneholder
 * tilfeldige ID-er og endres aldri, så de kan mellomlagres for alltid.
 */
@Component
@ConditionalOnProperty(name = "app.media.storage", havingValue = "s3")
class S3MediaStorage implements MediaStorage {

    private static final Pattern SAFE_KEY = Pattern.compile("^[a-z]+(/[A-Za-z0-9-]+)+(\\.jpg)?$");

    private final S3Client s3;
    private final String bucket;
    private final String publicUrl;

    S3MediaStorage(MediaProperties props) {
        MediaProperties.S3 c = props.s3();
        if (c == null || blank(c.endpoint()) || blank(c.bucket()) || blank(c.accessKey()) || blank(c.secretKey())) {
            throw new IllegalStateException(
                    "MEDIA_STORAGE=s3 krever S3_ENDPOINT, S3_BUCKET, S3_ACCESS_KEY og S3_SECRET_KEY (se docs/deploy-railway.md).");
        }
        if (blank(props.publicUrl())) throw new IllegalStateException("MEDIA_PUBLIC_URL mangler (R2-bøttens offentlige adresse).");
        this.bucket = c.bucket();
        this.publicUrl = props.publicUrl().replaceAll("/$", "");
        this.s3 = S3Client.builder()
                .endpointOverride(URI.create(c.endpoint()))
                .region(Region.of(blank(c.region()) ? "auto" : c.region()))
                .credentialsProvider(StaticCredentialsProvider.create(AwsBasicCredentials.create(c.accessKey(), c.secretKey())))
                // R2 bruker adresser på formen <endpoint>/<bøtte>/<nøkkel>.
                .forcePathStyle(true)
                // Bare sjekksummer der S3-API-et krever det; gir best samspill med R2.
                .requestChecksumCalculation(RequestChecksumCalculation.WHEN_REQUIRED)
                .responseChecksumValidation(ResponseChecksumValidation.WHEN_REQUIRED)
                .build();
    }

    private static boolean blank(String s) {
        return s == null || s.isBlank();
    }

    private static String check(String key) {
        if (key == null || !SAFE_KEY.matcher(key).matches()) throw new IllegalArgumentException("Ugyldig nøkkel");
        return key;
    }

    @Override
    public void write(String key, byte[] data) {
        s3.putObject(
                b -> b.bucket(bucket).key(check(key)).contentType("image/jpeg").cacheControl("public, max-age=31536000, immutable"),
                RequestBody.fromBytes(data));
    }

    @Override
    public Optional<byte[]> read(String key) {
        try {
            return Optional.of(s3.getObjectAsBytes(b -> b.bucket(bucket).key(check(key))).asByteArray());
        } catch (NoSuchKeyException | IllegalArgumentException e) {
            return Optional.empty();
        }
    }

    @Override
    public void delete(String key) {
        s3.deleteObject(b -> b.bucket(bucket).key(check(key)));
    }

    @Override
    public String publicUrl(String key) {
        return publicUrl + "/" + check(key);
    }
}
