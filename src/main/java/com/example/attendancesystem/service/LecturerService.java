package com.example.attendancesystem.service;

import com.example.attendancesystem.dto.LecturerRequest;
import com.example.attendancesystem.dto.LecturerResponse;
import com.example.attendancesystem.exception.BadRequestException;
import com.example.attendancesystem.exception.ResourceNotFoundException;
import com.example.attendancesystem.model.Role;
import com.example.attendancesystem.model.User;
import com.example.attendancesystem.model.AttendanceSession;
import com.example.attendancesystem.repository.AttendanceRecordRepository;
import com.example.attendancesystem.repository.AttendanceSessionRepository;
import com.example.attendancesystem.repository.EventLogRepository;
import com.example.attendancesystem.repository.UserRepository;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class LecturerService {

    private static final String CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#";
    private static final int PASSWORD_LENGTH = 10;

    private final UserRepository userRepository;
    private final AttendanceRecordRepository recordRepository;
    private final AttendanceSessionRepository sessionRepository;
    private final EventLogRepository eventLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    public LecturerService(UserRepository userRepository,
                           AttendanceRecordRepository recordRepository,
                           AttendanceSessionRepository sessionRepository,
                           EventLogRepository eventLogRepository,
                           PasswordEncoder passwordEncoder,
                           EmailService emailService) {
        this.userRepository = userRepository;
        this.recordRepository = recordRepository;
        this.sessionRepository = sessionRepository;
        this.eventLogRepository = eventLogRepository;
        this.passwordEncoder = passwordEncoder;
        this.emailService = emailService;
    }

    @Transactional(readOnly = true)
    public List<LecturerResponse> getAllLecturers() {
        return userRepository.findByRole(Role.LECTURER)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public LecturerResponse createLecturer(LecturerRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new BadRequestException("A user with this email already exists");
        }

        String rawPassword = generatePassword();

        User user = new User();
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setRole(Role.LECTURER);
        user.setCreatedAt(LocalDateTime.now());

        user = userRepository.save(user);

        // Auto-generate studentId based on auto-incremented userId
        user.setStudentId("L" + user.getUserId());
        user = userRepository.save(user);

        emailService.sendLecturerWelcomeEmail(user.getEmail(), user.getFullName(), user.getStudentId(), rawPassword);

        return toResponse(user);
    }

    @Transactional
    public LecturerResponse updateLecturer(Long userId, LecturerRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecturer not found"));

        if (user.getRole() != Role.LECTURER) {
            throw new BadRequestException("User is not a lecturer");
        }

        userRepository.findByEmail(request.getEmail()).ifPresent(existing -> {
            if (!existing.getUserId().equals(userId)) {
                throw new BadRequestException("Email is already used by another account");
            }
        });

        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());

        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void deleteLecturer(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecturer not found"));

        if (user.getRole() != Role.LECTURER) {
            throw new BadRequestException("User is not a lecturer");
        }

        // Delete all sessions owned by this lecturer and their related records
        List<AttendanceSession> sessions = sessionRepository.findByLecturer_UserId(userId);
        for (AttendanceSession session : sessions) {
            recordRepository.deleteBySession_SessionId(session.getSessionId());
            eventLogRepository.deleteBySession_SessionId(session.getSessionId());
            sessionRepository.delete(session);
        }

        // Delete event logs where this lecturer was the direct actor
        eventLogRepository.deleteByUser_UserId(userId);

        userRepository.delete(user);
    }

    @Transactional
    public LecturerResponse resetPassword(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Lecturer not found"));

        if (user.getRole() != Role.LECTURER) {
            throw new BadRequestException("User is not a lecturer");
        }

        String rawPassword = generatePassword();
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        userRepository.save(user);

        emailService.sendLecturerPasswordResetEmail(user.getEmail(), user.getFullName(), user.getStudentId(), rawPassword);

        return toResponse(user);
    }

    private LecturerResponse toResponse(User user) {
        LecturerResponse r = new LecturerResponse();
        r.setUserId(user.getUserId());
        r.setLecturerId(user.getStudentId()); // mapped to studentId field
        r.setFullName(user.getFullName());
        r.setEmail(user.getEmail());
        r.setCreatedAt(user.getCreatedAt());
        return r;
    }

    private String generatePassword() {
        SecureRandom rng = new SecureRandom();
        StringBuilder sb = new StringBuilder(PASSWORD_LENGTH);
        for (int i = 0; i < PASSWORD_LENGTH; i++) {
            sb.append(CHARS.charAt(rng.nextInt(CHARS.length())));
        }
        return sb.toString();
    }
}
