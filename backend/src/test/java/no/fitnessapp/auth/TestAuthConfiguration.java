package no.fitnessapp.auth;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import no.fitnessapp.common.UnauthenticatedException;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Primary;

/** Erstatter e-postutsending og Google-kontroll i tester. */
@TestConfiguration(proxyBeanMethods = false)
public class TestAuthConfiguration {

    /** Tar vare på siste kode per e-post i stedet for å sende den. */
    public static class CapturingMailer implements LoginMailer {
        public final Map<String, String> codes = new ConcurrentHashMap<>();

        @Override
        public void sendLoginCode(String email, String code) {
            codes.put(email, code);
        }
    }

    @Bean
    @Primary
    CapturingMailer capturingMailer() {
        return new CapturingMailer();
    }

    /** Godtar tokens på formen «good:<sub>:<email>», alt annet avvises. */
    @Bean
    @Primary
    GoogleTokenVerifier fakeGoogleVerifier() {
        return idToken -> {
            String[] parts = idToken.split(":");
            if (parts.length != 3 || !parts[0].equals("good")) throw new UnauthenticatedException();
            return new GoogleTokenVerifier.GoogleIdentity(parts[1], parts[2], true, "Google Bruker");
        };
    }
}
