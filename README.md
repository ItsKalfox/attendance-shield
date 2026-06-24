# AttendanceShield

A secure QR Code-based attendance management system designed for universities and educational institutions.

AttendanceShield enables lecturers to generate time-limited QR codes for attendance, while students securely check in using their university credentials. The system includes geofencing, JWT authentication, comprehensive security audit logging, and anomaly detection to help identify suspicious attendance submissions.

---

## Features

### Authentication
- JWT-based authentication
- Role-based access control
  - Administrator
  - Lecturer
  - Student
- Secure password hashing
- Optional "Keep me signed in"

### Attendance Sessions
- Generate QR codes for lectures
- Schedule future attendance sessions
- Custom QR activation and expiration times
- Automatic QR validity based on lecture duration
- End active sessions manually
- View active and previous sessions

### QR Attendance
- QR code scanning
- Student login before every attendance submission
- One attendance record per student per session
- Session validation
- QR expiration validation

### Geofencing
- Optional location restriction
- Use lecturer's current location
- Select custom location from an interactive map
- Configurable attendance radius
- Outside-area submissions are flagged

### Security Audit Logging
Records every important event including:

- QR scanned
- Login attempt
- Login success
- Login failure
- Attendance submission
- Session creation
- Session termination

Each event stores:

- Timestamp
- IP address
- User Agent
- Additional metadata

### Attendance Monitoring

Per session:

- Expected students
- Students attended
- Attendance percentage
- High-risk flagged records
- Optional Low/Medium flag display
- Attendance history

### Security Features

- JWT Authentication
- HTTPS Support
- Geofencing
- QR expiration
- Device fingerprint collection
- IP address logging
- User Agent logging
- Security event auditing
- Suspicious activity detection

---

## Technology Stack

### Backend

- Java 25
- Spring Boot
- Spring Security
- Spring Data JPA
- Hibernate
- Maven

### Database

- MySQL

### Frontend

- HTML5
- CSS3
- Vanilla JavaScript
- Leaflet.js
- OpenStreetMap

### Security

- JWT
- BCrypt Password Hashing
- HTTPS
- Geolocation API

---

## Project Structure

```
src
├── main
│   ├── java
│   │   └── com.example.attendancesystem
│   │       ├── controller
│   │       ├── service
│   │       ├── repository
│   │       ├── model
│   │       ├── dto
│   │       ├── security
│   │       ├── config
│   │       ├── exception
│   │       └── util
│   │
│   └── resources
│       ├── static
│       ├── templates
│       └── application.properties
```

---

## Database

Main entities include:

- Users
- Attendance Sessions
- Attendance Records
- Event Logs

---

## Security Audit

The system records security-related activities for later review.

Examples include:

- Login failures
- Multiple login attempts
- Outside-geofence attendance
- Expired QR usage
- Invalid QR submissions
- Attendance submissions

Records can be reviewed through the Security Audit Console.

---

## Future Improvements

- Email notifications
- Push notifications
- Multi-factor authentication
- Device trust management
- Admin analytics dashboard
- Attendance reports
- CSV/PDF exports
- Mobile application
- Docker deployment
- Cloud deployment
- Multi-university support

---

## Getting Started

### Clone the repository

```bash
git clone https://github.com/ItsKalfox/AttendanceShield.git
```

### Navigate into the project

```bash
cd AttendanceShield
```

### Configure MySQL

Create a database:

```sql
CREATE DATABASE attendance_system;
```

Update `application.properties`:

```properties
spring.datasource.url=jdbc:mysql://localhost:3306/attendance_system
spring.datasource.username=root
spring.datasource.password=YOUR_PASSWORD
```

### Run

```bash
mvn spring-boot:run
```

Open:

```
https://localhost:8443
```

---

## Screenshots

Coming soon.

---

## License

This project is developed for educational purposes.

---

## Author

Developed by **Kalfox**

Software Engineering Undergraduate