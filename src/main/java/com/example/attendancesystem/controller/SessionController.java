package com.example.attendancesystem.controller;

import com.example.attendancesystem.dto.CreateSessionRequest;
import com.example.attendancesystem.dto.SessionResponse;
import com.example.attendancesystem.model.Role;
import com.example.attendancesystem.security.UserPrincipal;
import com.example.attendancesystem.service.SessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/session")
public class SessionController {

    private final SessionService sessionService;

    public SessionController(SessionService sessionService) {
        this.sessionService = sessionService;
    }

    @PostMapping("/create")
    public ResponseEntity<SessionResponse> createSession(
            @Valid @RequestBody CreateSessionRequest request,
            @AuthenticationPrincipal UserPrincipal principal,
            jakarta.servlet.http.HttpServletRequest httpRequest) {
        String ipAddress = com.example.attendancesystem.util.RequestUtils.getClientIp(httpRequest);
        String userAgent = com.example.attendancesystem.util.RequestUtils.getUserAgent(httpRequest);
        SessionResponse response = sessionService.createSession(request, principal.getUserId(), ipAddress, userAgent);
        return new ResponseEntity<>(response, HttpStatus.CREATED);
    }

    @GetMapping("/{id}")
    public ResponseEntity<SessionResponse> getSessionById(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        SessionResponse response = sessionService.getSessionDetails(id);
        if (principal.getRole() == Role.LECTURER && !response.getLecturerId().equals(principal.getUserId())) {
            throw new AccessDeniedException("You do not have permission to access this session");
        }
        return ResponseEntity.ok(response);
    }

    @GetMapping("/qr/{qrToken}")
    public ResponseEntity<SessionResponse> getSessionByQrToken(@PathVariable String qrToken, jakarta.servlet.http.HttpServletRequest httpRequest) {
        String ipAddress = com.example.attendancesystem.util.RequestUtils.getClientIp(httpRequest);
        String userAgent = com.example.attendancesystem.util.RequestUtils.getUserAgent(httpRequest);
        SessionResponse response = sessionService.getSessionDetailsByQrToken(qrToken, ipAddress, userAgent);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/all")
    public ResponseEntity<List<SessionResponse>> getAllSessions(@AuthenticationPrincipal UserPrincipal principal) {
        List<SessionResponse> sessions;
        if (principal.getRole() == Role.ADMIN) {
            sessions = sessionService.getAllSessions();
        } else {
            sessions = sessionService.getSessionsByLecturer(principal.getUserId());
        }
        return ResponseEntity.ok(sessions);
    }

    @PatchMapping("/{id}/end")
    public ResponseEntity<SessionResponse> endSession(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        SessionResponse response = sessionService.getSessionDetails(id);
        if (principal.getRole() == Role.LECTURER && !response.getLecturerId().equals(principal.getUserId())) {
            throw new AccessDeniedException("You do not have permission to end this session");
        }
        SessionResponse ended = sessionService.endSession(id);
        return ResponseEntity.ok(ended);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSession(
            @PathVariable Long id,
            @AuthenticationPrincipal UserPrincipal principal) {
        SessionResponse response = sessionService.getSessionDetails(id);
        if (principal.getRole() == Role.LECTURER && !response.getLecturerId().equals(principal.getUserId())) {
            throw new AccessDeniedException("You do not have permission to delete this session");
        }
        sessionService.deleteSession(id);
        return ResponseEntity.noContent().build();
    }
}
