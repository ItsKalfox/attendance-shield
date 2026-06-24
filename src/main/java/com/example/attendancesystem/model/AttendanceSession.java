package com.example.attendancesystem.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "attendance_sessions")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long sessionId;

    @ManyToOne
    @JoinColumn(name = "lecturer_id")
    private User lecturer;

    private String moduleCode;
    private String moduleName;
    private String lectureTopic;

    private Integer expectedStudents;

    @Column(unique = true)
    private String qrToken;

    private LocalDateTime lectureStartTime;
    private LocalDateTime lectureEndTime;

    private LocalDateTime qrActiveFrom;
    private LocalDateTime qrExpiresAt;

    private Boolean allowOutsideLocation;

    private Double centerLat;
    private Double centerLng;
    private Double radiusMeters;

    @Enumerated(EnumType.STRING)
    private SessionStatus status;

    private LocalDateTime createdAt = LocalDateTime.now();
}