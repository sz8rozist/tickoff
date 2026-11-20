package io.tickoff.project;

import io.tickoff.domain.Reply;
import io.tickoff.domain.ReplyRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/** A válaszok lekérése és közös szabályai (a designer és a widget oldal is ezt használja). */
@Service
public class ReplyService {

    /** Egy kommenthez legfeljebb ennyi válasz fűzhető, hogy a szál ne nőhessen korlátlanul. */
    static final int MAX_REPLIES_PER_COMMENT = 200;

    public record ReplyDto(Long id, String authorName, Reply.AuthorType authorType, String body, Instant createdAt) {
        public static ReplyDto of(Reply r) {
            return new ReplyDto(r.getId(), r.getAuthorName(), r.getAuthorType(), r.getBody(), r.getCreatedAt());
        }
    }

    private final ReplyRepository replies;

    public ReplyService(ReplyRepository replies) {
        this.replies = replies;
    }

    /** A kommentek válaszai egyetlen lekérdezéssel, kommentazonosító szerint csoportosítva (időrendben). */
    public Map<Long, List<ReplyDto>> byComment(Collection<Long> commentIds) {
        if (commentIds.isEmpty()) return Map.of();
        return replies.findByCommentIds(commentIds).stream()
            .collect(Collectors.groupingBy(r -> r.getComment().getId(),
                Collectors.mapping(ReplyDto::of, Collectors.toList())));
    }

    public List<ReplyDto> forComment(Long commentId) {
        return byComment(List.of(commentId)).getOrDefault(commentId, List.of());
    }

    /** 409-et dob, ha a komment szála betelt. */
    public void requireRoom(Long commentId) {
        if (replies.countByCommentId(commentId) >= MAX_REPLIES_PER_COMMENT) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Ehhez a kommenthez már nem fűzhető több válasz");
        }
    }
}
