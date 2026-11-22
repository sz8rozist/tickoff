package io.tickoff.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectInviteRepository extends JpaRepository<ProjectInvite, Long> {

    List<ProjectInvite> findByProjectIdOrderByCreatedAtAsc(Long projectId);

    long countByProjectId(Long projectId);

    boolean existsByProjectIdAndEmail(Long projectId, String email);

    Optional<ProjectInvite> findByIdAndProjectId(Long id, Long projectId);

    List<ProjectInvite> findByEmail(String email);
}
