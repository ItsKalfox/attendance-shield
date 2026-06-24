package com.example.attendancesystem.controller;

import com.example.attendancesystem.dto.AttendanceRecordResponse;
import com.example.attendancesystem.dto.AttendanceSubmitRequest;
import com.example.attendancesystem.model.Role;
import com.example.attendancesystem.security.UserPrincipal;
import com.example.attendancesystem.service.AttendanceService;
import com.example.attendancesystem.service.SessionService;
import com.example.attendancesystem.util.RequestUtils;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/attendance")
public class AttendanceController {

    private final AttendanceService attendanceService;
    private final SessionService sessionService;

    public AttendanceController(AttendanceService attendanceService, SessionService sessionService) {
        this.attendanceService = attendanceService;
        this.sessionService = sessionService;
    }

    @PostMapping("/submit")
    public ResponseEntity<AttendanceRecordResponse> submitAttendance(
            @Valid @RequestBody AttendanceSubmitRequest request,
            @AuthenticationPrincipal UserPrincipal principal,
            HttpServletRequest httpRequest) {
        String ipAddress = RequestUtils.getClientIp(httpRequest);
        String userAgent = RequestUtils.getUserAgent(httpRequest);
        AttendanceRecordResponse response = attendanceService.submitAttendance(request, principal.getUserId(), ipAddress, userAgent);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/session/{id}")
    public ResponseEntity<List<AttendanceRecordResponse>> getRecordsBySession(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        com.example.attendancesystem.dto.SessionResponse session = sessionService.getSessionDetails(id);
        if (principal.getRole() == Role.LECTURER && !session.getLecturerId().equals(principal.getUserId())) {
            throw new AccessDeniedException("You do not have permission to view attendance records for this session");
        }
        List<AttendanceRecordResponse> responses = attendanceService.getRecordsBySession(id);
        return ResponseEntity.ok(responses);
    }
}
