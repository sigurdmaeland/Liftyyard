package no.fitnessapp.users;

import java.sql.Date;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.Optional;
import java.util.UUID;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.common.ConflictException;
import no.fitnessapp.common.NotFoundException;
import no.fitnessapp.media.AvatarService;
import no.fitnessapp.social.FollowService;
import org.springframework.dao.DuplicateKeyException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/** Egen profil, brukernavn og offentlige profiler. */
@Service
public class ProfileService {

    private final JdbcClient jdbc;
    private final AvatarService avatars;
    private final FollowService follows;
    private final String termsVersion;

    /** Minstealder for å bruke appen (samtykkealder for informasjonssamfunnstjenester i Norge). */
    public static final int MINIMUM_AGE = 13;

    public ProfileService(JdbcClient jdbc, AvatarService avatars, FollowService follows,
            @org.springframework.beans.factory.annotation.Value("${app.terms.version}") String termsVersion) {
        this.jdbc = jdbc;
        this.avatars = avatars;
        this.follows = follows;
        this.termsVersion = termsVersion;
    }

    /** Registrerer at brukeren har godtatt gjeldende vilkår og bekreftet alderen. */
    public ProfileDto acceptTerms(UUID userId, String version, boolean confirmsMinimumAge) {
        if (!termsVersion.equals(version)) throw new BadRequestException("Vilkårene er oppdatert. Last inn på nytt og les dem først.");
        if (!confirmsMinimumAge) throw new BadRequestException("Du må være minst " + MINIMUM_AGE + " år for å bruke appen");
        jdbc.sql("UPDATE users SET terms_version = :v, terms_accepted_at = now(), updated_at = now() WHERE id = :id")
                .param("v", version).param("id", userId).update();
        return get(userId);
    }

    public ProfileDto get(UUID userId) {
        return jdbc.sql("""
                        SELECT username, coalesce(first_name, display_name) AS first_name, last_name, bio, birth_date, gender,
                               instagram, tiktok, youtube, website, visibility, avatar_key, role, terms_version
                        FROM users WHERE id = :id
                        """)
                .param("id", userId)
                .query((rs, n) -> new ProfileDto(rs.getString("username"), rs.getString("first_name"), rs.getString("last_name"),
                        rs.getString("bio"), date(rs), rs.getString("gender"), rs.getString("instagram"), rs.getString("tiktok"),
                        rs.getString("youtube"), rs.getString("website"), rs.getString("visibility"),
                        avatars.urlFor(rs.getString("avatar_key")), rs.getString("role"), rs.getString("terms_version"), termsVersion))
                .optional()
                .orElseThrow(() -> new NotFoundException("Fant ikke brukeren"));
    }

    private static java.time.LocalDate date(ResultSet rs) throws SQLException {
        Date d = rs.getDate("birth_date");
        return d == null ? null : d.toLocalDate();
    }

    public ProfileDto update(UUID userId, ProfileUpdate body) {
        if (body.birthDate() != null && body.birthDate().isAfter(java.time.LocalDate.now().minusYears(MINIMUM_AGE))) {
            throw new BadRequestException("Du må være minst " + MINIMUM_AGE + " år for å bruke appen");
        }
        int updated = jdbc.sql("""
                        UPDATE users SET display_name = :display, first_name = :first, last_name = :last, bio = :bio,
                               birth_date = :birth, gender = :gender, instagram = :ig, tiktok = :tt, youtube = :yt,
                               website = :web, visibility = coalesce(:vis, visibility), updated_at = now()
                        WHERE id = :id
                        """)
                .param("display", body.displayName()).param("first", body.firstName().trim()).param("last", blankToNull(body.lastName()))
                .param("bio", blankToNull(body.bio())).param("birth", body.birthDate() == null ? null : Date.valueOf(body.birthDate()))
                .param("gender", body.gender()).param("ig", blankToNull(body.instagram())).param("tt", blankToNull(body.tiktok()))
                .param("yt", blankToNull(body.youtube())).param("web", blankToNull(body.website())).param("vis", body.visibility())
                .param("id", userId)
                .update();
        if (updated == 0) throw new NotFoundException("Fant ikke brukeren");
        return get(userId);
    }

    public record Availability(String username, boolean available, String reason) {}

    public Availability availability(UUID userId, String raw) {
        String u = UsernameRules.normalize(raw);
        Optional<String> problem = UsernameRules.problem(u);
        if (problem.isPresent()) return new Availability(u, false, problem.get());
        Optional<UUID> owner = jdbc.sql("SELECT id FROM users WHERE username = :u").param("u", u).query(UUID.class).optional();
        if (owner.isPresent() && !owner.get().equals(userId)) return new Availability(u, false, "Brukernavnet er tatt");
        return new Availability(u, true, null);
    }

    public ProfileDto setUsername(UUID userId, String raw) {
        Availability a = availability(userId, raw);
        if (!a.available()) {
            if ("Brukernavnet er tatt".equals(a.reason())) throw new ConflictException(a.reason());
            throw new BadRequestException(a.reason());
        }
        try {
            jdbc.sql("UPDATE users SET username = :u, updated_at = now() WHERE id = :id").param("u", a.username()).param("id", userId).update();
        } catch (DuplicateKeyException e) {
            throw new ConflictException("Brukernavnet er tatt");
        }
        return get(userId);
    }

    /** En profil slik `viewerId` ser den. Private profiler viser bare navn, brukernavn, bilde og bio til andre enn følgere. */
    public PublicProfileDto publicProfile(UUID viewerId, String rawUsername) {
        String u = UsernameRules.normalize(rawUsername);
        UUID targetId = follows.requireUserId(u);
        boolean blockedByYou = false;
        if (!targetId.equals(viewerId)) {
            // Har brukeren blokkert deg, eller er kontoen sperret, finnes profilen ikke for deg.
            boolean hidden = jdbc.sql("""
                            SELECT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = :t AND blocked_id = :v)
                                OR EXISTS (SELECT 1 FROM users WHERE id = :t AND suspended_at IS NOT NULL)
                            """)
                    .param("t", targetId).param("v", viewerId).query(Boolean.class).single();
            if (hidden) throw new NotFoundException("Fant ikke brukeren");
            blockedByYou = jdbc.sql("SELECT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = :v AND blocked_id = :t)")
                    .param("t", targetId).param("v", viewerId).query(Boolean.class).single();
        }
        final boolean blocked = blockedByYou;
        return jdbc.sql("""
                        SELECT u.id, u.username, u.display_name, u.bio, u.avatar_key, u.visibility, u.instagram, u.tiktok,
                               u.youtube, u.website, (SELECT count(*) FROM workouts w WHERE w.user_id = u.id) AS workouts
                        FROM users u WHERE u.username = :u
                        """)
                .param("u", u)
                .query((rs, n) -> {
                    UUID id = rs.getObject("id", UUID.class);
                    boolean self = id.equals(viewerId);
                    boolean isPrivate = "PRIVATE".equals(rs.getString("visibility"));
                    boolean content = follows.canViewContent(viewerId, id);
                    boolean full = !blocked && (content || !isPrivate);
                    FollowService.Counts counts = follows.counts(id);
                    return new PublicProfileDto(id, rs.getString("username"), rs.getString("display_name"), blocked ? null : rs.getString("bio"),
                            avatars.urlFor(rs.getString("avatar_key")), isPrivate, self,
                            full ? rs.getLong("workouts") : null,
                            full ? counts.followers() : null,
                            full ? counts.following() : null,
                            follows.status(viewerId, id),
                            follows.followsYou(viewerId, id).orElse(false),
                            full,
                            full ? rs.getString("instagram") : null, full ? rs.getString("tiktok") : null,
                            full ? rs.getString("youtube") : null, full ? rs.getString("website") : null, blocked);
                })
                .optional()
                .orElseThrow(() -> new NotFoundException("Fant ikke brukeren"));
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
