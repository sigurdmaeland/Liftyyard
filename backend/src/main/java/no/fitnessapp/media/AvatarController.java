package no.fitnessapp.media;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.io.IOException;
import java.util.Map;
import no.fitnessapp.common.BadRequestException;
import no.fitnessapp.users.CurrentUser;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestMethod;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@Tag(name = "Profile")
public class AvatarController {

    private final AvatarService avatars;
    private final CurrentUser currentUser;

    public AvatarController(AvatarService avatars, CurrentUser currentUser) {
        this.avatars = avatars;
        this.currentUser = currentUser;
    }

    @RequestMapping(path = "/api/me/avatar", method = {RequestMethod.PUT, RequestMethod.POST}, consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Laster opp nytt profilbilde (multipart POST/PUT, felt «file», JPEG eller PNG, maks 10 MB)")
    public Map<String, String> upload(@RequestPart("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) throw new BadRequestException("Tom fil");
        return Map.of("avatarUrl", avatars.replace(currentUser.requireId(), file.getBytes()));
    }

    @DeleteMapping("/api/me/avatar")
    public ResponseEntity<Void> remove() {
        avatars.remove(currentUser.requireId());
        return ResponseEntity.noContent().build();
    }
}
