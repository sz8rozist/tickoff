package io.tickoff.project;

import io.tickoff.domain.CommentRepository;
import io.tickoff.domain.Project;
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

    public record AddMemberRequest(@NotBlank @Email @Size(max = 255) String email) {
    }

    private final ProjectAccess access;
    private final ProjectMemberRepository members;
    private final UserRepository users;
    private final CommentRepository comments;

    public MemberController(ProjectAccess access, ProjectMemberRepository members, UserRepository users,
                            CommentRepository comments) {
        this.access = access;
        this.members = members;
        this.users = users;
        this.comments = comments;
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
        User user = users.findByEmail(email)
            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                "Ezzel az e-mail címmel nincs fiók. A kollégának előbb regisztrálnia kell."));
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
