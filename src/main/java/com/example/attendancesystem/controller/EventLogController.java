package com.example.attendancesystem.controller;

import com.example.attendancesystem.dto.EventLogResponse;
import com.example.attendancesystem.model.EventLog;
import com.example.attendancesystem.model.Role;
import com.example.attendancesystem.security.UserPrincipal;
import com.example.attendancesystem.service.EventLogService;
import com.example.attendancesystem.service.SessionService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/events")
public class EventLogController {

    private final EventLogService eventLogService;
    private final SessionService sessionService;

    public EventLogController(EventLogService eventLogService, SessionService sessionService) {
        this.eventLogService = eventLogService;
        this.sessionService = sessionService;
    }

    @GetMapping("/session/{id}")
    public ResponseEntity<List<EventLogResponse>> getEventLogsBySession(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        
        // Ownership check
        com.example.attendancesystem.dto.SessionResponse session = sessionService.getSessionDetails(id);
        if (principal.getRole() == Role.LECTURER && !session.getLecturerId().equals(principal.getUserId())) {
            throw new AccessDeniedException("You do not have permission to view event logs for this session");
        }

        List<EventLog> logs = eventLogService.getEventLogsBySession(id);
        List<EventLogResponse> response = logs.stream().map(log -> {
            EventLogResponse dto = new EventLogResponse();
            dto.setEventId(log.getEventId());
            dto.setSessionId(log.getSession() != null ? log.getSession().getSessionId() : null);
            dto.setUserId(log.getUser() != null ? log.getUser().getUserId() : null);
            dto.setUserEmail(log.getUser() != null ? log.getUser().getEmail() : null);
            dto.setEventType(log.getEventType());
            dto.setTimestamp(log.getTimestamp());
            dto.setIpAddress(log.getIpAddress());
            dto.setUserAgent(log.getUserAgent());
            dto.setExtraData(log.getExtraData());
            return dto;
        }).collect(Collectors.toList());
        return ResponseEntity.ok(response);
    }
}
