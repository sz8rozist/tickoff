package io.tickoff.mail;

import jakarta.mail.internet.MimeMessage;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;

/**
 * Egyszerű, szöveges e-mailek küldése. A küldés aszinkron (külön szálon), így a kérés nem vár az SMTP-szerverre,
 * és annak hibája nem bukatja el a kérést: a hibát csak naplózzuk. Ha nincs SMTP-szerver beállítva
 * ({@code SMTP_HOST}), a levelek nem mennek el (a funkciók, amelyek e-mailre épülnek, ilyenkor nem működnek).
 */
@Service
public class MailService {

    private static final Logger log = LoggerFactory.getLogger(MailService.class);

    private final JavaMailSender sender;
    private final String from;
    private final boolean enabled;

    public MailService(ObjectProvider<JavaMailSender> sender,
                       @Value("${spring.mail.host:}") String host,
                       @Value("${tickoff.mail.from}") String from) {
        this.sender = sender.getIfAvailable();
        this.from = from;
        this.enabled = this.sender != null && !host.isBlank();
        if (!enabled) {
            log.warn("Nincs SMTP-szerver beállítva (SMTP_HOST): az e-mailek nem kerülnek elküldésre, "
                + "a jelszó-visszaállítás és az értesítések nem működnek.");
        }
    }

    public boolean isEnabled() {
        return enabled;
    }

    @Async("mailExecutor")
    public void send(String to, String subject, String text) {
        if (!enabled) {
            log.debug("E-mail kihagyva (nincs SMTP-szerver): {}", subject);
            return;
        }
        try {
            MimeMessage message = sender.createMimeMessage();
            MimeMessageHelper helper = new MimeMessageHelper(message, false, StandardCharsets.UTF_8.name());
            helper.setFrom(from);
            helper.setTo(to);
            helper.setSubject(singleLine(subject));
            helper.setText(text, false);
            sender.send(message);
        } catch (Exception e) {
            // A címzett és a tárgy nem naplózható: jelszó-visszaállító levélnél személyes adat. Csak a hiba okát.
            log.error("Az e-mail küldése nem sikerült: {}", e.toString());
        }
    }

    /** A tárgyból kiszedi a sortöréseket, hogy a (felhasználó által adott) projektnév ne injektálhasson fejlécet. */
    static String singleLine(String s) {
        return s.replaceAll("[\\r\\n]+", " ").trim();
    }
}
