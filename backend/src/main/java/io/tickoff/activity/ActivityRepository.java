package io.tickoff.activity;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;

public interface ActivityRepository extends JpaRepository<ActivityEntry, Long> {

    List<ActivityEntry> findByProjectIdOrderByIdDesc(Long projectId, Pageable page);

    List<ActivityEntry> findByProjectIdAndIdLessThanOrderByIdDesc(Long projectId, Long before, Pageable page);

    @Modifying
    @Query("delete from ActivityEntry a where a.projectId = :projectId and a.createdAt < :before")
    int deleteOlderThan(@Param("projectId") Long projectId, @Param("before") Instant before);
}
