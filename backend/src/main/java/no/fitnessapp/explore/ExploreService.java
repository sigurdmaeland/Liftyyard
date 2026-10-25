package no.fitnessapp.explore;

import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.function.UnaryOperator;
import no.fitnessapp.common.ConflictException;
import no.fitnessapp.common.NotFoundException;
import no.fitnessapp.media.AvatarService;
import no.fitnessapp.programs.api.Credit;
import no.fitnessapp.programs.api.ProgramResponse;
import no.fitnessapp.programs.api.RoutineResponse;
import no.fitnessapp.programs.application.CreditResolver;
import no.fitnessapp.programs.application.ProgramService;
import no.fitnessapp.programs.application.RoutineService;
import no.fitnessapp.programs.domain.Level;
import no.fitnessapp.programs.domain.Visibility;
import no.fitnessapp.programs.persistence.ProgramEntity;
import no.fitnessapp.programs.persistence.ProgramRepository;
import no.fitnessapp.programs.persistence.RoutineEntity;
import no.fitnessapp.programs.persistence.RoutineExerciseEntity;
import no.fitnessapp.programs.persistence.RoutineRepository;
import no.fitnessapp.social.NotificationService;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Community-biblioteket: delte programmer og frittstående rutiner som andre kan se og laste ned.
 *
 * <p>Hvem ser hva (samme regler som for økter, men PRIVATE vises aldri her, heller ikke for eieren):
 * <ul>
 *   <li>PUBLIC: alle som kan se eierens profil (offentlig profil, eller godtatt følger)</li>
 *   <li>FOLLOWERS: godtatte følgere</li>
 * </ul>
 * Det man ikke kan se, behandles som om det ikke finnes (404).
 */
@Service
public class ExploreService {

    private static final int LIMIT = 100;

    private static final String FOLLOWS_OWNER = """
            EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = :viewer AND f.followee_id = %1$s.owner_user_id AND f.status = 'ACCEPTED')
            """;

    /** SQL-betingelse: :viewer kan se det delte elementet med alias `a` (eier u). */
    static String shared(String a) {
        return """
                (%1$s.visibility <> 'PRIVATE' AND %3$s AND (%1$s.owner_user_id = :viewer
                  OR (%1$s.visibility = 'PUBLIC' AND u.visibility = 'PUBLIC')
                  OR %2$s))
                """.formatted(a, FOLLOWS_OWNER.formatted(a).strip(), no.fitnessapp.social.Blocks.visibleUser(a + ".owner_user_id"));
    }

    private final ProgramRepository programs;
    private final RoutineRepository routines;
    private final ProgramService programService;
    private final RoutineService routineService;
    private final ExerciseCopier exerciseCopier;
    private final NotificationService notifications;
    private final AvatarService avatars;
    private final CreditResolver credits;
    private final JdbcClient jdbc;

    public ExploreService(
            ProgramRepository programs, RoutineRepository routines, ProgramService programService, RoutineService routineService,
            ExerciseCopier exerciseCopier, NotificationService notifications, AvatarService avatars, CreditResolver credits,
            JdbcClient jdbc) {
        this.programs = programs;
        this.routines = routines;
        this.programService = programService;
        this.routineService = routineService;
        this.exerciseCopier = exerciseCopier;
        this.notifications = notifications;
        this.avatars = avatars;
        this.credits = credits;
        this.jdbc = jdbc;
    }

    // ---------- Programmer ----------

    /** Delte programmer brukeren kan se, mest lastet ned først. q søker i navnet. */
    @Transactional(readOnly = true)
    public List<ExploreProgramResponse> listPrograms(UUID viewer, String q) {
        return queryPrograms(viewer, "AND (CAST(:q AS text) IS NULL OR p.name ILIKE CAST(:q AS text))", "p.download_count DESC, p.created_at DESC",
                Map.of(), like(q));
    }

    /** En brukers delte programmer, nyeste først. */
    @Transactional(readOnly = true)
    public List<ExploreProgramResponse> programsBy(UUID viewer, UUID owner) {
        return queryPrograms(viewer, "AND p.owner_user_id = :owner", "p.created_at DESC", Map.of("owner", owner), null);
    }

    @Transactional(readOnly = true)
    public ExploreProgramResponse getProgram(UUID viewer, UUID programId) {
        ExploreProgramResponse p = requireProgram(viewer, programId);
        UUID owner = p.author().id();
        List<RoutineEntity> entities = routines.findInProgram(programId, owner);
        var credit = credits.forOrigins(entities.stream().map(RoutineEntity::getOrigin).toList());
        List<RoutineResponse> rs = entities.stream().map(r -> RoutineResponse.from(r, false, credit.apply(r.getOrigin()))).toList();
        return new ExploreProgramResponse(p.id(), p.name(), p.description(), p.authorName(), p.author(), p.visibility(), p.mine(),
                p.fromFollowing(), p.level(), p.daysPerWeek(), rs.size(), p.downloadCount(), p.basedOn(), p.remixCount(), p.createdAt(), rs);
    }

    /**
     * Kopierer programmet med alle rutiner til brukerens bibliotek. Kopien er privat og helt
     * uavhengig av originalen. Idempotent på copyId: samme forespørsel to ganger gir samme kopi.
     */
    @Transactional
    public ProgramResponse downloadProgram(UUID userId, UUID programId, UUID copyId) {
        var existing = programs.findById(copyId);
        if (existing.isPresent()) {
            ProgramEntity copy = existing.get();
            if (!copy.getOwnerUserId().equals(userId) || !programId.equals(copy.getSourceProgramId())) {
                throw new ConflictException("ID-en er allerede i bruk");
            }
            return programService.get(userId, copyId);
        }
        String authorName = requireProgram(userId, programId).author().displayName();
        ProgramEntity source = programs.findById(programId).orElseThrow();
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        List<RoutineEntity> sourceRoutines = routines.findInProgram(source.getId(), source.getOwnerUserId());
        UnaryOperator<UUID> exerciseIds = exerciseCopier.copyFor(source.getOwnerUserId(), userId, exerciseIdsIn(sourceRoutines));
        programs.save(ProgramEntity.copyOf(source, copyId, userId, now, authorName));
        for (RoutineEntity r : sourceRoutines) {
            routines.save(RoutineEntity.copyOf(r, UUID.randomUUID(), userId, copyId, now, exerciseIds, authorName));
        }
        programs.flush();
        programs.incrementDownloads(programId);
        notifications.notifyDownload(source.getOwnerUserId(), userId, programId, null);
        return programService.get(userId, copyId);
    }

    // ---------- Rutiner ----------

    @Transactional(readOnly = true)
    public List<ExploreRoutineResponse> listRoutines(UUID viewer, String q) {
        return queryRoutines(viewer, "AND (CAST(:q AS text) IS NULL OR r.name ILIKE CAST(:q AS text))", "r.download_count DESC, r.created_at DESC",
                Map.of(), like(q));
    }

    @Transactional(readOnly = true)
    public List<ExploreRoutineResponse> routinesBy(UUID viewer, UUID owner) {
        return queryRoutines(viewer, "AND r.owner_user_id = :owner", "r.created_at DESC", Map.of("owner", owner), null);
    }

    @Transactional(readOnly = true)
    public ExploreRoutineResponse getRoutine(UUID viewer, UUID routineId) {
        ExploreRoutineResponse r = requireRoutine(viewer, routineId);
        RoutineEntity entity = routines.findById(routineId).orElseThrow();
        return new ExploreRoutineResponse(r.id(), r.name(), r.notes(), r.author(), r.visibility(), r.mine(), r.fromFollowing(),
                r.exerciseCount(), r.setCount(), r.downloadCount(), r.basedOn(), r.createdAt(), r.preview(),
                RoutineResponse.from(entity, false, credits.forOrigin(entity.getOrigin())));
    }

    /** Kopierer en frittstående rutine til brukerens bibliotek (privat, uten program). Idempotent på copyId. */
    @Transactional
    public RoutineResponse downloadRoutine(UUID userId, UUID routineId, UUID copyId) {
        var existing = routines.findById(copyId);
        if (existing.isPresent()) {
            RoutineEntity copy = existing.get();
            if (!copy.getOwnerUserId().equals(userId) || !routineId.equals(copy.getSourceRoutineId())) {
                throw new ConflictException("ID-en er allerede i bruk");
            }
            return routineService.get(userId, copyId);
        }
        String authorName = requireRoutine(userId, routineId).author().displayName();
        RoutineEntity source = routines.findById(routineId).orElseThrow();
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        UnaryOperator<UUID> exerciseIds = exerciseCopier.copyFor(source.getOwnerUserId(), userId, exerciseIdsIn(List.of(source)));
        routines.save(RoutineEntity.copyOf(source, copyId, userId, null, now, exerciseIds, authorName));
        routines.flush();
        routines.incrementDownloads(routineId);
        notifications.notifyDownload(source.getOwnerUserId(), userId, null, routineId);
        return routineService.get(userId, copyId);
    }

    // ---------- Spørringer ----------

    private ExploreProgramResponse requireProgram(UUID viewer, UUID id) {
        return queryPrograms(viewer, "AND p.id = :id", "p.created_at", Map.of("id", id), null).stream().findFirst()
                .orElseThrow(() -> new NotFoundException("Fant ikke programmet"));
    }

    private ExploreRoutineResponse requireRoutine(UUID viewer, UUID id) {
        return queryRoutines(viewer, "AND r.id = :id", "r.created_at", Map.of("id", id), null).stream().findFirst()
                .orElseThrow(() -> new NotFoundException("Fant ikke rutinen"));
    }

    private List<ExploreProgramResponse> queryPrograms(UUID viewer, String filter, String order, Map<String, Object> params, String q) {
        String sql = """
                SELECT p.id, p.name, p.description, p.visibility, p.level, p.days_per_week, p.download_count, p.created_at,
                       p.owner_user_id, u.username, u.display_name, u.avatar_key,
                       (SELECT count(*) FROM routines r WHERE r.program_id = p.id) AS routine_count,
                       (SELECT count(*) FROM programs c WHERE c.origin_program_id = p.id AND c.visibility <> 'PRIVATE') AS remix_count,
                       p.origin_program_id AS origin_id, p.origin_name, p.origin_author_name, p.origin_user_id,
                       ou.username AS origin_username, ou.display_name AS origin_display_name, ou.avatar_key AS origin_avatar_key,
                       %s AS from_following
                FROM programs p JOIN users u ON u.id = p.owner_user_id
                LEFT JOIN users ou ON ou.id = p.origin_user_id
                WHERE %s %s
                ORDER BY %s
                LIMIT %d
                """.formatted(FOLLOWS_OWNER.formatted("p").strip(), shared("p").strip(), filter, order, LIMIT);
        var spec = jdbc.sql(sql).param("viewer", viewer);
        if (filter.contains(":q")) spec = spec.param("q", q);
        for (var e : params.entrySet()) spec = spec.param(e.getKey(), e.getValue());
        return spec.query((rs, i) -> {
            AuthorSummary author = author(rs);
            String level = rs.getString("level");
            return new ExploreProgramResponse(
                    rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("description"), author.displayName(), author,
                    Visibility.valueOf(rs.getString("visibility")), author.id().equals(viewer), rs.getBoolean("from_following"),
                    level == null ? null : Level.valueOf(level), (Integer) rs.getObject("days_per_week"),
                    rs.getInt("routine_count"), rs.getInt("download_count"), credit(rs), rs.getInt("remix_count"),
                    rs.getTimestamp("created_at").toInstant(), List.of());
        }).list();
    }

    private List<ExploreRoutineResponse> queryRoutines(UUID viewer, String filter, String order, Map<String, Object> params, String q) {
        String sql = """
                SELECT r.id, r.name, r.notes, r.visibility, r.download_count, r.created_at,
                       r.owner_user_id, u.username, u.display_name, u.avatar_key,
                       r.origin_routine_id AS origin_id, r.origin_name, r.origin_author_name, r.origin_user_id,
                       ou.username AS origin_username, ou.display_name AS origin_display_name, ou.avatar_key AS origin_avatar_key,
                       %s AS from_following
                FROM routines r JOIN users u ON u.id = r.owner_user_id
                LEFT JOIN users ou ON ou.id = r.origin_user_id
                WHERE r.program_id IS NULL AND %s %s
                ORDER BY %s
                LIMIT %d
                """.formatted(FOLLOWS_OWNER.formatted("r").strip(), shared("r").strip(), filter, order, LIMIT);
        var spec = jdbc.sql(sql).param("viewer", viewer);
        if (filter.contains(":q")) spec = spec.param("q", q);
        for (var e : params.entrySet()) spec = spec.param(e.getKey(), e.getValue());
        record Row(UUID id, String name, String notes, Visibility visibility, int downloads, Instant createdAt, AuthorSummary author,
                boolean fromFollowing, Credit basedOn) {}
        List<Row> rows = spec.query((rs, i) -> new Row(
                rs.getObject("id", UUID.class), rs.getString("name"), rs.getString("notes"), Visibility.valueOf(rs.getString("visibility")),
                rs.getInt("download_count"), rs.getTimestamp("created_at").toInstant(), author(rs), rs.getBoolean("from_following"),
                credit(rs))).list();
        if (rows.isEmpty()) return List.of();

        Map<UUID, List<ExploreRoutineResponse.PreviewExercise>> previews = new LinkedHashMap<>();
        jdbc.sql("""
                        SELECT e.routine_id, e.exercise_id, e.exercise_name,
                               (SELECT count(*) FROM routine_sets s WHERE s.routine_exercise_id = e.id) AS set_count
                        FROM routine_exercises e WHERE e.routine_id IN (:ids)
                        ORDER BY e.routine_id, e.position
                        """)
                .param("ids", rows.stream().map(Row::id).toList())
                .query((rs, i) -> {
                    previews.computeIfAbsent(rs.getObject("routine_id", UUID.class), k -> new ArrayList<>())
                            .add(new ExploreRoutineResponse.PreviewExercise(
                                    rs.getObject("exercise_id", UUID.class), rs.getString("exercise_name"), rs.getInt("set_count")));
                    return 0;
                })
                .list();
        return rows.stream().map(r -> {
            var preview = previews.getOrDefault(r.id(), List.of());
            int sets = preview.stream().mapToInt(ExploreRoutineResponse.PreviewExercise::setCount).sum();
            return new ExploreRoutineResponse(r.id(), r.name(), r.notes(), r.author(), r.visibility(), r.author().id().equals(viewer),
                    r.fromFollowing(), preview.size(), sets, r.downloads(), r.basedOn(), r.createdAt(), preview, null);
        }).toList();
    }

    private AuthorSummary author(ResultSet rs) throws SQLException {
        return new AuthorSummary(rs.getObject("owner_user_id", UUID.class), rs.getString("username"), rs.getString("display_name"),
                avatars.urlFor(rs.getString("avatar_key")));
    }

    /** Kreditt fra origin-kolonnene i en spørring (null hvis raden ikke er en kopi). */
    private Credit credit(ResultSet rs) throws SQLException {
        UUID id = rs.getObject("origin_id", UUID.class);
        if (id == null) return null;
        String username = rs.getString("origin_username");
        String live = rs.getString("origin_display_name");
        return new Credit(id, rs.getString("origin_name"), rs.getObject("origin_user_id", UUID.class), username,
                live != null ? live : rs.getString("origin_author_name"), avatars.urlFor(rs.getString("origin_avatar_key")));
    }

    private static Set<UUID> exerciseIdsIn(List<RoutineEntity> rs) {
        Set<UUID> ids = new HashSet<>();
        for (RoutineEntity r : rs) {
            for (RoutineExerciseEntity e : r.getExercises()) {
                if (e.getExerciseId() != null) ids.add(e.getExerciseId());
            }
        }
        return ids;
    }

    /** Søketekst til ILIKE-mønster, med jokertegn i teksten tolket bokstavelig. */
    private static String like(String q) {
        if (q == null || q.isBlank()) return null;
        String escaped = q.trim().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_");
        return "%" + escaped + "%";
    }
}
