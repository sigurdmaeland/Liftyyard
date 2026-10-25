package no.fitnessapp.users;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import no.fitnessapp.auth.AccountService;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RestController;

/** Den innloggede brukerens egen profil, brukernavn og andres offentlige profiler. */
@RestController
@Tag(name = "Profile")
public class ProfileController {

    public record UsernameRequest(@NotBlank @Size(max = 40) String username) {}

    private final ProfileService profiles;
    private final CurrentUser currentUser;
    private final AccountService accounts;

    public ProfileController(ProfileService profiles, CurrentUser currentUser, AccountService accounts) {
        this.profiles = profiles;
        this.currentUser = currentUser;
        this.accounts = accounts;
    }

    @GetMapping("/api/me")
    public ProfileDto get() {
        return profiles.get(currentUser.requireId());
    }

    @PutMapping("/api/me")
    @Operation(summary = "Erstatter profilfeltene (idempotent)")
    public ProfileDto update(@Valid @RequestBody ProfileUpdate body) {
        return profiles.update(currentUser.requireId(), body);
    }

    public record TermsRequest(@NotBlank @Size(max = 40) String version, boolean confirmsMinimumAge) {}

    @PutMapping("/api/me/terms")
    @Operation(summary = "Godtar gjeldende vilkår og personvernerklæring, og bekrefter minstealder (idempotent)")
    public ProfileDto acceptTerms(@Valid @RequestBody TermsRequest body) {
        return profiles.acceptTerms(currentUser.requireId(), body.version(), body.confirmsMinimumAge());
    }

    @PutMapping("/api/me/username")
    @Operation(summary = "Setter brukernavn (409 hvis det er tatt)")
    public ProfileDto setUsername(@Valid @RequestBody UsernameRequest body) {
        return profiles.setUsername(currentUser.requireId(), body.username());
    }

    @GetMapping("/api/usernames/{username}")
    @Operation(summary = "Sjekker om et brukernavn er gyldig og ledig")
    public ProfileService.Availability availability(@PathVariable String username) {
        return profiles.availability(currentUser.requireId(), username);
    }

    @GetMapping("/api/users/{username}")
    @Operation(summary = "En annen brukers profil (uten private opplysninger)")
    public PublicProfileDto publicProfile(@PathVariable String username) {
        return profiles.publicProfile(currentUser.requireId(), username);
    }

    @DeleteMapping("/api/me")
    @Operation(summary = "Sletter kontoen og alle data permanent")
    public ResponseEntity<Void> deleteAccount() {
        accounts.delete(currentUser.requireId());
        return ResponseEntity.noContent().build();
    }
}
