package com.example.attendancesystem.repository;

import com.example.attendancesystem.model.AttendanceSession;
import com.example.attendancesystem.model.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface AttendanceSessionRepository extends JpaRepository<AttendanceSession, Long> {
    Optional<AttendanceSession> findByQrToken(String qrToken);
    List<AttendanceSession> findByLecturer(User lecturer);
    List<AttendanceSession> findByLecturer_UserId(Long lecturerId);
}
