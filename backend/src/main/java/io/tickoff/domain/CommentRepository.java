package io.tickoff.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CommentRepository extends JpaRepository<Comment, Long> {

    /** Egy kör kommentszámai: összes és nyitott. */
    interface RoundCommentCount {
        Long getRoundId();

        Number getTotal();

        Number getOpenCount();
    }

    List<Comment> findByRoundIdOrderByCreatedAtAsc(Long roundId);

    Optional<Comment> findByIdAndRoundProjectId(Long id, Long projectId);

    Optional<Comment> findByNotifyToken(String notifyToken);

    /** A projekt összes kommentje a körrel együtt (exporthoz), kör és időrend szerint. */
    @Query("""
        select c from Comment c join fetch c.round r
        where r.project.id = :projectId
        order by r.number, c.createdAt
        """)
    List<Comment> findAllForExport(@Param("projectId") Long projectId);

    @Query("""
        select c.round.id as roundId, count(c) as total,
               sum(case when c.status = io.tickoff.domain.Comment.Status.OPEN then 1 else 0 end) as openCount
        from Comment c
        where c.round.project.id = :projectId
        group by c.round.id
        """)
    List<RoundCommentCount> countByRound(@Param("projectId") Long projectId);
}
