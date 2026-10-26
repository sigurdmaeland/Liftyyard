package no.fitnessapp.media;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Lagring av bilder. storage=local: en mappe (dir) som backend selv serverer under /media.
 * storage=s3: Cloudflare R2 (eller annen S3-kompatibel lagring), der bildene hentes fra publicUrl
 * (R2-bøttens offentlige domene). publicUrl er alltid adressen telefonen henter bildene fra.
 */
@ConfigurationProperties("app.media")
public record MediaProperties(String storage, String dir, String publicUrl, S3 s3) {

    public record S3(String endpoint, String region, String bucket, String accessKey, String secretKey) {}
}
