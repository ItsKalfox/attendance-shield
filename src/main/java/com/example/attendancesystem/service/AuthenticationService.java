package com.example.attendancesystem.service;

import com.example.attendancesystem.dto.LoginRequest;
import com.example.attendancesystem.dto.LoginResponse;
import com.example.attendancesystem.exception.UnauthorizedException;
import com.example.attendancesystem.model.EventType;
import com.example.attendancesystem.model.User;
import com.example.attendancesystem.repository.UserRepository;
import com.example.attendancesystem.security.JwtTokenProvider;
import com.example.attendancesystem.security.UserPrincipal;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import com.example.attendancesystem.model.AttendanceSession;
import com.example.attendancesystem.repository.AttendanceSessionRepository;

@Service
public class AuthenticationService {

    private final UserRepository userRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtTokenProvider tokenProvider;
    private final EventLogService eventLogService;
    private final AttendanceSessionRepository sessionRepository;

    public AuthenticationService(UserRepository userRepository,
                                 PasswordEncoder passwordEncoder,
                                 JwtTokenProvider tokenProvider,
                                 EventLogService eventLogService,
                                 AttendanceSessionRepository sessionRepository) {
        this.userRepository = userRepository;
        this.passwordEncoder = passwordEncoder;
        this.tokenProvider = tokenProvider;
        this.eventLogService = eventLogService;
        this.sessionRepository = sessionRepository;
    }

    @Transactional
    public LoginResponse login(LoginRequest request, String ipAddress, String userAgent) {
        AttendanceSession session = null;
        if (request.getQrToken() != null && !request.getQrToken().isEmpty()) {
            session = sessionRepository.findByQrToken(request.getQrToken()).orElse(null);
            if (session == null) {
                throw new UnauthorizedException("This QR code is invalid or no longer exists. The session may have been deleted by the lecturer.");
            }
        }

        // Log attempt first (nullable user/session)
        String safeEmail = request.getEmail().replace("\\", "\\\\").replace("\"", "\\\"");
        eventLogService.logEvent(session, null, EventType.LOGIN_ATTEMPT, ipAddress, userAgent, 
                "{\"email\":\"" + safeEmail + "\"}");

        AttendanceSession finalSession = session;
        User user = userRepository.findByEmail(request.getEmail())
                .orElseThrow(() -> {
                    eventLogService.logEvent(finalSession, null, EventType.LOGIN_FAILED, ipAddress, userAgent, 
                            "{\"email\":\"" + request.getEmail() + "\", \"reason\":\"User not found\"}");
                    return new UnauthorizedException("Invalid email or password");
                });

        if (!passwordEncoder.matches(request.getPassword(), user.getPasswordHash())) {
            eventLogService.logEvent(session, user, EventType.LOGIN_FAILED, ipAddress, userAgent, 
                    "{\"email\":\"" + request.getEmail() + "\", \"reason\":\"Password mismatch\"}");
            throw new UnauthorizedException("Invalid email or password");
        }

        // Generate token
        UserPrincipal principal = UserPrincipal.create(user);
        Authentication authentication = new UsernamePasswordAuthenticationToken(principal, null, principal.getAuthorities());
        String token = tokenProvider.generateToken(authentication);

        // Log success
        eventLogService.logEvent(session, user, EventType.LOGIN_SUCCESS, ipAddress, userAgent, null);

        return new LoginResponse(
                token,
                user.getUserId(),
                user.getEmail(),
                user.getFullName(),
                user.getRole().name()
        );
    }
}
