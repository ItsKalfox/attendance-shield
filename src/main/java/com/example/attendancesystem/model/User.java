package com.example.attendancesystem.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "users")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class User {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long userId;

    private String fullName;

    @Column(unique = true)
    private String email;

    private String passwordHash;

    @Enumerated(EnumType.STRING)
    private Role role;

    // Custom student ID (e.g. university registration number). Null for non-students.
    @Column(name = "student_id", unique = true, nullable = true)
    private String studentId;

    private LocalDateTime createdAt = LocalDateTime.now();
}