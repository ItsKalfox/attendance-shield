package com.example.attendancesystem.repository;

import com.example.attendancesystem.model.AttendanceRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.stereotype.Repository;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Repository
public interface AttendanceRecordRepository extends JpaRepository<AttendanceRecord, Long> {
    List<AttendanceRecord> findBySession_SessionId(Long sessionId);
    boolean existsBySession_SessionIdAndStudent_UserId(Long sessionId, Long studentId);
    List<AttendanceRecord> findBySession_SessionIdAndIpAddress(Long sessionId, String ipAddress);
    List<AttendanceRecord> findBySession_SessionIdAndDeviceFingerprint(Long sessionId, String deviceFingerprint);
    @Modifying
    @Transactional
    void deleteBySession_SessionId(Long sessionId);

    @Modifying
    @Transactional
    void deleteByStudent_UserId(Long studentId);
}
