package com.example.attendancesystem.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "attendance_records")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class AttendanceRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long recordId;

    @ManyToOne
    @JoinColumn(name = "session_id")
    private AttendanceSession session;

    @ManyToOne
    @JoinColumn(name = "student_id")
    private User student;

    @Enumerated(EnumType.STRING)
    private AttendanceStatus status;

    @Enumerated(EnumType.STRING)
    private FlagLevel flagLevel;

    private String flagReason;

    private LocalDateTime submittedAt = LocalDateTime.now();

    private Double latitude;
    private Double longitude;
    private Double gpsAccuracy;

    private String ipAddress;

    @Column(columnDefinition = "TEXT")
    private String userAgent;

    private String deviceFingerprint;

    private Boolean deviceRooted;
    private Boolean vpnUsed;
}