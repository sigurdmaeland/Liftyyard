package no.fitnessapp.users;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;

/** Oppretter utviklingsbrukeren i databasen ved oppstart i local-profilen. */
@Component
@ConditionalOnProperty(name = "app.dev-user.enabled", havingValue = "true")
class DevUserInitializer implements ApplicationRunner {

    private static final Logger log = LoggerFactory.getLogger(DevUserInitializer.class);

    private final JdbcClient jdbc;
    private final DevUserProperties devUser;

    DevUserInitializer(JdbcClient jdbc, DevUserProperties devUser) {
        this.jdbc = jdbc;
        this.devUser = devUser;
    }

    @Override
    public void run(ApplicationArguments args) {
        int created = jdbc.sql("""
                        INSERT INTO users (id, display_name) VALUES (:id, :name)
                        ON CONFLICT (id) DO NOTHING
                        """)
                .param("id", devUser.id())
                .param("name", devUser.displayName())
                .update();
        log.warn("Utviklingsbruker {} er aktiv{}. Skal aldri brukes i produksjon.",
                devUser.id(), created > 0 ? " (opprettet nå)" : "");
    }
}
