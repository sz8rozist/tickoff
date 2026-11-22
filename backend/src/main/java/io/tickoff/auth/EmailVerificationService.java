package io.tickoff.auth;

import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectInvite;
import io.tickoff.domain.ProjectInviteRepository;
import io.tickoff.domain.ProjectMember;
import io.tickoff.domain.ProjectMemberRepository;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import io.tickoff.mail.MailService;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.util.Base64;

/**
 * Az e-mail-cím megerősítése: regisztrációkor levélben kapott, egyszer használatos linkkel.
 * <ul>
 *   <li>A token csak hash-ként van tárolva, 24 óráig érvényes; újabb kérés lecseréli (percenként legfeljebb egy levél).</li>
 *   <li>Megerősítéskor a címre szóló függő meghívók érvénybe lépnek: a felhasználó tagja lesz a projekteknek.
 *       Meghívó csak megerősített címen érvényesül, különben bárki a másik címével regisztrálva bejuthatna.</li>
 *   <li>Ha nincs e-mail-küldés beállítva (nincs SMTP), megerősítés nem lehetséges, ezért a fiók azonnal megbízható:
 *       így senki nem reked ki, de a függő meghívók ilyenkor nem is küldhetők.</li>
 * </ul>
 */
@Service
public class EmailVerificationService {

    static final Duration TTL = Duration.ofHours(24);
    static final Duration RESEND_COOLDOWN = Duration.ofMinutes(1);
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UserRepository users;
    private final ProjectInviteRepository invites;
    private final ProjectMemberRepository members;
    private final MailService mail;
    private final Clock clock;
    private final String baseUrl;

    public EmailVerificationService(UserRepository users, ProjectInviteRepository invites,
                                    ProjectMemberRepository members, MailService mail, Clock clock,
                                    @Value("${tickoff.dashboard-origin}") String baseUrl) {
        this.users = users;
        this.invites = invites;
        this.members = members;
        this.mail = mail;
        this.clock = clock;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    /** Megerősítő levelet küld (ha kell és lehet). Megerősített fióknál és a várakozási időn belül nem csinál semmit. */
    @Transactional
    public void sendVerification(Long userId) {
        User user = users.findById(userId).orElse(null);
        if (user == null || user.isEmailVerified()) return;
        Instant now = clock.instant();

        if (!mail.isEnabled()) {
            user.markEmailVerified(now);
            acceptInvites(user);
            return;
        }
        if (user.getEmailVerifySentAt() != null && now.isBefore(user.getEmailVerifySentAt().plus(RESEND_COOLDOWN))) {
            return;
        }
        String rawToken = newToken();
        user.setEmailVerification(PasswordResetService.hash(rawToken), now.plus(TTL), now);
        mail.send(user.getEmail(), "Tickoff: erősítsd meg az e-mail-címed",
            "Szia " + user.getName() + "!\n\n"
                + "Köszönjük a regisztrációt. Az e-mail-címed megerősítéséhez nyisd meg ezt a linket "
                + "(24 óráig érvényes):\n\n"
                + baseUrl + "/?verify-token=" + rawToken + "\n\n"
                + "Ha nem te regisztráltál, hagyd figyelmen kívül ezt a levelet.\n");
    }

    /** @return igaz, ha a token érvényes volt és a cím megerősítve; hamis, ha ismeretlen vagy lejárt */
    @Transactional
    public boolean verify(String rawToken) {
        Instant now = clock.instant();
        User user = users.findByEmailVerifyHash(PasswordResetService.hash(rawToken)).orElse(null);
        if (user == null || user.getEmailVerifyExpiresAt() == null || !now.isBefore(user.getEmailVerifyExpiresAt())) {
            return false;
        }
        user.markEmailVerified(now);
        acceptInvites(user);
        return true;
    }

    /** A megerősített címre szóló meghívók beváltása: a felhasználó tagja lesz a projekteknek. */
    private void acceptInvites(User user) {
        for (ProjectInvite invite : invites.findByEmail(user.getEmail())) {
            Project project = invite.getProject();
            boolean alreadyIn = project.getOwnerId().equals(user.getId())
                || members.existsByProjectIdAndUserId(project.getId(), user.getId());
            if (!alreadyIn) {
                members.save(new ProjectMember(project, user));
            }
            invites.delete(invite);
        }
    }

    private static String newToken() {
        byte[] bytes = new byte[32];
        RANDOM.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }
}
