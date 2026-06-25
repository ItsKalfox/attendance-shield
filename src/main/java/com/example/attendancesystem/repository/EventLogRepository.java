package com.example.attendancesystem.repository;

import com.example.attendancesystem.model.EventLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface EventLogRepository extends JpaRepository<EventLog, Long> {
    List<EventLog> findBySession_SessionId(Long sessionId);

    @Query("SELECT e FROM EventLog e WHERE e.session.sessionId = :sessionId OR e.session IS NULL ORDER BY e.timestamp DESC")
    List<EventLog> findBySession_SessionIdOrSessionNullOrderByTimestampDesc(@Param("sessionId") Long sessionId);
    List<EventLog> findAllByOrderByTimestampDesc();
    @Modifying
    @Transactional
    void deleteBySession_SessionId(Long sessionId);

    @Modifying
    @Transactional
    void deleteByUser_UserId(Long userId);
}
