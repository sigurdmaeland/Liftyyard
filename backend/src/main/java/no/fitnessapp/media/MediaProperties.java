package no.fitnessapp.media;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Lagring av bilder. Lokalt en mappe (dir) som backend selv serverer under /media. publicUrl er
 * adressen telefonen henter bildene fra. Når vi velger skytilbyder, byttes MediaStorage til S3/R2.
 */
@ConfigurationProperties("app.media")
public record MediaProperties(String dir, String publicUrl) {}
