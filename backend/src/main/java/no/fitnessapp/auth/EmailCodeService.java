package no.fitnessapp.auth;

import java.nio.charset.StandardCharsets;
import java.security.InvalidKeyException;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.HexFormat;
import java.util.Locale;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.common.TooManyRequestsException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * «Fortsett med e-post»: en sekssifret engangskode sendes på e-post og byttes mot innlogging.
 * Koden gjelder i 10 minutter, tåler 5 feilforsøk, og det kan sendes maks app.auth.max-codes-per-hour koder per adresse i timen (5 som standard).
 * Bare en HMAC av koden lagres.
 */
@Service
public class EmailCodeService {

    static final Duration TTL = Duration.ofMinutes(10);
    static final int MAX_ATTEMPTS = 5;

    private final JdbcClient jdbc;
    private final LoginMailer mailer;
    private final AuthProperties props;
    private final SecureRandom random = new SecureRandom();

    public EmailCodeService(JdbcClient jdbc, LoginMailer mailer, AuthProperties props) {
        this.jdbc = jdbc;
        this.mailer = mailer;
        this.props = props;
    }

    public static String normalize(String email) {
        return email.trim().toLowerCase(Locale.ROOT);
    }

    @Transactional
    public void start(String rawEmail) {
        String email = normalize(rawEmail);
        long recent = jdbc.sql("SELECT count(*) FROM email_login_codes WHERE email = :e AND created_at > now() - interval '1 hour'")
                .param("e", email).query(Long.class).single();
        if (props.maxCodesPerHour() > 0 && recent >= props.maxCodesPerHour()) {
            throw new TooManyRequestsException("For mange koder sendt. Prøv igjen om en stund.");
        }
        String code = String.format("%06d", random.nextInt(1_000_000));
        jdbc.sql("""
                        INSERT INTO email_login_codes (id, email, code_hash, expires_at)
                        VALUES (:id, :e, :h, :exp)
                        """)
                .param("id", UUID.randomUUID()).param("e", email).param("h", hash(email, code))
                .param("exp", Timestamp.from(Instant.now().plus(TTL)))
                .update();
        mailer.sendLoginCode(email, code);
    }

    private record Pending(UUID id, String codeHash, int attempts) {}

    /** Kontrollerer koden mot den nyeste gyldige koden for adressen. Returnerer normalisert e-post. */
    @Transactional(noRollbackFor = BadRequestException.class)
    public String verify(String rawEmail, String code) {
        String email = normalize(rawEmail);
        Pending pending = jdbc.sql("""
                        SELECT id, code_hash, attempts FROM email_login_codes
                        WHERE email = :e AND consumed_at IS NULL AND expires_at > now()
                        ORDER BY created_at DESC LIMIT 1 FOR UPDATE
                        """)
                .param("e", email)
                .query((rs, n) -> new Pending(rs.getObject("id", UUID.class), rs.getString("code_hash"), rs.getInt("attempts")))
                .optional()
                .orElseThrow(() -> new BadRequestException("Koden er feil eller utløpt"));
        if (pending.attempts() >= MAX_ATTEMPTS) {
            throw new BadRequestException("For mange feil forsøk. Be om en ny kode.");
        }
        if (!java.security.MessageDigest.isEqual(
                pending.codeHash().getBytes(StandardCharsets.UTF_8), hash(email, code.trim()).getBytes(StandardCharsets.UTF_8))) {
            jdbc.sql("UPDATE email_login_codes SET attempts = attempts + 1 WHERE id = :id").param("id", pending.id()).update();
            throw new BadRequestException("Koden er feil eller utløpt");
        }
        jdbc.sql("UPDATE email_login_codes SET consumed_at = now() WHERE id = :id").param("id", pending.id()).update();
        return email;
    }

    private String hash(String email, String code) {
        try {
            Mac mac = Mac.getInstance("HmacSHA256");
            mac.init(new SecretKeySpec(props.jwtSecret().getBytes(StandardCharsets.UTF_8), "HmacSHA256"));
            return HexFormat.of().formatHex(mac.doFinal((email + ":" + code).getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException | InvalidKeyException e) {
            throw new IllegalStateException(e);
        }
    }
}
