package com.example.attendancesystem.config;

import com.example.attendancesystem.model.Role;
import com.example.attendancesystem.model.User;
import com.example.attendancesystem.repository.UserRepository;
import org.springframework.boot.CommandLineRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

import java.time.LocalDateTime;

@Component
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JdbcTemplate jdbcTemplate;

    public DataInitializer(UserRepository userRepository,
                           PasswordEncoder passwordEncoder,
                           JdbcTemplate jdbcTemplate) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.jdbcTemplate = jdbcTemplate;
    }

    @Override
    public void run(String... args) {
        // Only seed if the users table is empty (first-time setup)
        if (userRepository.count() > 0) {
            System.out.println("DataInitializer: users already exist, skipping seed.");
            return;
        }

        // Disable FK checks so we can truncate in any order
        jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 0");
        jdbcTemplate.execute("TRUNCATE TABLE attendance_records");
        jdbcTemplate.execute("TRUNCATE TABLE event_logs");
        jdbcTemplate.execute("TRUNCATE TABLE attendance_sessions");
        jdbcTemplate.execute("TRUNCATE TABLE users");
        jdbcTemplate.execute("SET FOREIGN_KEY_CHECKS = 1");

        // Encode once — all users share the same password
        String password = passwordEncoder.encode("0000");

        // Admin
        userRepository.save(createUser("Admin User", "admin@example.com", password, Role.ADMIN));

        // Lecturer
        userRepository.save(createUser("Lecturer", "lecturer@example.com", password, Role.LECTURER));

        // Four Students
        userRepository.save(createUser("Student 01", "student01@example.com", password, Role.STUDENT));
        userRepository.save(createUser("Student 02", "student02@example.com", password, Role.STUDENT));
        userRepository.save(createUser("Student 03", "student03@example.com", password, Role.STUDENT));
        userRepository.save(createUser("Student 04", "student04@example.com", password, Role.STUDENT));

        System.out.println("===========================================");
        System.out.println("  Users seeded (all passwords: 0000)");
        System.out.println("  Admin    : admin@example.com");
        System.out.println("  Lecturer : lecturer@example.com");
        System.out.println("  Student01: student01@example.com");
        System.out.println("  Student02: student02@example.com");
        System.out.println("  Student03: student03@example.com");
        System.out.println("  Student04: student04@example.com");
        System.out.println("===========================================");
    }

    private User createUser(String fullName, String email, String passwordHash, Role role) {
        User user = new User();
        user.setFullName(fullName);
        user.setEmail(email);
        user.setPasswordHash(passwordHash);
        user.setRole(role);
        user.setCreatedAt(LocalDateTime.now());
        return user;
    }
}
