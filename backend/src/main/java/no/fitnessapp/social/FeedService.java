package no.fitnessapp.social;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import no.fitnessapp.media.AvatarService;
import no.fitnessapp.media.MediaStorage;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;

/**
 * Feed og profiløkter. Sider med «før»-markør (startedAt for siste økt på forrige side), nyeste først.
 * Feeden viser egne økter og øktene til dem man følger (PUBLIC og FOLLOWERS), aldri PRIVATE fra andre.
 */
@Service
public class FeedService {

    private final JdbcClient jdbc;
    private final AvatarService avatars;
    private final MediaStorage storage;
    private final RecordCalculator records;

    public FeedService(JdbcClient jdbc, AvatarService avatars, MediaStorage storage, RecordCalculator records) {
        this.jdbc = jdbc;
        this.avatars = avatars;
        this.storage = storage;
        this.records = records;
    }

    private static final String FEED = """
            (w.user_id = :viewer
             OR (w.visibility IN ('PUBLIC', 'FOLLOWERS') AND EXISTS (
                   SELECT 1 FROM follows f WHERE f.follower_id = :viewer AND f.followee_id = w.user_id AND f.status = 'ACCEPTED')))
            """;

    public List<FeedItem> feed(UUID viewer, Instant before, int limit) {
        return query(viewer, FEED, null, before, limit);
    }

    /** Øktene til `author` som `viewer` kan se. */
    public List<FeedItem> byAuthor(UUID viewer, UUID author, Instant before, int limit) {
        return query(viewer, WorkoutAccess.VISIBLE + " AND w.user_id = :author", author, before, limit);
    }

    public FeedItem one(UUID viewer, UUID workoutId) {
        List<FeedItem> items = query(viewer, WorkoutAccess.VISIBLE + " AND w.id = :workout", workoutId, null, 1);
        return items.isEmpty() ? null : items.get(0);
    }

    private List<FeedItem> query(UUID viewer, String condition, UUID extra, Instant before, int limit) {
        var spec = jdbc.sql("""
                        SELECT w.id, w.name, w.description, w.started_at, w.ended_at, w.visibility,
                               u.id AS author_id, u.username, u.display_name, u.avatar_key, u.visibility AS author_visibility,
                               (SELECT f.status FROM follows f WHERE f.follower_id = :viewer AND f.followee_id = u.id) AS my_status,
                               (SELECT count(*) FROM workout_likes l WHERE l.workout_id = w.id) AS likes,
                               EXISTS (SELECT 1 FROM workout_likes l WHERE l.workout_id = w.id AND l.user_id = :viewer) AS liked,
                               (SELECT count(*) FROM workout_comments c WHERE c.workout_id = w.id) AS comments
                        FROM workouts w JOIN users u ON u.id = w.user_id
                        WHERE u.username IS NOT NULL AND """ + Blocks.visibleUser("u.id") + " AND " + condition + """
                          AND (CAST(:before AS timestamptz) IS NULL OR w.started_at < CAST(:before AS timestamptz))
                        ORDER BY w.started_at DESC
                        LIMIT :limit
                        """)
                .param("viewer", viewer)
                .param("before", before == null ? null : Timestamp.from(before))
                .param("limit", Math.max(1, Math.min(limit, 50)));
        if (extra != null) spec = spec.param("author", extra).param("workout", extra);

        record Row(UUID id, String name, String description, Instant startedAt, Instant endedAt, String visibility, UserSummary author,
                long likes, boolean liked, long comments) {}
        List<Row> rows = spec.query((rs, n) -> {
                    UUID authorId = rs.getObject("author_id", UUID.class);
                    String my = rs.getString("my_status");
                    FollowStatus status = my == null ? FollowStatus.NONE : my.equals("ACCEPTED") ? FollowStatus.FOLLOWING : FollowStatus.PENDING;
                    UserSummary author = new UserSummary(authorId, rs.getString("username"), rs.getString("display_name"),
                            avatars.urlFor(rs.getString("avatar_key")), "PRIVATE".equals(rs.getString("author_visibility")),
                            authorId.equals(viewer), status);
                    return new Row(rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("description"),
                            rs.getTimestamp("started_at").toInstant(), rs.getTimestamp("ended_at").toInstant(), rs.getString("visibility"),
                            author, rs.getLong("likes"), rs.getBoolean("liked"), rs.getLong("comments"));
                })
                .list();
        if (rows.isEmpty()) return List.of();
        List<UUID> ids = rows.stream().map(Row::id).toList();

        Map<UUID, List<FeedItem.ExerciseLine>> exercises = new HashMap<>();
        Map<UUID, Integer> sets = new HashMap<>();
        Map<UUID, BigDecimal> volume = new HashMap<>();
        jdbc.sql("""
                        SELECT we.workout_id, we.exercise_id, we.exercise_name, we.position,
                               count(s.id) FILTER (WHERE s.completed_at IS NOT NULL) AS done,
                               coalesce(sum(s.weight_kg * s.reps) FILTER (WHERE s.completed_at IS NOT NULL AND s.set_type <> 'WARMUP'), 0) AS vol
                        FROM workout_exercises we LEFT JOIN workout_sets s ON s.workout_exercise_id = we.id
                        WHERE we.workout_id IN (:ids)
                        GROUP BY we.workout_id, we.exercise_id, we.exercise_name, we.position
                        ORDER BY we.workout_id, we.position
                        """)
                .param("ids", ids)
                .query((rs, n) -> {
                    UUID wid = rs.getObject("workout_id", UUID.class);
                    int done = rs.getInt("done");
                    exercises.computeIfAbsent(wid, k -> new ArrayList<>())
                            .add(new FeedItem.ExerciseLine(rs.getObject("exercise_id", UUID.class), rs.getString("exercise_name"), done));
                    sets.merge(wid, done, Integer::sum);
                    volume.merge(wid, rs.getBigDecimal("vol"), BigDecimal::add);
                    return null;
                })
                .list();

        Map<UUID, List<String>> photos = new HashMap<>();
        jdbc.sql("SELECT workout_id, storage_key FROM workout_photos WHERE workout_id IN (:ids) ORDER BY position, created_at")
                .param("ids", ids)
                .query((rs, n) -> photos.computeIfAbsent(rs.getObject("workout_id", UUID.class), k -> new ArrayList<>())
                        .add(storage.publicUrl(rs.getString("storage_key"))))
                .list();

        Map<UUID, Map<UUID, List<RecordCalculator.SetRecord>>> recordsByWorkout = records.forWorkouts(ids);
        Map<UUID, List<UserSummary>> partners = partners(viewer, ids);

        return rows.stream()
                .map(r -> new FeedItem(r.id(), r.name(), r.description(), r.startedAt(), r.endedAt(), r.visibility(), r.author(),
                        exercises.getOrDefault(r.id(), List.of()), sets.getOrDefault(r.id(), 0),
                        volume.getOrDefault(r.id(), BigDecimal.ZERO), photos.getOrDefault(r.id(), List.of()),
                        r.likes(), r.liked(), r.comments(),
                        RecordCalculator.summary(recordsByWorkout.get(r.id())).count(),
                        RecordCalculator.summary(recordsByWorkout.get(r.id())).medals(),
                        partners.getOrDefault(r.id(), List.of())))
                .toList();
    }

    /** Treningspartnere per økt, uten brukere som er blokkert (begge veier) eller sperret. */
    public Map<UUID, List<UserSummary>> partners(UUID viewer, List<UUID> workoutIds) {
        Map<UUID, List<UserSummary>> out = new HashMap<>();
        if (workoutIds.isEmpty()) return out;
        jdbc.sql("""
                        SELECT p.workout_id, u.id, u.username, u.display_name, u.avatar_key, u.visibility,
                               (SELECT f.status FROM follows f WHERE f.follower_id = :viewer AND f.followee_id = u.id) AS my_status
                        FROM workout_partners p JOIN users u ON u.id = p.user_id
                        WHERE p.workout_id IN (:ids) AND u.username IS NOT NULL AND """ + Blocks.visibleUser("u.id") + """

                        ORDER BY p.created_at
                        """)
                .param("ids", workoutIds).param("viewer", viewer)
                .query((rs, n) -> {
                    UUID id = rs.getObject("id", UUID.class);
                    String my = rs.getString("my_status");
                    FollowStatus status = my == null ? FollowStatus.NONE : my.equals("ACCEPTED") ? FollowStatus.FOLLOWING : FollowStatus.PENDING;
                    out.computeIfAbsent(rs.getObject("workout_id", UUID.class), k -> new ArrayList<>())
                            .add(new UserSummary(id, rs.getString("username"), rs.getString("display_name"), avatars.urlFor(rs.getString("avatar_key")),
                                    "PRIVATE".equals(rs.getString("visibility")), id.equals(viewer), status));
                    return 0;
                })
                .list();
        return out;
    }
}
