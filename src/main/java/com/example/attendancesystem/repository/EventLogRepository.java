package com.example.attendancesystem.repository;

import com.example.attendancesystem.model.EventLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface EventLogRepository extends JpaRepository<EventLog, Long> {
    List<EventLog> findBySession_SessionId(Long sessionId);
    List<EventLog> findBySession_SessionIdOrSessionNullOrderByTimestampDesc(Long sessionId);
    void deleteBySession_SessionId(Long sessionId);
    void deleteByUser_UserId(Long userId);
}
