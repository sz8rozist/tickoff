package io.tickoff.project;

import io.tickoff.domain.CommentRepository;
import io.tickoff.domain.Project;
import io.tickoff.domain.ProjectInvite;
import io.tickoff.domain.ProjectInviteRepository;
import io.tickoff.mail.MailService;
import io.tickoff.domain.ProjectMember;
import io.tickoff.domain.ProjectMemberRepository;
import io.tickoff.domain.User;
import io.tickoff.domain.UserRepository;
import io.tickoff.project.ProjectAccess.Role;
import jakarta.validation.Valid;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** A projekt tagjai: a tulajdonos meghívhat és eltávolíthat, a tag kiléphet. */
@RestController
@RequestMapping("/api/projects/{projectId}/members")
public class MemberController {

    public record MemberDto(Long userId, String name, String email, Role role) {
        static MemberDto of(User u, Role role) {
            return new MemberDto(u.getId(), u.getName(), u.getEmail(), role);
        }
    }

    /** Függő meghívó: olyan címre, amelyhez még nincs megerősített fiók. */
    public record InviteDto(Long id, String email, java.time.Instant createdAt) {
        static InviteDto of(ProjectInvite i) {
            return new InviteDto(i.getId(), i.getEmail(), i.getCreatedAt());
        }
    }

    /** Egy projektnek legfeljebb ennyi függő meghívója lehet (levélbombázás és adatszemét ellen). */
    static final int MAX_PENDING_INVITES = 20;

    public record AddMemberRequest(@NotBlank @Email @Size(max = 255) String email) {
    }

    private final ProjectAccess access;
    private final ProjectMemberRepository members;
    private final UserRepository users;
    private final CommentRepository comments;
    private final ProjectInviteRepository invites;
    private final MailService mail;
    private final String baseUrl;

    public MemberController(ProjectAccess access, ProjectMemberRepository members, UserRepository users,
                            CommentRepository comments, ProjectInviteRepository invites, MailService mail,
                            @org.springframework.beans.factory.annotation.Value("${tickoff.dashboard-origin}") String baseUrl) {
        this.access = access;
        this.members = members;
        this.users = users;
        this.comments = comments;
        this.invites = invites;
        this.mail = mail;
        this.baseUrl = baseUrl.replaceAll("/+$", "");
    }

    /** A tulajdonos és a tagok listája (a projekt minden tagja láthatja). A tulajdonos az első. */
    @GetMapping
    public List<MemberDto> list(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId) {
        Project project = access.member(projectId, userId(jwt));
        List<MemberDto> result = new ArrayList<>();
        users.findById(project.getOwnerId()).ifPresent(owner -> result.add(MemberDto.of(owner, Role.OWNER)));
        members.findByProjectIdWithUser(project.getId()).forEach(m -> result.add(MemberDto.of(m.getUser(), Role.MEMBER)));
        return result;
    }

    /**
     * Tag meghívása e-mail-cím alapján (csak a tulajdonos). A meghívott fióknak már léteznie kell: ha még nincs,
     * előbb regisztrálnia kell. Ebből a végpontból a fiókok létezése kideríthető, ezért kérésszám-korlát védi.
     */
    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public MemberDto add(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                         @Valid @RequestBody AddMemberRequest req) {
        Project project = access.owner(projectId, userId(jwt));
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        // Csak megerősített címen lehet közvetlenül taggá tenni: egy meg nem erősített fiók bárki lehet, aki a címet
        // beírta. Ilyenkor (és ha nincs fiók) a kliens függő meghívót küld (lásd {@link #invite}).
        User user = users.findByEmail(email).filter(User::isEmailVerified)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Ezzel az e-mail címmel nincs megerősített fiók."));
        if (user.getId().equals(project.getOwnerId()) || members.existsByProjectIdAndUserId(projectId, user.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ő már tagja a projektnek");
        }
        try {
            members.saveAndFlush(new ProjectMember(project, user));
        } catch (DataIntegrityViolationException e) {
            // Párhuzamos meghívás ugyanarra a felhasználóra: az egyedi index elkapja.
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ő már tagja a projektnek");
        }
        return MemberDto.of(user, Role.MEMBER);
    }

    /** A függő meghívók (csak a tulajdonos látja). */
    @GetMapping("/invites")
    public List<InviteDto> pendingInvites(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId) {
        Project project = access.owner(projectId, userId(jwt));
        return invites.findByProjectIdOrderByCreatedAtAsc(project.getId()).stream().map(InviteDto::of).toList();
    }

    /**
     * Meghívó még nem (megerősítetten) regisztrált kollégának: levelet kap, és ha ezzel a címmel regisztrál és
     * megerősíti, automatikusan tagja lesz a projektnek. Csak működő e-mail-küldés mellett használható (409
     * különben), és projektenként legfeljebb {@value #MAX_PENDING_INVITES} függő meghívó lehet.
     */
    @PostMapping("/invites")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public InviteDto invite(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                            @Valid @RequestBody AddMemberRequest req) {
        Project project = access.owner(projectId, userId(jwt));
        String email = req.email().trim().toLowerCase(Locale.ROOT);
        if (!mail.isEnabled()) {
            // 503: a kliens ebből tudja, hogy nem a kérés hibás, hanem a szerver nincs felkészítve levélküldésre
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE,
                "Meghívó küldéséhez be kell állítani az e-mail-küldést (SMTP).");
        }
        User inviter = users.findById(userId(jwt))
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        boolean alreadyIn = users.findByEmail(email)
            .map(u -> u.getId().equals(project.getOwnerId()) || members.existsByProjectIdAndUserId(projectId, u.getId()))
            .orElse(false);
        if (alreadyIn || invites.existsByProjectIdAndEmail(projectId, email)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Őt már meghívtad, vagy már tagja a projektnek");
        }
        if (invites.countByProjectId(projectId) >= MAX_PENDING_INVITES) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Túl sok függő meghívó van, töröld a feleslegeseket");
        }
        ProjectInvite saved;
        try {
            saved = invites.saveAndFlush(new ProjectInvite(project, email, inviter));
        } catch (DataIntegrityViolationException e) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Őt már meghívtad, vagy már tagja a projektnek");
        }
        mail.send(email, "[Tickoff] Meghívó: " + project.getName(),
            inviter.getName() + " meghívott a(z) „" + project.getName() + "” projekt visszajelzéseinek kezelésére a Tickoffban.\n\n"
                + "Regisztrálj erre az e-mail-címre, és erősítsd meg a címedet: " + baseUrl + "/\n"
                + "A megerősítés után automatikusan csatlakozol a projekthez.\n\n"
                + "Ha nem ismered a meghívót, hagyd figyelmen kívül ezt a levelet.\n");
        return InviteDto.of(saved);
    }

    /** Függő meghívó visszavonása (csak a tulajdonos). */
    @DeleteMapping("/invites/{inviteId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void cancelInvite(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId, @PathVariable Long inviteId) {
        Project project = access.owner(projectId, userId(jwt));
        ProjectInvite invite = invites.findByIdAndProjectId(inviteId, project.getId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        invites.delete(invite);
    }

    /**
     * Tag eltávolítása. A tulajdonos bárkit eltávolíthat, a tag csak saját magát (kilépés). A tulajdonos nem
     * távolítható el: ha nincs rá szükség, a projektet kell törölni.
     */
    @DeleteMapping("/{userId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void remove(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId, @PathVariable Long userId) {
        Long me = userId(jwt);
        ProjectAccess.Access a = access.resolve(projectId, me, Role.MEMBER);
        if (a.role() == Role.MEMBER && !userId.equals(me)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Mást csak a projekt tulajdonosa távolíthat el");
        }
        if (userId.equals(a.project().getOwnerId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                "A tulajdonos nem távolítható el. Ha nincs rá szükség, töröld a projektet.");
        }
        ProjectMember member = members.findByProjectIdAndUserId(projectId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND));
        members.delete(member);
        // A rá bízott kommentek felelős nélkül maradnak
        comments.clearAssignee(projectId, userId);
    }

    /**
     * A projekt átadása egy meglévő tagnak (csak a tulajdonos). Az új tulajdonos mindent megkap, a régi tulajdonos
     * tag marad, így nem veszíti el a hozzáférést. Az átadás után a régi tulajdonos már nem végezhet owner-only
     * műveletet. Nem visszavonható a régi tulajdonos oldaláról: vissza csak az új tulajdonos adhatja.
     *
     * @return a tagok frissített listája
     */
    @PostMapping("/{userId}/transfer-ownership")
    @Transactional
    public List<MemberDto> transferOwnership(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                                             @PathVariable Long userId) {
        Project project = access.owner(projectId, userId(jwt));
        ProjectMember target = members.findByProjectIdAndUserId(projectId, userId)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.CONFLICT,
                "A projektet csak a projekt egyik tagjának adhatod át"));
        User oldOwner = users.findById(project.getOwnerId())
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED));
        User newOwner = target.getUser();

        project.transferTo(newOwner);
        members.delete(target);
        members.flush();
        members.save(new ProjectMember(project, oldOwner));

        List<MemberDto> result = new ArrayList<>();
        result.add(MemberDto.of(newOwner, Role.OWNER));
        members.findByProjectIdWithUser(project.getId()).forEach(m -> result.add(MemberDto.of(m.getUser(), Role.MEMBER)));
        return result;
    }

    private static Long userId(Jwt jwt) {
        return Long.valueOf(jwt.getSubject());
    }
}
