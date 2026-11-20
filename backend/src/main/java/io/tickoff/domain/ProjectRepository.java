package io.tickoff.domain;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ProjectRepository extends JpaRepository<Project, Long> {
    Optional<Project> findByShareToken(String shareToken);

    List<Project> findByOwnerIdOrderByCreatedAtDesc(Long ownerId);

    Optional<Project> findByIdAndOwnerId(Long id, Long ownerId);

    /** A felhasználó saját és tagként hozzáférhető projektjei, a tulajdonossal együtt betöltve. */
    @Query("""
        select p from Project p join fetch p.owner
        where p.owner.id = :userId
           or p.id in (select m.project.id from ProjectMember m where m.user.id = :userId)
        order by p.createdAt desc
        """)
    List<Project> findAccessible(@Param("userId") Long userId);
}
