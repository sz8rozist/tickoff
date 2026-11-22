package io.tickoff.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AttachmentRepository extends JpaRepository<Attachment, Long> {

    List<Attachment> findByCommentIdOrderByIdAsc(Long commentId);

    long countByCommentId(Long commentId);

    Optional<Attachment> findByIdAndCommentId(Long id, Long commentId);

    /** Több komment mellékletei egyetlen lekérdezéssel (a listához). */
    @Query("select a from Attachment a where a.comment.id in :commentIds order by a.id")
    List<Attachment> findByCommentIds(@Param("commentIds") Collection<Long> commentIds);
}
