package com.example.attendancesystem.service;

import com.example.attendancesystem.model.AttendanceSession;
import com.example.attendancesystem.model.EventLog;
import com.example.attendancesystem.model.EventType;
import com.example.attendancesystem.model.User;
import com.example.attendancesystem.repository.EventLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
public class EventLogService {

    private final EventLogRepository eventLogRepository;

    public EventLogService(EventLogRepository eventLogRepository) {
        this.eventLogRepository = eventLogRepository;
    }

    @Transactional(propagation = Propagation.REQUIRED)
    public void logEvent(AttendanceSession session, User user, EventType eventType, String ipAddress, String userAgent, String extraData) {
        try {
            EventLog eventLog = new EventLog();
            eventLog.setSession(session);
            eventLog.setUser(user);
            eventLog.setEventType(eventType);
            eventLog.setIpAddress(ipAddress);
            eventLog.setUserAgent(userAgent);
            eventLog.setExtraData(extraData);
            eventLog.setTimestamp(LocalDateTime.now());

            eventLogRepository.save(eventLog);
        } catch (Exception ex) {
            // Never let logging failure crash the caller's transaction
        }
    }

    @Transactional(readOnly = true)
    public List<EventLog> getEventLogsBySession(Long sessionId) {
        return eventLogRepository.findBySession_SessionIdOrSessionNullOrderByTimestampDesc(sessionId);
    }

    @Transactional(readOnly = true)
    public List<EventLog> getAllEventLogs() {
        return eventLogRepository.findAllByOrderByTimestampDesc();
    }
}
