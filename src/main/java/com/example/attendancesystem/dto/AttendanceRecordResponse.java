package com.example.attendancesystem.dto;

import com.example.attendancesystem.model.AttendanceStatus;
import com.example.attendancesystem.model.FlagLevel;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class AttendanceRecordResponse {
    private Long recordId;
    private Long sessionId;
    private Long studentId;
    private String studentName;
    private String studentEmail;
    private AttendanceStatus status;
    private FlagLevel flagLevel;
    private String flagReason;
    private LocalDateTime submittedAt;
    private Double latitude;
    private Double longitude;
    private Double gpsAccuracy;
    private String ipAddress;
    private String userAgent;
    private String deviceFingerprint;
    private Boolean deviceRooted;
    private Boolean vpnUsed;
}
