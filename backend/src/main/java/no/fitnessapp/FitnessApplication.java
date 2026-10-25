package no.fitnessapp;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

/**
 * Inngangspunkt for backend. Koden er organisert som en modulær monolitt:
 * én pakke per domenemodul (health, exercises, routines, workouts, ...).
 */
@SpringBootApplication
@ConfigurationPropertiesScan
public class FitnessApplication {

    public static void main(String[] args) {
        SpringApplication.run(FitnessApplication.class, args);
    }
}
