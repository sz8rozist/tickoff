package io.tickoff.domain;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public final class Repositories {

    private Repositories() {
    }

    public interface UserRepository extends JpaRepository<User, Long> {
        Optional<User> findByEmail(String email);
    }

    public interface ProjectRepository extends JpaRepository<Project, Long> {
        Optional<Project> findByShareToken(String shareToken);
        List<Project> findByOwnerId(Long ownerId);
    }

    public interface RoundRepository extends JpaRepository<Round, Long> {
        List<Round> findByProjectIdOrderByNumberAsc(Long projectId);
    }

    public interface CommentRepository extends JpaRepository<Comment, Long> {
        List<Comment> findByRoundIdOrderByCreatedAtAsc(Long roundId);
    }
}
