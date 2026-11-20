package io.tickoff.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProjectMemberRepository extends JpaRepository<ProjectMember, Long> {

    boolean existsByProjectIdAndUserId(Long projectId, Long userId);

    Optional<ProjectMember> findByProjectIdAndUserId(Long projectId, Long userId);

    /** A tagok a felhasználóval együtt (tranzakció nélkül is olvasható nevek és e-mailek). */
    @Query("select m from ProjectMember m join fetch m.user where m.project.id = :projectId order by m.createdAt")
    List<ProjectMember> findByProjectIdWithUser(@Param("projectId") Long projectId);
}
