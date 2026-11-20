package io.tickoff.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    Optional<Project> findByShareToken(String shareToken);

    List<Project> findByOwnerId(Long ownerId);
}
