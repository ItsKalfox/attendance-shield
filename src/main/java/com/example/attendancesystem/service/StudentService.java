package com.example.attendancesystem.service;

import com.example.attendancesystem.dto.StudentRequest;
import com.example.attendancesystem.dto.StudentResponse;
import com.example.attendancesystem.exception.BadRequestException;
import com.example.attendancesystem.exception.ResourceNotFoundException;
import com.example.attendancesystem.model.Role;
import com.example.attendancesystem.model.User;
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
public class StudentService {

    private static final String CHARS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789@#";
    private static final int PASSWORD_LENGTH = 10;

    private final UserRepository userRepository;
    private final AttendanceRecordRepository recordRepository;
    private final AttendanceSessionRepository sessionRepository;
    private final EventLogRepository eventLogRepository;
    private final PasswordEncoder passwordEncoder;
    private final EmailService emailService;

    public StudentService(UserRepository userRepository,
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
    public List<StudentResponse> getAllStudents() {
        return userRepository.findByRole(Role.STUDENT)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public StudentResponse createStudent(StudentRequest request) {
        if (userRepository.findByEmail(request.getEmail()).isPresent()) {
            throw new BadRequestException("A user with this email already exists");
        }
        if (userRepository.findByStudentId(request.getStudentId()).isPresent()) {
            throw new BadRequestException("A student with this Student ID already exists");
        }

        String rawPassword = generatePassword();

        User user = new User();
        user.setStudentId(request.getStudentId());
        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        user.setRole(Role.STUDENT);
        user.setCreatedAt(LocalDateTime.now());

        user = userRepository.save(user);

        // Send welcome email asynchronously — never blocks the response
        emailService.sendWelcomeEmail(user.getEmail(), user.getFullName(), user.getStudentId(), rawPassword);

        return toResponse(user);
    }

    @Transactional
    public StudentResponse updateStudent(Long userId, StudentRequest request) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

        if (user.getRole() != Role.STUDENT) {
            throw new BadRequestException("User is not a student");
        }

        // Check email uniqueness (excluding this user)
        userRepository.findByEmail(request.getEmail()).ifPresent(existing -> {
            if (!existing.getUserId().equals(userId)) {
                throw new BadRequestException("Email is already used by another account");
            }
        });

        // Check studentId uniqueness (excluding this user)
        userRepository.findByStudentId(request.getStudentId()).ifPresent(existing -> {
            if (!existing.getUserId().equals(userId)) {
                throw new BadRequestException("Student ID is already used by another student");
            }
        });

        user.setFullName(request.getFullName());
        user.setEmail(request.getEmail());
        user.setStudentId(request.getStudentId());

        return toResponse(userRepository.save(user));
    }

    @Transactional
    public void deleteStudent(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

        if (user.getRole() != Role.STUDENT) {
            throw new BadRequestException("User is not a student");
        }

        // Delete attendance records for all sessions this student participated in
        recordRepository.deleteByStudent_UserId(userId);

        // Delete event logs referencing this user
        eventLogRepository.deleteByUser_UserId(userId);

        userRepository.delete(user);
    }

    @Transactional
    public StudentResponse resetPassword(Long userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

        if (user.getRole() != Role.STUDENT) {
            throw new BadRequestException("User is not a student");
        }

        String rawPassword = generatePassword();
        user.setPasswordHash(passwordEncoder.encode(rawPassword));
        userRepository.save(user);

        // Send password reset email asynchronously
        emailService.sendPasswordResetEmail(user.getEmail(), user.getFullName(), user.getStudentId(), rawPassword);

        return toResponse(user);
    }

    private StudentResponse toResponse(User user) {
        StudentResponse r = new StudentResponse();
        r.setUserId(user.getUserId());
        r.setStudentId(user.getStudentId());
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
