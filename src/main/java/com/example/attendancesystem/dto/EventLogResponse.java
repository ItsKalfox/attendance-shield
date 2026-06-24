package com.example.attendancesystem.dto;

import com.example.attendancesystem.model.EventType;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class EventLogResponse {
    private Long eventId;
    private Long sessionId;
    private Long userId;
    private String userEmail;
    private EventType eventType;
    private LocalDateTime timestamp;
    private String ipAddress;
    private String userAgent;
    private String extraData;
}
