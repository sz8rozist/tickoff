package io.tickoff.activity;

import io.tickoff.project.ProjectAccess;
import org.springframework.data.domain.PageRequest;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.oauth2.jwt.Jwt;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.List;

/** A projekt tevékenységnaplója a csapat tagjainak (újabb elöl, lapozható). */
@RestController
@RequestMapping("/api/projects/{projectId}/activity")
public class ActivityController {

    static final int PAGE_SIZE = 50;

    public record ActivityDto(Long id, ActivityEntry.ActorType actorType, String actorName, String event,
                              Long commentId, String summary, Instant createdAt) {
        static ActivityDto of(ActivityEntry e) {
            return new ActivityDto(e.getId(), e.getActorType(), e.getActorName(), e.getEvent(), e.getCommentId(),
                e.getSummary(), e.getCreatedAt());
        }
    }

    private final ProjectAccess access;
    private final ActivityRepository entries;

    public ActivityController(ProjectAccess access, ActivityRepository entries) {
        this.access = access;
        this.entries = entries;
    }

    /** A következő oldalhoz a {@code before} paraméterbe az utolsó kapott bejegyzés azonosítója kerül. */
    @GetMapping
    public List<ActivityDto> list(@AuthenticationPrincipal Jwt jwt, @PathVariable Long projectId,
                                  @RequestParam(required = false) Long before) {
        access.member(projectId, Long.valueOf(jwt.getSubject()));
        PageRequest page = PageRequest.of(0, PAGE_SIZE);
        List<ActivityEntry> found = before == null
            ? entries.findByProjectIdOrderByIdDesc(projectId, page)
            : entries.findByProjectIdAndIdLessThanOrderByIdDesc(projectId, before, page);
        return found.stream().map(ActivityDto::of).toList();
    }
}
