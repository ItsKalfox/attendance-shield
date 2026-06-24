package com.example.attendancesystem.service;

import com.example.attendancesystem.dto.CreateSessionRequest;
import com.example.attendancesystem.dto.SessionResponse;
import com.example.attendancesystem.exception.BadRequestException;
import com.example.attendancesystem.exception.ResourceNotFoundException;
import com.example.attendancesystem.model.AttendanceSession;
import com.example.attendancesystem.model.SessionStatus;
import com.example.attendancesystem.model.User;
import com.example.attendancesystem.repository.AttendanceSessionRepository;
import com.example.attendancesystem.repository.UserRepository;
import com.example.attendancesystem.repository.AttendanceRecordRepository;
import com.example.attendancesystem.repository.EventLogRepository;
import com.example.attendancesystem.model.EventType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.UUID;
import java.util.stream.Collectors;

@Service
public class SessionService {

    private final AttendanceSessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final AttendanceRecordRepository recordRepository;
    private final EventLogRepository eventLogRepository;
    private final EventLogService eventLogService;

    public SessionService(AttendanceSessionRepository sessionRepository, 
                          UserRepository userRepository,
                          AttendanceRecordRepository recordRepository,
                          EventLogRepository eventLogRepository,
                          EventLogService eventLogService) {
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.recordRepository = recordRepository;
        this.eventLogRepository = eventLogRepository;
        this.eventLogService = eventLogService;
    }

    @Transactional
    public SessionResponse createSession(CreateSessionRequest request, Long lecturerId, String ipAddress, String userAgent) {
        User lecturer = userRepository.findById(lecturerId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecturer not found"));

        if (request.getLectureEndTime().isBefore(request.getLectureStartTime())) {
            throw new BadRequestException("Lecture end time must be after lecture start time");
        }

        LocalDateTime activeFrom;
        LocalDateTime expiresAt;

        if (request.getUseSameForQr()) {
            activeFrom = request.getLectureStartTime();
            expiresAt = request.getLectureEndTime();
        } else {
            activeFrom = request.getQrActiveFrom();
            if (activeFrom == null) {
                activeFrom = LocalDateTime.now();
            }
            expiresAt = request.getQrExpiresAt();
            if (expiresAt == null) {
                throw new BadRequestException("QR expiration time is required when manual QR duration is chosen");
            }
            if (expiresAt.isBefore(activeFrom)) {
                throw new BadRequestException("QR expiration time must be after activation time");
            }
        }

        if (!request.getAllowOutsideLocation()) {
            if (request.getCenterLat() == null || request.getCenterLng() == null || request.getRadiusMeters() == null) {
                throw new BadRequestException("GPS coordinates and geofence radius are required when geofencing is enabled");
            }
        }

        AttendanceSession session = new AttendanceSession();
        session.setLecturer(lecturer);
        session.setModuleCode(request.getModuleCode());
        session.setModuleName(request.getModuleName());
        session.setLectureTopic(request.getLectureTopic());
        session.setExpectedStudents(request.getExpectedStudents());
        session.setLectureStartTime(request.getLectureStartTime());
        session.setLectureEndTime(request.getLectureEndTime());
        
        session.setQrToken(UUID.randomUUID().toString());
        session.setQrActiveFrom(activeFrom);
        session.setQrExpiresAt(expiresAt);
        session.setAllowOutsideLocation(request.getAllowOutsideLocation());
        session.setCenterLat(request.getCenterLat());
        session.setCenterLng(request.getCenterLng());
        session.setRadiusMeters(request.getRadiusMeters());

        LocalDateTime now = LocalDateTime.now();
        if (now.isBefore(activeFrom)) {
            session.setStatus(SessionStatus.SCHEDULED);
        } else if (now.isAfter(expiresAt)) {
            session.setStatus(SessionStatus.ENDED);
        } else {
            session.setStatus(SessionStatus.ACTIVE);
        }

        session = sessionRepository.save(session);

        // Log QR generation — use safe JSON escaping to prevent malformed JSON causing a rollback
        try {
            String safeTopic = session.getLectureTopic().replace("\\", "\\\\").replace("\"", "\\\"");
            String safeCode = session.getModuleCode().replace("\\", "\\\\").replace("\"", "\\\"");
            String extraData = "{\"topic\":\"" + safeTopic + "\",\"moduleCode\":\"" + safeCode + "\"}";
            eventLogService.logEvent(session, lecturer, EventType.QR_GENERATED, ipAddress, userAgent, extraData);
        } catch (Exception ex) {
            // Log failure must never roll back the session creation
        }

        return convertToResponse(session);
    }

    @Transactional
    public SessionResponse getSessionDetails(Long sessionId) {
        AttendanceSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new ResourceNotFoundException("Attendance session not found"));
        updateSessionStatus(session);
        return convertToResponse(session);
    }

    @Transactional
    public SessionResponse getSessionDetailsByQrToken(String qrToken, String ipAddress, String userAgent) {
        AttendanceSession session = sessionRepository.findByQrToken(qrToken)
                .orElseThrow(() -> new ResourceNotFoundException("Invalid QR token"));
        updateSessionStatus(session);
        eventLogService.logEvent(session, null, EventType.QR_OPENED, ipAddress, userAgent, null);
        return convertToResponse(session);
    }

    @Transactional
    public List<SessionResponse> getAllSessions() {
        return sessionRepository.findAll().stream()
                .peek(this::updateSessionStatus)
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public List<SessionResponse> getSessionsByLecturer(Long lecturerId) {
        return sessionRepository.findByLecturer_UserId(lecturerId).stream()
                .peek(this::updateSessionStatus)
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteSession(Long sessionId) {
        if (!sessionRepository.existsById(sessionId)) {
            throw new ResourceNotFoundException("Session not found");
        }
        recordRepository.deleteBySession_SessionId(sessionId);
        eventLogRepository.deleteBySession_SessionId(sessionId);
        sessionRepository.deleteById(sessionId);
    }

    private void updateSessionStatus(AttendanceSession session) {
        LocalDateTime now = LocalDateTime.now();
        if (session.getStatus() == SessionStatus.SCHEDULED && !now.isBefore(session.getQrActiveFrom())) {
            session.setStatus(SessionStatus.ACTIVE);
            sessionRepository.save(session);
        }
        if (session.getStatus() == SessionStatus.ACTIVE && now.isAfter(session.getQrExpiresAt())) {
            session.setStatus(SessionStatus.ENDED);
            sessionRepository.save(session);
        }
    }

    private SessionResponse convertToResponse(AttendanceSession session) {
        SessionResponse response = new SessionResponse();
        response.setSessionId(session.getSessionId());
        response.setLecturerId(session.getLecturer().getUserId());
        response.setLecturerName(session.getLecturer().getFullName());
        response.setModuleCode(session.getModuleCode());
        response.setModuleName(session.getModuleName());
        response.setLectureTopic(session.getLectureTopic());
        response.setExpectedStudents(session.getExpectedStudents());
        response.setQrToken(session.getQrToken());
        response.setLectureStartTime(session.getLectureStartTime());
        response.setLectureEndTime(session.getLectureEndTime());
        response.setQrActiveFrom(session.getQrActiveFrom());
        response.setQrExpiresAt(session.getQrExpiresAt());
        response.setAllowOutsideLocation(session.getAllowOutsideLocation());
        response.setCenterLat(session.getCenterLat());
        response.setCenterLng(session.getCenterLng());
        response.setRadiusMeters(session.getRadiusMeters());
        response.setStatus(session.getStatus());
        response.setCreatedAt(session.getCreatedAt());
        return response;
    }
}
