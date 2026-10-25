package no.fitnessapp.health;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import java.time.Clock;
import java.time.Instant;
import no.fitnessapp.health.HealthResponse.Status;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.boot.info.BuildProperties;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Enkel helsesjekk for mobilappen og lokal utvikling.
 * Driftsovervåking bruker i tillegg Spring Boot Actuator på /actuator/health.
 */
@RestController
@RequestMapping("/api/health")
@Tag(name = "Health")
public class HealthController {

    private static final Logger log = LoggerFactory.getLogger(HealthController.class);

    private final JdbcClient jdbc;
    private final String version;
    private final Clock clock;

    public HealthController(JdbcClient jdbc, ObjectProvider<BuildProperties> buildProperties) {
        this.jdbc = jdbc;
        BuildProperties props = buildProperties.getIfAvailable();
        this.version = props != null ? props.getVersion() : "dev";
        this.clock = Clock.systemUTC();
    }

    @GetMapping
    @Operation(summary = "Sjekker at API-et og databasen svarer")
    public ResponseEntity<HealthResponse> health() {
        Status database = checkDatabase();
        Status overall = database == Status.UP ? Status.UP : Status.DOWN;
        HealthResponse body = new HealthResponse(overall, database, version, Instant.now(clock));
        HttpStatus httpStatus = overall == Status.UP ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
        return ResponseEntity.status(httpStatus).body(body);
    }

    private Status checkDatabase() {
        try {
            Integer one = jdbc.sql("SELECT 1").query(Integer.class).single();
            return Integer.valueOf(1).equals(one) ? Status.UP : Status.DOWN;
        } catch (RuntimeException e) {
            log.warn("Databasesjekk feilet: {}", e.getMessage());
            return Status.DOWN;
        }
    }
}
