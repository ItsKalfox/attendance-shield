package com.example.attendancesystem.service;

import com.example.attendancesystem.dto.AttendanceRecordResponse;
import com.example.attendancesystem.dto.AttendanceSubmitRequest;
import com.example.attendancesystem.exception.BadRequestException;
import com.example.attendancesystem.exception.ResourceNotFoundException;
import com.example.attendancesystem.model.*;
import com.example.attendancesystem.repository.AttendanceRecordRepository;
import com.example.attendancesystem.repository.AttendanceSessionRepository;
import com.example.attendancesystem.repository.UserRepository;
import com.example.attendancesystem.util.GeoUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class AttendanceService {

    private final AttendanceRecordRepository recordRepository;
    private final AttendanceSessionRepository sessionRepository;
    private final UserRepository userRepository;
    private final EventLogService eventLogService;

    public AttendanceService(AttendanceRecordRepository recordRepository,
                             AttendanceSessionRepository sessionRepository,
                             UserRepository userRepository,
                             EventLogService eventLogService) {
        this.recordRepository = recordRepository;
        this.sessionRepository = sessionRepository;
        this.userRepository = userRepository;
        this.eventLogService = eventLogService;
    }

    @Transactional
    public AttendanceRecordResponse submitAttendance(AttendanceSubmitRequest request, Long studentId, String ipAddress, String userAgent) {
        User student = userRepository.findById(studentId)
                .orElseThrow(() -> new ResourceNotFoundException("Student not found"));

        if (student.getRole() != Role.STUDENT) {
            throw new BadRequestException("Only students can submit attendance.");
        }

        AttendanceSession session = sessionRepository.findByQrToken(request.getQrToken())
                .orElseThrow(() -> new ResourceNotFoundException("Session with the provided QR Token not found"));

        if (recordRepository.existsBySession_SessionIdAndStudent_UserId(session.getSessionId(), studentId)) {
            throw new BadRequestException("Attendance already recorded for this session");
        }

        LocalDateTime now = LocalDateTime.now();
        AttendanceStatus status = AttendanceStatus.PRESENT;
        FlagLevel flagLevel = FlagLevel.NONE;
        String flagReason = null;

        boolean isTimeWindowValid = !now.isBefore(session.getQrActiveFrom()) && !now.isAfter(session.getQrExpiresAt());
        boolean isActive = session.getStatus() == SessionStatus.ACTIVE;

        boolean isVpn = Boolean.TRUE.equals(request.getVpnUsed()) || isIpVpn(ipAddress);
        boolean isRooted = Boolean.TRUE.equals(request.getDeviceRooted());

        if (!isTimeWindowValid || !isActive) {
            status = AttendanceStatus.REJECTED;
            flagLevel = FlagLevel.HIGH;
            flagReason = "Session is not active or QR code has expired";
        } else {
            if (!session.getAllowOutsideLocation()) {
                if (request.getLatitude() == null || request.getLongitude() == null) {
                    status = AttendanceStatus.REJECTED;
                    flagLevel = FlagLevel.HIGH;
                    flagReason = "GPS coordinates missing but required by geofence";
                } else {
                    double distance = GeoUtils.distance(
                            session.getCenterLat(),
                            session.getCenterLng(),
                            request.getLatitude(),
                            request.getLongitude()
                    );
                    if (distance > session.getRadiusMeters()) {
                        status = AttendanceStatus.REJECTED;
                        flagLevel = FlagLevel.HIGH;
                        flagReason = String.format("Outside geofence. Distance: %.1fm. Limit: %.1fm", distance, session.getRadiusMeters());
                    }
                }
            }

            if (status == AttendanceStatus.PRESENT) {
                if (now.isAfter(session.getQrActiveFrom().plusMinutes(15))) {
                    status = AttendanceStatus.LATE;
                }

                List<AttendanceRecord> recordsWithSameIp = recordRepository.findBySession_SessionIdAndIpAddress(session.getSessionId(), ipAddress);
                if (!recordsWithSameIp.isEmpty()) {
                    flagLevel = FlagLevel.MEDIUM;
                    flagReason = "Shared IP address detected with other submissions";
                }

                if (request.getDeviceFingerprint() != null && !request.getDeviceFingerprint().trim().isEmpty()) {
                    List<AttendanceRecord> recordsWithSameFingerprint = recordRepository.findBySession_SessionIdAndDeviceFingerprint(session.getSessionId(), request.getDeviceFingerprint());
                    if (!recordsWithSameFingerprint.isEmpty()) {
                        flagLevel = FlagLevel.MEDIUM;
                        flagReason = (flagReason == null ? "" : flagReason + "; ") + "Shared device fingerprint detected with other submissions";
                    }
                }

                if (now.isBefore(session.getQrActiveFrom().plusSeconds(30))) {
                    if (flagLevel == FlagLevel.NONE) {
                        flagLevel = FlagLevel.LOW;
                        flagReason = "Fast submission timing";
                    } else {
                        flagReason = flagReason + "; Fast submission timing";
                    }
                }

                if (request.getGpsAccuracy() != null && request.getGpsAccuracy() > 100) {
                    if (flagLevel == FlagLevel.NONE || flagLevel == FlagLevel.LOW) {
                        flagLevel = FlagLevel.LOW;
                        flagReason = (flagReason == null ? "" : flagReason + "; ") + "Low GPS accuracy (" + request.getGpsAccuracy() + "m)";
                    }
                }
            }

            // VPN & Root checks
            if (isRooted) {
                flagLevel = FlagLevel.HIGH;
                flagReason = (flagReason == null || flagReason.isEmpty() ? "" : flagReason + "; ") + "Rooted device detected";
            }
            if (isVpn) {
                flagLevel = FlagLevel.HIGH;
                flagReason = (flagReason == null || flagReason.isEmpty() ? "" : flagReason + "; ") + "VPN connection detected";
            }
        }

        AttendanceRecord record = new AttendanceRecord();
        record.setSession(session);
        record.setStudent(student);
        record.setStatus(status);
        record.setFlagLevel(flagLevel);
        record.setFlagReason(flagReason);
        record.setSubmittedAt(now);
        record.setLatitude(request.getLatitude());
        record.setLongitude(request.getLongitude());
        record.setGpsAccuracy(request.getGpsAccuracy());
        record.setIpAddress(ipAddress);
        record.setUserAgent(userAgent);
        record.setDeviceFingerprint(request.getDeviceFingerprint());
        record.setDeviceRooted(isRooted);
        record.setVpnUsed(isVpn);

        record = recordRepository.save(record);

        String extraMetadata = String.format("{\"recordId\":%d,\"flagLevel\":\"%s\",\"status\":\"%s\"}",
                record.getRecordId(), flagLevel.name(), status.name());
        eventLogService.logEvent(session, student, EventType.ATTENDANCE_SUBMITTED, ipAddress, userAgent, extraMetadata);

        return convertToResponse(record);
    }

    @Transactional(readOnly = true)
    public List<AttendanceRecordResponse> getRecordsBySession(Long sessionId) {
        return recordRepository.findBySession_SessionId(sessionId).stream()
                .map(this::convertToResponse)
                .collect(Collectors.toList());
    }

    private AttendanceRecordResponse convertToResponse(AttendanceRecord record) {
        AttendanceRecordResponse response = new AttendanceRecordResponse();
        response.setRecordId(record.getRecordId());
        response.setSessionId(record.getSession().getSessionId());
        response.setStudentId(record.getStudent().getUserId());
        response.setStudentName(record.getStudent().getFullName());
        response.setStudentEmail(record.getStudent().getEmail());
        response.setStatus(record.getStatus());
        response.setFlagLevel(record.getFlagLevel());
        response.setFlagReason(record.getFlagReason());
        response.setSubmittedAt(record.getSubmittedAt());
        response.setLatitude(record.getLatitude());
        response.setLongitude(record.getLongitude());
        response.setGpsAccuracy(record.getGpsAccuracy());
        response.setIpAddress(record.getIpAddress());
        response.setUserAgent(record.getUserAgent());
        response.setDeviceFingerprint(record.getDeviceFingerprint());
        response.setDeviceRooted(record.getDeviceRooted());
        response.setVpnUsed(record.getVpnUsed());
        return response;
    }

    private boolean isIpVpn(String ipAddress) {
        if (ipAddress == null || ipAddress.equals("127.0.0.1") || ipAddress.equals("0:0:0:0:0:0:0:1") 
                || ipAddress.startsWith("192.168.") || ipAddress.startsWith("10.") || ipAddress.startsWith("172.16.")) {
            return false;
        }
        try {
            String url = "http://ip-api.com/json/" + ipAddress + "?fields=status,message,proxy,hosting";
            java.net.URL obj = new java.net.URL(url);
            java.net.HttpURLConnection con = (java.net.HttpURLConnection) obj.openConnection();
            con.setRequestMethod("GET");
            con.setConnectTimeout(1500);
            con.setReadTimeout(1500);
            if (con.getResponseCode() == 200) {
                java.io.BufferedReader in = new java.io.BufferedReader(new java.io.InputStreamReader(con.getInputStream()));
                String inputLine;
                StringBuilder response = new StringBuilder();
                while ((inputLine = in.readLine()) != null) {
                    response.append(inputLine);
                }
                in.close();
                String json = response.toString();
                return json.contains("\"proxy\":true") || json.contains("\"hosting\":true");
            }
        } catch (Exception e) {
            System.err.println("[VpnDetection] Lookup failed for IP " + ipAddress + ": " + e.getMessage());
        }
        return false;
    }
}
