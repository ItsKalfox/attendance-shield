package com.example.attendancesystem.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateSessionRequest {
    @NotBlank(message = "Module code is required")
    private String moduleCode;

    @NotBlank(message = "Module name is required")
    private String moduleName;

    @NotBlank(message = "Lecture topic is required")
    private String lectureTopic;

    @NotNull(message = "Expected students count is required")
    private Integer expectedStudents;

    @NotNull(message = "Lecture start time is required")
    private LocalDateTime lectureStartTime;

    @NotNull(message = "Lecture end time is required")
    private LocalDateTime lectureEndTime;

    @NotNull(message = "useSameForQr flag is required")
    private Boolean useSameForQr;

    private LocalDateTime qrActiveFrom;

    private LocalDateTime qrExpiresAt;

    @NotNull(message = "allowOutsideLocation flag is required")
    private Boolean allowOutsideLocation;

    private Double centerLat;
    private Double centerLng;
    private Double radiusMeters;
}
