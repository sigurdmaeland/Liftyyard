package no.fitnessapp.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.mail.MailException;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Component;

/** Sender koden med SMTP (lokalt Mailpit, senere en e-posttjeneste). */
@Component
class SmtpLoginMailer implements LoginMailer {

    private static final Logger log = LoggerFactory.getLogger(SmtpLoginMailer.class);

    private final JavaMailSender mail;
    private final AuthProperties props;

    SmtpLoginMailer(JavaMailSender mail, AuthProperties props) {
        this.mail = mail;
        this.props = props;
    }

    @Override
    public void sendLoginCode(String email, String code) {
        if (props.logCodes()) {
            log.warn("Innloggingskode for {}: {} (vises bare lokalt)", email, code);
        }
        SimpleMailMessage message = new SimpleMailMessage();
        message.setFrom(props.mailFrom());
        message.setTo(email);
        message.setSubject(code + " er koden din");
        message.setText("""
                Hei!

                Koden din for å logge inn er: %s

                Den gjelder i 10 minutter. Har du ikke bedt om denne koden, kan du se bort fra e-posten.
                """.formatted(code));
        try {
            mail.send(message);
        } catch (MailException e) {
            // Lokalt står koden i loggen; i drift må e-posten komme fram.
            log.error("Klarte ikke å sende innloggingskode: {}", e.getMessage());
            if (!props.logCodes()) throw e;
        }
    }
}
