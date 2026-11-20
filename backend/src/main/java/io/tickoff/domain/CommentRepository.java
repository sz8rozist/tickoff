package io.tickoff.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CommentRepository extends JpaRepository<Comment, Long> {
    List<Comment> findByRoundIdOrderByCreatedAtAsc(Long roundId);

    Optional<Comment> findByIdAndRoundProjectId(Long id, Long projectId);
}
