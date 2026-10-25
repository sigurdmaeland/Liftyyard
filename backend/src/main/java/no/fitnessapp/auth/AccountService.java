package no.fitnessapp.auth;

import java.util.Optional;
import java.util.UUID;
import no.fitnessapp.common.NotFoundException;
import no.fitnessapp.media.AvatarService;
import no.fitnessapp.media.MediaStorage;
import no.fitnessapp.social.InteractionService;
import no.fitnessapp.users.DevUserProperties;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/** Kontoer: finner eller oppretter brukeren bak en innlogging, flytter utviklingsdata og sletter konto. */
@Service
public class AccountService {

    public enum Provider { GOOGLE, EMAIL, APPLE }

    public record Account(UUID userId, boolean created) {}

    private final JdbcClient jdbc;
    private final DevUserProperties devUser;
    private final AvatarService avatars;
    private final InteractionService interactions;
    private final MediaStorage storage;

    public AccountService(JdbcClient jdbc, DevUserProperties devUser, AvatarService avatars, InteractionService interactions,
            MediaStorage storage) {
        this.jdbc = jdbc;
        this.devUser = devUser;
        this.avatars = avatars;
        this.interactions = interactions;
        this.storage = storage;
    }

    /**
     * Finner brukeren for en innlogging, eller oppretter en ny. Er e-postadressen bekreftet og allerede
     * knyttet til en annen innloggingsmetode, kobles den nye metoden til samme bruker.
     */
    @Transactional
    public Account findOrCreate(Provider provider, String subject, String email, boolean emailVerified, String suggestedName) {
        Optional<UUID> existing = jdbc.sql("SELECT user_id FROM user_identities WHERE provider = :p AND subject = :s")
                .param("p", provider.name()).param("s", subject).query(UUID.class).optional();
        if (existing.isPresent()) return new Account(existing.get(), false);

        Optional<UUID> sameEmail = emailVerified && email != null
                ? jdbc.sql("SELECT user_id FROM user_identities WHERE lower(email) = lower(:e) LIMIT 1")
                        .param("e", email).query(UUID.class).optional()
                : Optional.empty();
        boolean created = sameEmail.isEmpty();
        UUID userId = sameEmail.orElseGet(() -> {
            UUID id = UUID.randomUUID();
            jdbc.sql("INSERT INTO users (id, email, display_name) VALUES (:id, :email, :name)")
                    .param("id", id)
                    .param("email", emailVerified ? email : null)
                    .param("name", displayName(suggestedName, email))
                    .update();
            return id;
        });
        jdbc.sql("INSERT INTO user_identities (provider, subject, user_id, email) VALUES (:p, :s, :u, :e)")
                .param("p", provider.name()).param("s", subject).param("u", userId).param("e", email)
                .update();
        return new Account(userId, created);
    }

    private static String displayName(String suggested, String email) {
        String name = suggested != null && !suggested.isBlank() ? suggested.trim()
                : email != null ? email.substring(0, Math.max(1, email.indexOf('@'))) : "Ny bruker";
        return name.length() > 100 ? name.substring(0, 100) : name;
    }

    /**
     * Bare lokal utvikling: flytter alt utviklingsbrukeren eier (økter, programmer, rutiner, egne øvelser,
     * favoritter, målinger, innstillinger og profilfelt) til den innloggede brukeren. Returnerer antall økter flyttet.
     */
    @Transactional
    public int claimDevData(UUID userId) {
        if (!devUser.enabled() || devUser.id() == null) throw new NotFoundException("Finnes ikke");
        UUID dev = devUser.id();
        if (dev.equals(userId)) return 0;
        int workouts = move("UPDATE workouts SET user_id = :new WHERE user_id = :dev", userId, dev);
        move("UPDATE exercises SET owner_user_id = :new WHERE owner_user_id = :dev", userId, dev);
        move("UPDATE programs SET owner_user_id = :new WHERE owner_user_id = :dev", userId, dev);
        move("UPDATE routines SET owner_user_id = :new WHERE owner_user_id = :dev", userId, dev);
        move("""
                DELETE FROM routine_favorites d WHERE d.user_id = :dev
                AND EXISTS (SELECT 1 FROM routine_favorites n WHERE n.user_id = :new AND n.routine_id = d.routine_id)
                """, userId, dev);
        move("UPDATE routine_favorites SET user_id = :new WHERE user_id = :dev", userId, dev);
        move("""
                DELETE FROM exercise_favorites d WHERE d.user_id = :dev
                AND EXISTS (SELECT 1 FROM exercise_favorites n WHERE n.user_id = :new AND n.exercise_id = d.exercise_id)
                """, userId, dev);
        move("UPDATE exercise_favorites SET user_id = :new WHERE user_id = :dev", userId, dev);
        move("UPDATE body_measurements SET user_id = :new WHERE user_id = :dev", userId, dev);
        move("""
                INSERT INTO user_settings (user_id, goal_weight_kg)
                SELECT :new, goal_weight_kg FROM user_settings WHERE user_id = :dev
                ON CONFLICT (user_id) DO NOTHING
                """, userId, dev);
        move("""
                UPDATE users n SET first_name = d.first_name, last_name = d.last_name, bio = d.bio,
                       birth_date = d.birth_date, gender = d.gender, instagram = d.instagram, tiktok = d.tiktok,
                       youtube = d.youtube, website = d.website, display_name = d.display_name
                FROM users d WHERE n.id = :new AND d.id = :dev AND n.first_name IS NULL AND d.first_name IS NOT NULL
                """, userId, dev);
        return workouts;
    }

    private int move(String sql, UUID newUser, UUID dev) {
        return jdbc.sql(sql).param("new", newUser).param("dev", dev).update();
    }

    /** Sletter kontoen og alle data som hører til (via ON DELETE CASCADE). */
    @Transactional
    public void delete(UUID userId) {
        avatars.remove(userId);
        interactions.photoKeysForUser(userId).forEach(storage::delete);
        jdbc.sql("DELETE FROM users WHERE id = :id").param("id", userId).update();
    }
}
