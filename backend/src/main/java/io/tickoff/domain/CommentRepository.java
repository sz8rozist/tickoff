package io.tickoff.domain;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
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

    /** Egy projekt nyitott körének kommentszáma státuszonként (a projektlista összesítőjéhez). */
    interface StatusCount {
        Long getProjectId();

        Comment.Status getStatus();

        Long getTotal();
    }

    @Query("""
        select r.project.id as projectId, c.status as status, count(c) as total
        from Comment c join c.round r
        where r.status = io.tickoff.domain.Round.Status.OPEN and r.project.id in :projectIds
        group by r.project.id, c.status
        """)
    List<StatusCount> countOpenRoundByStatus(@Param("projectIds") java.util.Collection<Long> projectIds);

    // A felelőst együtt töltjük be: a listában minden komment nevét kiírjuk (nincs kérésenkénti betöltés)
    @EntityGraph(attributePaths = "assignee")
    List<Comment> findByRoundIdOrderByCreatedAtAsc(Long roundId);

    @EntityGraph(attributePaths = "assignee")
    Optional<Comment> findByIdAndRoundProjectId(Long id, Long projectId);

    /**
     * Az új körbe viszi az előző kör nem kész (nyitott és folyamatban lévő) kommentjeit, hogy az ügyfélnek ne kelljen
     * újra beküldenie őket. A "kész" kommentek az előző körben maradnak.
     */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("update Comment c set c.round.id = :toRoundId where c.round.id = :fromRoundId "
        + "and c.status <> io.tickoff.domain.Comment.Status.DONE")
    int moveUnresolved(@Param("fromRoundId") Long fromRoundId, @Param("toRoundId") Long toRoundId);

    /** Ha valaki kilép a projektből vagy eltávolítják, a rá bízott kommentek felelős nélkül maradnak. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
        update Comment c set c.assignee = null
        where c.assignee.id = :userId
          and c.round.id in (select r.id from Round r where r.project.id = :projectId)
        """)
    int clearAssignee(@Param("projectId") Long projectId, @Param("userId") Long userId);

    Optional<Comment> findByNotifyToken(String notifyToken);

    /** A projekt összes kommentje a körrel együtt (exporthoz), kör és időrend szerint. */
    @Query("""
        select c from Comment c join fetch c.round r left join fetch c.assignee
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
