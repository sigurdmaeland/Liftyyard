package no.fitnessapp.social;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.io.IOException;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import no.fitnessapp.common.ForbiddenException;
import no.fitnessapp.users.CurrentUser;
import no.fitnessapp.workouts.api.WorkoutResponse;
import no.fitnessapp.workouts.application.WorkoutService;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.annotation.Validated;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/** Søk, følging, feed, andres økter, liker, kommentarer, bilder på økter og varsler. */
@RestController
@Validated
@Tag(name = "Social")
public class SocialController {

    private final FollowService follows;
    private final WorkoutService workouts;
    private final CurrentUser currentUser;
    private final FeedService feed;
    private final WorkoutAccess access;
    private final InteractionService interactions;
    private final NotificationService notifications;
    private final RecordCalculator records;

    public SocialController(FollowService follows, WorkoutService workouts, CurrentUser currentUser, FeedService feed,
            WorkoutAccess access, InteractionService interactions, NotificationService notifications, RecordCalculator records) {
        this.records = records;
        this.follows = follows;
        this.workouts = workouts;
        this.currentUser = currentUser;
        this.feed = feed;
        this.access = access;
        this.interactions = interactions;
        this.notifications = notifications;
    }

    @PutMapping("/api/comments/{id}/like")
    @Operation(summary = "Liker en kommentar (idempotent)")
    public ResponseEntity<Void> likeComment(@PathVariable UUID id) {
        interactions.likeComment(currentUser.requireId(), id, true);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/comments/{id}/like")
    @Operation(summary = "Fjerner liker på en kommentar (idempotent)")
    public ResponseEntity<Void> unlikeComment(@PathVariable UUID id) {
        interactions.likeComment(currentUser.requireId(), id, false);
        return ResponseEntity.noContent().build();
    }

    public record PartnersRequest(@NotNull @Size(max = 10) List<@NotBlank @Size(max = 31) String> usernames) {}

    @PutMapping("/api/workouts/{id}/partners")
    @Operation(summary = "Setter hvem du trente med på din økt (erstatter listen)")
    public ResponseEntity<Void> setPartners(@PathVariable UUID id, @Valid @RequestBody PartnersRequest body) {
        interactions.setPartners(currentUser.requireId(), id, body.usernames());
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/workouts/{id}/partners/me")
    @Operation(summary = "Fjerner deg selv som treningspartner på en økt (idempotent)")
    public ResponseEntity<Void> leavePartner(@PathVariable UUID id) {
        interactions.leavePartner(currentUser.requireId(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/users/suggestions")
    @Operation(summary = "Forslag til folk å følge: venners venner først, deretter populære offentlige profiler")
    public List<FollowService.Suggestion> suggestions() {
        return follows.suggestions(currentUser.requireId());
    }

    @GetMapping("/api/users/search")
    @Operation(summary = "Søker etter brukere på brukernavn og navn (minst 2 tegn)")
    public List<UserSummary> search(@RequestParam("q") String q) {
        return follows.search(currentUser.requireId(), q);
    }

    @PostMapping("/api/users/{username}/follow")
    @Operation(summary = "Følger brukeren, eller sender forespørsel hvis profilen er privat (idempotent)")
    public Map<String, FollowStatus> follow(@PathVariable String username) {
        return Map.of("followStatus", follows.follow(currentUser.requireId(), username));
    }

    @DeleteMapping("/api/users/{username}/follow")
    @Operation(summary = "Slutter å følge, eller trekker tilbake forespørselen (idempotent)")
    public ResponseEntity<Void> unfollow(@PathVariable String username) {
        follows.unfollow(currentUser.requireId(), username);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/users/{username}/followers")
    public List<UserSummary> followers(@PathVariable String username) {
        UUID viewer = currentUser.requireId();
        UUID target = follows.requireVisibleUserId(viewer, username);
        if (!follows.canViewLists(viewer, target)) throw new ForbiddenException("Profilen er privat");
        return follows.followers(viewer, target);
    }

    @GetMapping("/api/users/{username}/following")
    public List<UserSummary> following(@PathVariable String username) {
        UUID viewer = currentUser.requireId();
        UUID target = follows.requireVisibleUserId(viewer, username);
        if (!follows.canViewLists(viewer, target)) throw new ForbiddenException("Profilen er privat");
        return follows.following(viewer, target);
    }

    @GetMapping("/api/me/follow-requests")
    @Operation(summary = "Forespørsler om å følge deg som venter på svar")
    public List<UserSummary> requests() {
        return follows.pendingRequests(currentUser.requireId());
    }

    @PostMapping("/api/me/follow-requests/{username}/accept")
    public ResponseEntity<Void> accept(@PathVariable String username) {
        follows.accept(currentUser.requireId(), username);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/me/follow-requests/{username}")
    @Operation(summary = "Avslår en forespørsel (idempotent)")
    public ResponseEntity<Void> decline(@PathVariable String username) {
        follows.removeFollower(currentUser.requireId(), username);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/me/followers/{username}")
    @Operation(summary = "Fjerner en følger (idempotent)")
    public ResponseEntity<Void> removeFollower(@PathVariable String username) {
        follows.removeFollower(currentUser.requireId(), username);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/users/{username}/workouts")
    @Operation(summary = "En brukers økter som du kan se, nyeste først (sider med before=startedAt)")
    public List<FeedItem> userWorkouts(
            @PathVariable String username,
            @RequestParam(required = false) Instant before,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit) {
        UUID viewer = currentUser.requireId();
        UUID target = follows.requireVisibleUserId(viewer, username);
        if (!follows.canViewLists(viewer, target)) throw new ForbiddenException("Profilen er privat");
        return feed.byAuthor(viewer, target, before, limit);
    }

    @GetMapping("/api/feed")
    @Operation(summary = "Feed: dine økter og øktene til dem du følger, nyeste først (sider med before=startedAt)")
    public List<FeedItem> feed(
            @RequestParam(required = false) Instant before,
            @RequestParam(defaultValue = "20") @Min(1) @Max(50) int limit) {
        return feed.feed(currentUser.requireId(), before, limit);
    }

    /** En økt med detaljer slik den som ser har tilgang til. Private notater tas bare med for eieren. */
    /** records: sett-ID → rekorder (medaljer) i økten. */
    public record WorkoutView(FeedItem summary, WorkoutResponse workout, Map<UUID, List<RecordCalculator.SetRecord>> records) {}

    @GetMapping("/api/workouts/{id}/view")
    @Operation(summary = "Én økt du kan se, med forfatter, liker, kommentarer og bilder")
    public WorkoutView view(@PathVariable UUID id) {
        UUID viewer = currentUser.requireId();
        UUID owner = access.requireViewable(viewer, id);
        WorkoutResponse w = workouts.get(owner, id);
        if (!owner.equals(viewer)) {
            w = new WorkoutResponse(w.id(), w.name(), w.description(), null, w.perceivedEffort(), w.sourceRoutineId(),
                    w.startedAt(), w.endedAt(), w.createdAt(), w.updatedAt(), w.totals(), w.exercises(), w.visibility());
        }
        return new WorkoutView(feed.one(viewer, id), w, records.forWorkouts(List.of(id)).getOrDefault(id, Map.of()));
    }

    @PutMapping("/api/workouts/{id}/like")
    public ResponseEntity<Void> like(@PathVariable UUID id) {
        interactions.like(currentUser.requireId(), id);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/api/workouts/{id}/like")
    public ResponseEntity<Void> unlike(@PathVariable UUID id) {
        interactions.unlike(currentUser.requireId(), id);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/workouts/{id}/likes")
    public List<UserSummary> likes(@PathVariable UUID id) {
        return interactions.likes(currentUser.requireId(), id);
    }

    @GetMapping("/api/workouts/{id}/comments")
    public List<InteractionService.Comment> comments(@PathVariable UUID id) {
        return interactions.comments(currentUser.requireId(), id);
    }

    public record CommentRequest(@NotNull UUID id, @NotBlank @Size(max = 1000) String body, UUID parentId) {}

    @PostMapping("/api/workouts/{id}/comments")
    @Operation(summary = "Legger til en kommentar (idempotent på kommentarens ID)")
    public List<InteractionService.Comment> comment(@PathVariable UUID id, @Valid @RequestBody CommentRequest body) {
        interactions.comment(currentUser.requireId(), id, body.id(), body.body(), body.parentId());
        return interactions.comments(currentUser.requireId(), id);
    }

    @DeleteMapping("/api/comments/{id}")
    public ResponseEntity<Void> deleteComment(@PathVariable UUID id) {
        interactions.deleteComment(currentUser.requireId(), id);
        return ResponseEntity.noContent().build();
    }

    @RequestMapping(path = "/api/workouts/{id}/photos/{photoId}", method = {RequestMethod.PUT, RequestMethod.POST},
            consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Laster opp et bilde til egen økt (multipart «file», maks 4 per økt, idempotent på bildets ID)")
    public Map<String, String> putPhoto(@PathVariable UUID id, @PathVariable UUID photoId, @RequestPart("file") MultipartFile file)
            throws IOException {
        return Map.of("url", interactions.putPhoto(currentUser.requireId(), id, photoId, file.getBytes()));
    }

    @DeleteMapping("/api/workouts/{id}/photos/{photoId}")
    public ResponseEntity<Void> deletePhoto(@PathVariable UUID id, @PathVariable UUID photoId) {
        interactions.deletePhoto(currentUser.requireId(), id, photoId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/api/notifications")
    public List<NotificationService.Notification> notifications() {
        return notifications.list(currentUser.requireId());
    }

    @GetMapping("/api/notifications/unread-count")
    public Map<String, Long> unreadCount() {
        return Map.of("count", notifications.unreadCount(currentUser.requireId()));
    }

    @PostMapping("/api/notifications/read")
    public ResponseEntity<Void> markRead() {
        notifications.markAllRead(currentUser.requireId());
        return ResponseEntity.noContent().build();
    }
}
