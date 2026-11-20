package io.tickoff.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface ReplyRepository extends JpaRepository<Reply, Long> {

    /** A kommentekkel együtt tölti be a válaszokat (a kommentazonosító tranzakció nélkül is olvasható). */
    @Query("select r from Reply r join fetch r.comment c where c.id in :commentIds order by r.createdAt")
    List<Reply> findByCommentIds(@Param("commentIds") Collection<Long> commentIds);

    Optional<Reply> findByIdAndCommentId(Long id, Long commentId);

    long countByCommentId(Long commentId);
}
