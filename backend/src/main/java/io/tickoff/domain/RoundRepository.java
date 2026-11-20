package io.tickoff.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface RoundRepository extends JpaRepository<Round, Long> {
    List<Round> findByProjectIdOrderByNumberAsc(Long projectId);

    Optional<Round> findTopByProjectIdOrderByNumberDesc(Long projectId);

    Optional<Round> findByIdAndProjectId(Long id, Long projectId);
}
