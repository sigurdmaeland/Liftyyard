package no.fitnessapp.auth;

import com.nimbusds.jose.jwk.source.ImmutableSecret;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.Base64;
import java.util.HexFormat;
import java.util.Optional;
import java.util.UUID;
import javax.crypto.SecretKey;
import javax.crypto.spec.SecretKeySpec;
import no.fitnessapp.common.ForbiddenException;
import no.fitnessapp.common.UnauthenticatedException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.security.oauth2.jose.jws.MacAlgorithm;
import org.springframework.security.oauth2.jwt.JwsHeader;
import org.springframework.security.oauth2.jwt.JwtClaimsSet;
import org.springframework.security.oauth2.jwt.JwtEncoder;
import org.springframework.security.oauth2.jwt.JwtEncoderParameters;
import org.springframework.security.oauth2.jwt.NimbusJwtEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Utsteder våre egne tokens:
 * - tilgangstoken: kortlivet JWT (HS256) med bruker-ID som «sub», sendes med hver forespørsel.
 * - fornyelsestoken: tilfeldig verdi som byttes mot nye tokens. Bare hashen lagres. Hvert token kan brukes
 *   én gang; gjenbruk av et brukt token trekker tilbake hele innloggingsøkten (family).
 */
@Service
public class TokenService {

    public static final String ISSUER = "fitness-app";

    private final AuthProperties props;
    private final JdbcClient jdbc;
    private final JwtEncoder encoder;
    private final SecureRandom random = new SecureRandom();

    public TokenService(AuthProperties props, JdbcClient jdbc) {
        this.props = props;
        this.jdbc = jdbc;
        this.encoder = new NimbusJwtEncoder(new ImmutableSecret<>(signingKey(props)));
    }

    static SecretKey signingKey(AuthProperties props) {
        return new SecretKeySpec(props.jwtSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256");
    }

    public record Tokens(String accessToken, String refreshToken, long expiresIn) {}

    /** Ny innlogging: ny familie av fornyelsestokens. */
    @Transactional
    public Tokens issue(UUID userId) {
        return issue(userId, UUID.randomUUID());
    }

    private Tokens issue(UUID userId, UUID familyId) {
        boolean suspended = jdbc.sql("SELECT suspended_at IS NOT NULL FROM users WHERE id = :id").param("id", userId)
                .query(Boolean.class).optional().orElse(false);
        if (suspended) throw new ForbiddenException("Kontoen er sperret. Ta kontakt hvis du mener dette er feil.");
        Instant now = Instant.now();
        JwtClaimsSet claims = JwtClaimsSet.builder()
                .issuer(ISSUER)
                .subject(userId.toString())
                .issuedAt(now)
                .expiresAt(now.plus(props.accessTokenTtl()))
                .build();
        String access = encoder.encode(JwtEncoderParameters.from(JwsHeader.with(MacAlgorithm.HS256).build(), claims)).getTokenValue();

        byte[] bytes = new byte[32];
        random.nextBytes(bytes);
        String refresh = Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
        jdbc.sql("""
                        INSERT INTO refresh_tokens (id, user_id, family_id, token_hash, expires_at)
                        VALUES (:id, :u, :f, :h, :exp)
                        """)
                .param("id", UUID.randomUUID()).param("u", userId).param("f", familyId).param("h", sha256(refresh))
                .param("exp", Timestamp.from(now.plus(props.refreshTokenTtl())))
                .update();
        return new Tokens(access, refresh, props.accessTokenTtl().toSeconds());
    }

    private record Row(UUID id, UUID userId, UUID familyId, Instant expiresAt, Instant revokedAt) {}

    /** Bytter et fornyelsestoken mot nye tokens. Ugyldig, utløpt eller gjenbrukt token gir 401. */
    @Transactional(noRollbackFor = UnauthenticatedException.class)
    public Tokens refresh(String refreshToken) {
        Row row = find(refreshToken).orElseThrow(UnauthenticatedException::new);
        if (row.revokedAt() != null) {
            // Allerede brukt: noen kan ha stjålet tokenet. Logg ut hele økten.
            revokeFamily(row.familyId());
            throw new UnauthenticatedException();
        }
        if (row.expiresAt().isBefore(Instant.now())) throw new UnauthenticatedException();
        jdbc.sql("UPDATE refresh_tokens SET revoked_at = now() WHERE id = :id").param("id", row.id()).update();
        return issue(row.userId(), row.familyId());
    }

    /** Logger ut: trekker tilbake hele økten tokenet hører til. Ukjent token ignoreres. */
    @Transactional
    public void revoke(String refreshToken) {
        find(refreshToken).ifPresent(r -> revokeFamily(r.familyId()));
    }

    private Optional<Row> find(String refreshToken) {
        return jdbc.sql("""
                        SELECT id, user_id, family_id, expires_at, revoked_at FROM refresh_tokens
                        WHERE token_hash = :h FOR UPDATE
                        """)
                .param("h", sha256(refreshToken))
                .query((rs, n) -> new Row(
                        rs.getObject("id", UUID.class),
                        rs.getObject("user_id", UUID.class),
                        rs.getObject("family_id", UUID.class),
                        rs.getTimestamp("expires_at").toInstant(),
                        rs.getTimestamp("revoked_at") == null ? null : rs.getTimestamp("revoked_at").toInstant()))
                .optional();
    }

    private void revokeFamily(UUID familyId) {
        jdbc.sql("UPDATE refresh_tokens SET revoked_at = now() WHERE family_id = :f AND revoked_at IS NULL")
                .param("f", familyId).update();
    }

    static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
