package com.example.attendancesystem.dto;

import com.example.attendancesystem.model.SessionStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class SessionResponse {
    private Long sessionId;
    private Long lecturerId;
    private String lecturerName;
    private String moduleCode;
    private String moduleName;
    private String lectureTopic;
    private Integer expectedStudents;
    private String qrToken;
    private LocalDateTime lectureStartTime;
    private LocalDateTime lectureEndTime;
    private LocalDateTime qrActiveFrom;
    private LocalDateTime qrExpiresAt;
    private Boolean allowOutsideLocation;
    private Double centerLat;
    private Double centerLng;
    private Double radiusMeters;
    private SessionStatus status;
    private LocalDateTime createdAt;
}
