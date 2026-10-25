package no.fitnessapp.social;

import java.util.List;
import java.util.UUID;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.media.AvatarService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Blokkering. Når du blokkerer noen, fjernes følgingen begge veier og varslene mellom dere, og
 * dere slutter å se hverandres profil og innhold. Den blokkerte får ikke beskjed.
 */
@Service
public class BlockService {

    private final JdbcClient jdbc;
    private final FollowService follows;
    private final AvatarService avatars;

    public BlockService(JdbcClient jdbc, FollowService follows, AvatarService avatars) {
        this.jdbc = jdbc;
        this.follows = follows;
        this.avatars = avatars;
    }

    @Transactional
    public void block(UUID viewer, String username) {
        UUID target = follows.requireUserId(username);
        if (target.equals(viewer)) throw new BadRequestException("Du kan ikke blokkere deg selv");
        jdbc.sql("INSERT INTO blocks (blocker_id, blocked_id) VALUES (:a, :b) ON CONFLICT DO NOTHING")
                .param("a", viewer).param("b", target).update();
        jdbc.sql("""
                        DELETE FROM follows WHERE (follower_id = :a AND followee_id = :b) OR (follower_id = :b AND followee_id = :a)
                        """)
                .param("a", viewer).param("b", target).update();
        jdbc.sql("""
                        DELETE FROM notifications WHERE (recipient_id = :a AND actor_id = :b) OR (recipient_id = :b AND actor_id = :a)
                        """)
                .param("a", viewer).param("b", target).update();
    }

    public void unblock(UUID viewer, String username) {
        UUID target = follows.requireUserId(username);
        jdbc.sql("DELETE FROM blocks WHERE blocker_id = :a AND blocked_id = :b").param("a", viewer).param("b", target).update();
    }

    /** Har `viewer` blokkert `target`? */
    public boolean hasBlocked(UUID viewer, UUID target) {
        return jdbc.sql("SELECT EXISTS (SELECT 1 FROM blocks WHERE blocker_id = :a AND blocked_id = :b)")
                .param("a", viewer).param("b", target).query(Boolean.class).single();
    }

    /** Brukere du har blokkert, nyeste først. */
    public List<UserSummary> blocked(UUID viewer) {
        return jdbc.sql("""
                        SELECT u.id, u.username, u.display_name, u.avatar_key, u.visibility
                        FROM blocks b JOIN users u ON u.id = b.blocked_id
                        WHERE b.blocker_id = :v AND u.username IS NOT NULL
                        ORDER BY b.created_at DESC
                        """)
                .param("v", viewer)
                .query((rs, n) -> new UserSummary(rs.getObject("id", UUID.class), rs.getString("username"), rs.getString("display_name"),
                        avatars.urlFor(rs.getString("avatar_key")), "PRIVATE".equals(rs.getString("visibility")), false, FollowStatus.NONE))
                .list();
    }
}
