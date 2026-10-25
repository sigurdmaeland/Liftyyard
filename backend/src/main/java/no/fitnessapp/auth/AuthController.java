package no.fitnessapp.auth;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;
import java.util.Map;
import java.util.UUID;
import no.fitnessapp.users.CurrentUser;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Innlogging med e-postkode og Google, fornyelse av tokens og utlogging. */
@RestController
@RequestMapping("/api/auth")
@Tag(name = "Auth")
public class AuthController {

    public record EmailStartRequest(@NotBlank @Email @Size(max = 254) String email) {}

    public record EmailVerifyRequest(@NotBlank @Email @Size(max = 254) String email, @NotBlank @Pattern(regexp = "\\s*\\d{6}\\s*") String code) {}

    public record GoogleRequest(@NotBlank @Size(max = 4096) String idToken) {}

    public record RefreshRequest(@NotBlank @Size(max = 200) String refreshToken) {}

    public record AuthResponse(String accessToken, String refreshToken, long expiresIn, UUID userId, boolean newUser) {}

    private final EmailCodeService emailCodes;
    private final GoogleTokenVerifier google;
    private final AccountService accounts;
    private final TokenService tokens;
    private final CurrentUser currentUser;

    public AuthController(EmailCodeService emailCodes, GoogleTokenVerifier google, AccountService accounts,
            TokenService tokens, CurrentUser currentUser) {
        this.emailCodes = emailCodes;
        this.google = google;
        this.accounts = accounts;
        this.tokens = tokens;
        this.currentUser = currentUser;
    }

    @PostMapping("/email/start")
    @Operation(summary = "Sender en innloggingskode på e-post (svarer alltid 204)")
    public ResponseEntity<Void> startEmail(@Valid @RequestBody EmailStartRequest body) {
        emailCodes.start(body.email());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/email/verify")
    @Operation(summary = "Logger inn med e-post og kode")
    public AuthResponse verifyEmail(@Valid @RequestBody EmailVerifyRequest body) {
        String email = emailCodes.verify(body.email(), body.code());
        return login(accounts.findOrCreate(AccountService.Provider.EMAIL, email, email, true, null));
    }

    @PostMapping("/google")
    @Operation(summary = "Logger inn med et ID-token fra Google")
    public AuthResponse google(@Valid @RequestBody GoogleRequest body) {
        GoogleTokenVerifier.GoogleIdentity id = google.verify(body.idToken());
        String email = id.email() == null ? null : EmailCodeService.normalize(id.email());
        return login(accounts.findOrCreate(AccountService.Provider.GOOGLE, id.subject(), email, id.emailVerified(), id.name()));
    }

    @PostMapping("/refresh")
    @Operation(summary = "Bytter fornyelsestoken mot nye tokens (hvert token kan brukes én gang)")
    public AuthResponse refresh(@Valid @RequestBody RefreshRequest body) {
        TokenService.Tokens t = tokens.refresh(body.refreshToken());
        return new AuthResponse(t.accessToken(), t.refreshToken(), t.expiresIn(), null, false);
    }

    @PostMapping("/logout")
    @Operation(summary = "Logger ut: fornyelsestokenet og økten det hører til trekkes tilbake")
    public ResponseEntity<Void> logout(@Valid @RequestBody RefreshRequest body) {
        tokens.revoke(body.refreshToken());
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/claim-dev-data")
    @Operation(summary = "Bare lokal utvikling: flytter utviklingsbrukerens data til innlogget bruker")
    public Map<String, Integer> claimDevData() {
        return Map.of("workouts", accounts.claimDevData(currentUser.requireId()));
    }

    private AuthResponse login(AccountService.Account account) {
        TokenService.Tokens t = tokens.issue(account.userId());
        return new AuthResponse(t.accessToken(), t.refreshToken(), t.expiresIn(), account.userId(), account.created());
    }
}
