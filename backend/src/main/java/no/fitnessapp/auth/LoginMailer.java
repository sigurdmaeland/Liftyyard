package no.fitnessapp.auth;

/** Sender innloggingskoden på e-post. Byttes ut i tester. */
public interface LoginMailer {
    void sendLoginCode(String email, String code);
}
