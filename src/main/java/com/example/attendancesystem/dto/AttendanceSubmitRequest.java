package com.example.attendancesystem.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class AttendanceSubmitRequest {
    @NotBlank(message = "QR Token is required")
    private String qrToken;

    private Double latitude;
    private Double longitude;
    private Double gpsAccuracy;
    private String deviceFingerprint;

    private Boolean deviceRooted;
    private Boolean vpnUsed;
}
