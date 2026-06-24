// API Base URL
const BASE_URL = window.location.origin;
let jwtToken = sessionStorage.getItem("jwt_token") || "";
let currentUser = null;
let activeSession = null;
let allSessions = [];
let checkinPollInterval = null;

// GPS Selection Center
let selectedLat = 6.9271;
let selectedLng = 79.8612;
let lecturerCurrentLat = null;
let lecturerCurrentLng = null;

// On Load
window.addEventListener('DOMContentLoaded', () => {
    // Check query params if they scanned the QR
    const urlParams = new URLSearchParams(window.location.search);
    const scanToken = urlParams.get('token');
    if (scanToken) {
        window.location.href = `/attendance.html?token=${scanToken}`;
        return;
    }

    if (jwtToken) {
        parseAndValidateToken();
    } else {
        window.location.href = "/login.html";
    }
});

// Set Auth Header
function getHeaders() {
    return {
        "Content-Type": "application/json",
        "Authorization": jwtToken ? `Bearer ${jwtToken}` : ""
    };
}

function showDashboard(role) {
    document.getElementById("header-user").classList.remove("hidden");
    const bottomNav = document.querySelector(".bottom-nav");
    if (bottomNav) bottomNav.classList.remove("hidden");

    document.getElementById("user-display-name").textContent = currentUser.fullName;

    // Show Students nav tab for ADMIN only
    const navStudents = document.getElementById("nav-students");
    if (navStudents) {
        if (role === 'ADMIN') {
            navStudents.classList.remove("hidden");
        } else {
            navStudents.classList.add("hidden");
        }
    }

    // Switch to Generate tab by default on sign-in
    switchTab('generate');
    initDateTimeFields();
    acquireLecturerLocation();
}

// Navigation Switch tabs
function switchTab(tabId) {
    if (!jwtToken) return;

    document.querySelectorAll(".tab-content").forEach(el => el.classList.remove("active"));
    const targetTab = document.getElementById(`tab-${tabId}`);
    if (targetTab) targetTab.classList.add("active");

    document.querySelectorAll(".nav-item").forEach(item => item.classList.remove("active"));

    // Map tabId to correct nav button (IDs are deterministic now)
    const navIdMap = { sessions: 'nav-sessions', generate: 'nav-generate', logs: 'nav-logs', students: 'nav-students' };
    const navEl = document.getElementById(navIdMap[tabId]);
    if (navEl) navEl.classList.add("active");

    if (tabId === 'sessions') {
        loadSessions();
    } else if (tabId === 'logs') {
        loadSessions().then(() => {
            loadAuditLogs();
        });
    } else if (tabId === 'students') {
        loadStudents();
    }
}

// top sub-tabs toggling
function switchSubTab(subTabId) {
    document.querySelectorAll(".sub-tab-item").forEach(el => el.classList.remove("active"));
    const subTabBtn = document.getElementById(`subtab-${subTabId}-btn`);
    if (subTabBtn) subTabBtn.classList.add("active");

    if (subTabId === 'active') {
        document.getElementById("subtab-active-content").classList.remove("hidden");
        document.getElementById("subtab-past-content").classList.add("hidden");
    } else {
        document.getElementById("subtab-active-content").classList.add("hidden");
        document.getElementById("subtab-past-content").classList.remove("hidden");
    }
    renderSessionLists();
}

// Parse JWT
function parseAndValidateToken() {
    try {
        const base64Url = jwtToken.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(window.atob(base64).split('').map(c => {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));

        const claims = JSON.parse(jsonPayload);

        // Expiry Check
        if (claims.exp * 1000 < Date.now()) {
            showToast("Session expired, please login again", "error");
            logout();
            return;
        }

        if (claims.role === 'STUDENT') {
            logout();
            return;
        }

        currentUser = {
            userId: claims.userId,
            email: claims.sub,
            role: claims.role,
            fullName: claims.role === 'LECTURER' ? 'Dr. Jane Smith' : claims.role === 'ADMIN' ? 'System Admin' : 'John Doe'
        };

        showDashboard(claims.role);
    } catch (e) {
        logout();
    }
}

// Logout
function logout() {
    sessionStorage.removeItem("jwt_token");
    jwtToken = "";
    currentUser = null;
    activeSession = null;
    allSessions = [];
    if (checkinPollInterval) clearInterval(checkinPollInterval);
    window.location.href = "/login.html";
}

// Toast Messages
function showToast(message, type = "success") {
    const toast = document.getElementById("notification-toast");
    if (!toast) return;
    toast.className = `notification show notification-${type}`;
    const toastMsg = document.getElementById("toast-message");
    if (toastMsg) toastMsg.textContent = message;

    setTimeout(() => {
        toast.classList.remove("show");
    }, 3000);
}

// Lecturer GPS handling
function acquireLecturerLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                lecturerCurrentLat = position.coords.latitude;
                lecturerCurrentLng = position.coords.longitude;

                const useCurrentLoc = document.getElementById("session-use-current-loc");
                if (useCurrentLoc && useCurrentLoc.checked) {
                    selectedLat = lecturerCurrentLat;
                    selectedLng = lecturerCurrentLng;
                }
            },
            (error) => {
                console.warn("Could not acquire lecturer GPS:", error.message);
            }
        );
    }
}

let lecturerMap = null;
let lecturerMarker = null;

function toggleLecturerMap(useCurrent) {
    const overlay = document.getElementById("map-disabled-overlay");
    if (useCurrent) {
        if (overlay) overlay.classList.remove("hidden");
        if (lecturerCurrentLat !== null) {
            selectedLat = lecturerCurrentLat;
            selectedLng = lecturerCurrentLng;
            if (lecturerMarker) {
                lecturerMarker.setLatLng([selectedLat, selectedLng]);
                lecturerMap.setView([selectedLat, selectedLng], 15);
            }
        } else {
            acquireLecturerLocation();
        }
    } else {
        if (overlay) overlay.classList.add("hidden");
        initLecturerMap();
    }
}

function initLecturerMap() {
    setTimeout(() => {
        if (!lecturerMap) {
            const mapEl = document.getElementById('lecturer-map');
            if (!mapEl) return;
            lecturerMap = L.map('lecturer-map').setView([selectedLat, selectedLng], 15);

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            }).addTo(lecturerMap);

            lecturerMarker = L.marker([selectedLat, selectedLng], { draggable: true }).addTo(lecturerMap);

            lecturerMarker.on('moveend', (e) => {
                const latLng = e.target.getLatLng();
                selectedLat = latLng.lat;
                selectedLng = latLng.lng;
            });

            lecturerMap.on('click', (e) => {
                lecturerMarker.setLatLng(e.latlng);
                selectedLat = e.latlng.lat;
                selectedLng = e.latlng.lng;
            });
        } else {
            lecturerMap.setView([selectedLat, selectedLng], 15);
            lecturerMarker.setLatLng([selectedLat, selectedLng]);
            lecturerMap.invalidateSize();
        }
    }, 150);
}

function relocateCurrentLocation() {
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                lecturerCurrentLat = position.coords.latitude;
                lecturerCurrentLng = position.coords.longitude;
                selectedLat = lecturerCurrentLat;
                selectedLng = lecturerCurrentLng;
                if (lecturerMap && lecturerMarker) {
                    lecturerMarker.setLatLng([selectedLat, selectedLng]);
                    lecturerMap.setView([selectedLat, selectedLng], 15);
                }
                showToast("Map centered on your current location", "success");
            },
            (error) => {
                showToast("Error getting location: " + error.message, "error");
            }
        );
    } else {
        showToast("Geolocation is not supported by this browser.", "error");
    }
}

function recalibrateLecturerLocation() {
    const btn = document.getElementById("btn-lecturer-gps");
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = "Acquiring Coordinates...";

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                lecturerCurrentLat = position.coords.latitude;
                lecturerCurrentLng = position.coords.longitude;

                const useCurrentLoc = document.getElementById("session-use-current-loc");
                if (useCurrentLoc && useCurrentLoc.checked) {
                    selectedLat = lecturerCurrentLat;
                    selectedLng = lecturerCurrentLng;
                    if (lecturerMap && lecturerMarker) {
                        lecturerMarker.setLatLng([selectedLat, selectedLng]);
                        lecturerMap.setView([selectedLat, selectedLng], 15);
                    }
                }

                btn.disabled = false;
                btn.textContent = "🔄 Recalibrate GPS Location";
                showToast("Lecturer GPS recalibrated successfully", "success");
            },
            (error) => {
                btn.disabled = false;
                btn.textContent = "🔄 Recalibrate GPS Location";
                let friendlyError = `Access Denied: ${error.message}`;
                if (error.code === 1) { // PERMISSION_DENIED
                    friendlyError = "Permission Denied. Please enable location services in your browser settings.";
                }
                showToast(friendlyError, "error");
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
    } else {
        btn.disabled = false;
        btn.textContent = "🔄 Recalibrate GPS Location";
        showToast("Geolocation is not supported by this browser.", "error");
    }
}

// Toggle Geofencing inputs
function toggleGeofenceFields(enabled) {
    const fields = document.getElementById("geofence-fields");
    if (!fields) return;
    if (enabled) {
        fields.classList.remove("hidden");
        const useCurrentLoc = document.getElementById("session-use-current-loc");
        const useCurrent = useCurrentLoc ? useCurrentLoc.checked : false;
        toggleLecturerMap(useCurrent);
    } else {
        fields.classList.add("hidden");
    }
}

// Toggle QR Time inputs
function toggleQrTimeFields(enabled) {
    const fields = document.getElementById("qr-time-fields");
    if (!fields) return;
    if (enabled) {
        fields.classList.add("hidden");
    } else {
        fields.classList.remove("hidden");
    }
}

function initDateTimeFields() {
    const now = new Date();
    const startStr = formatLocalDateTime(now);
    const endStr = formatLocalDateTime(new Date(now.getTime() + 60 * 60 * 1000)); // +1 hour

    const lecStart = document.getElementById("lecture-start");
    const lecEnd = document.getElementById("lecture-end");
    const qrStart = document.getElementById("qr-start");
    const qrEnd = document.getElementById("qr-end");

    if (lecStart) lecStart.value = startStr;
    if (lecEnd) lecEnd.value = endStr;
    if (qrStart) qrStart.value = startStr;
    if (qrEnd) qrEnd.value = endStr;
}

function formatLocalDateTime(date) {
    const offset = date.getTimezoneOffset();
    const adjustedDate = new Date(date.getTime() - (offset * 60 * 1000));
    return adjustedDate.toISOString().slice(0, 16);
}

// Create Session Form Handler
const createSessionForm = document.getElementById("create-session-form");
if (createSessionForm) {
    createSessionForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const moduleCode = document.getElementById("session-module-code").value;
        const moduleName = document.getElementById("session-module-name").value;
        const lectureTopic = document.getElementById("session-topic").value;
        const expectedStudents = parseInt(document.getElementById("session-expected").value);
        const allowOutside = !document.getElementById("session-geofence").checked;

        const lectureStartTime = document.getElementById("lecture-start").value;
        const lectureEndTime = document.getElementById("lecture-end").value;
        const useSameForQr = document.getElementById("session-same-for-qr").checked;

        let qrActiveFrom = null;
        let qrExpiresAt = null;

        if (!useSameForQr) {
            qrActiveFrom = document.getElementById("qr-start").value;
            qrExpiresAt = document.getElementById("qr-end").value;
        }

        const payload = {
            moduleCode,
            moduleName,
            lectureTopic,
            expectedStudents,
            lectureStartTime: lectureStartTime ? lectureStartTime + ":00" : null,
            lectureEndTime: lectureEndTime ? lectureEndTime + ":00" : null,
            useSameForQr,
            qrActiveFrom: qrActiveFrom ? qrActiveFrom + ":00" : null,
            qrExpiresAt: qrExpiresAt ? qrExpiresAt + ":00" : null,
            allowOutsideLocation: allowOutside,
            centerLat: allowOutside ? null : selectedLat,
            centerLng: allowOutside ? null : selectedLng,
            radiusMeters: allowOutside ? null : parseFloat(document.getElementById("session-radius").value)
        };

        try {
            const res = await fetch(`${BASE_URL}/api/session/create`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const error = await res.json();
                throw new Error(error.message || "Failed to create session");
            }

            const data = await res.json();
            showToast("Attendance session created", "success");
            openQrModal(data);
            loadSessions();

        } catch (err) {
            showToast(err.message, "error");
        }
    });
}

// Get Sessions
async function loadSessions() {
    try {
        const res = await fetch(`${BASE_URL}/api/session/all`, {
            headers: getHeaders()
        });

        if (!res.ok) throw new Error("Failed to fetch sessions");

        allSessions = await res.json();
        renderSessionLists();

        const currentActive = allSessions.find(s => s.status === 'ACTIVE');
        if (currentActive) {
            activeSession = currentActive;
            startActivePoll();
        } else {
            activeSession = null;
            if (checkinPollInterval) clearInterval(checkinPollInterval);
        }

    } catch (err) {
        console.error(err);
    }
}

// Render lists of sessions in the top sub-tabs
function renderSessionLists() {
    const activeList = document.getElementById("active-sessions-list");
    const pastList = document.getElementById("past-sessions-list");

    if (!activeList || !pastList) return;

    activeList.innerHTML = "";
    pastList.innerHTML = "";

    const activeItems = allSessions.filter(s => s.status === 'ACTIVE' || s.status === 'SCHEDULED');
    const pastItems = allSessions.filter(s => s.status === 'ENDED');

    if (activeItems.length === 0) {
        activeList.innerHTML = `<p style="text-align:center; padding: 2rem; color: var(--text-secondary); font-size:0.85rem;">No active or scheduled sessions found.</p>`;
    } else {
        activeItems.forEach(s => {
            const card = document.createElement("div");
            card.className = "session-card";
            card.innerHTML = `
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <h4>${s.moduleCode} - ${s.moduleName}</h4>
                    <span class="badge badge-status-${s.status.toLowerCase()}">${s.status}</span>
                </div>
                <p>Topic: ${s.lectureTopic}</p>
                <div class="session-time" style="margin-bottom:0.75rem;">Active from: ${new Date(s.qrActiveFrom).toLocaleTimeString()} to ${new Date(s.qrExpiresAt).toLocaleTimeString()}</div>
                <div style="display:flex; gap:0.5rem;">
                    <button class="btn btn-secondary btn-view-qr" style="flex:1; padding:0.4rem; font-size:0.75rem; border-radius:0.375rem;">View QR</button>
                    <button class="btn btn-primary btn-view-attendance" style="flex:1; padding:0.4rem; font-size:0.75rem; border-radius:0.375rem; background:var(--color-success); box-shadow:none;">View Attendance</button>
                </div>
            `;
            card.querySelector(".btn-view-qr").onclick = (e) => {
                e.stopPropagation();
                openQrModal(s);
            };
            card.querySelector(".btn-view-attendance").onclick = (e) => {
                e.stopPropagation();
                openDetailModal(s);
            };
            activeList.appendChild(card);
        });
    }

    if (pastItems.length === 0) {
        pastList.innerHTML = `<p style="text-align:center; padding: 2rem; color: var(--text-secondary); font-size:0.85rem;">No past sessions found.</p>`;
    } else {
        pastItems.forEach(s => {
            const card = document.createElement("div");
            card.className = "session-card";
            card.onclick = () => openDetailModal(s);
            card.innerHTML = `
                <h4>${s.moduleCode} - ${s.moduleName}</h4>
                <p>Topic: ${s.lectureTopic}</p>
                <div class="session-time" style="color:var(--text-secondary);">Ended on: ${new Date(s.lectureEndTime).toLocaleDateString()} at ${new Date(s.lectureEndTime).toLocaleTimeString()}</div>
            `;
            pastList.appendChild(card);
        });
    }
}

// Active Poll
function startActivePoll() {
    if (checkinPollInterval) clearInterval(checkinPollInterval);
    checkinPollInterval = setInterval(() => {
        loadAuditLogs();
        if (currentDetailSession && activeSession && currentDetailSession.sessionId === activeSession.sessionId) {
            loadSessionRecords(currentDetailSession.sessionId);
        }
    }, 5000);
}

// QR Code Modal operations
function openQrModal(session) {
    const titleEl = document.getElementById("modal-qr-title");
    if (titleEl) titleEl.textContent = `${session.moduleCode} - Active Session`;

    const targetUrl = `${window.location.origin}/attendance.html?token=${session.qrToken}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(targetUrl)}`;

    const qrImg = document.getElementById("qr-code-img");
    if (qrImg) qrImg.src = qrApiUrl;
    const qrLink = document.getElementById("qr-link-href");
    if (qrLink) qrLink.textContent = targetUrl;

    const printBtn = document.getElementById("btn-modal-print");
    if (printBtn) printBtn.onclick = () => printQrPDF(session);

    // End session button inside modal
    const endBtn = document.getElementById("btn-modal-end");
    if (endBtn) {
        endBtn.onclick = async () => {
            if (confirm("End session? Student check-ins will stop.")) {
                try {
                    const res = await fetch(`${BASE_URL}/api/session/${session.sessionId}`, {
                        method: "DELETE",
                        headers: getHeaders()
                    });

                    if (res.ok) {
                        showToast("Session ended", "success");
                        closeQrModal();
                        loadSessions();
                    } else {
                        throw new Error("Failed to delete session");
                    }
                } catch (e) {
                    showToast(e.message, "error");
                }
            }
        };
    }

    const qrModal = document.getElementById("qr-modal");
    if (qrModal) qrModal.classList.remove("hidden");
}

function closeQrModal() {
    const qrModal = document.getElementById("qr-modal");
    if (qrModal) qrModal.classList.add("hidden");
}

// Print PDF helper using browser printing window
function printQrPDF(session) {
    const printWindow = window.open("", "_blank");
    const targetUrl = `${window.location.origin}/attendance.html?token=${session.qrToken}`;
    const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(targetUrl)}`;

    printWindow.document.write(`
        <html>
        <head>
            <title>Attendance QR Code - ${session.moduleCode}</title>
            <style>
                body {
                    font-family: 'Inter', sans-serif;
                    text-align: center;
                    padding: 3rem;
                    color: #000;
                }
                .container {
                    border: 2px solid #000;
                    border-radius: 1rem;
                    padding: 3rem;
                    max-width: 500px;
                    margin: auto;
                }
                h1 { font-size: 2rem; margin-bottom: 0.5rem; }
                h2 { font-size: 1.25rem; font-weight: normal; margin-bottom: 1.5rem; color: #555; }
                .qr-img { width: 300px; height: 300px; margin: 2rem 0; }
                .link { font-family: monospace; font-size: 0.9rem; color: #000; word-break: break-all; margin-top: 1rem; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>${session.moduleCode} - ${session.moduleName}</h1>
                <h2>Topic: ${session.lectureTopic}</h2>
                <p>Lecture Start: ${new Date(session.lectureStartTime).toLocaleString()}</p>
                <img class="qr-img" src="${qrApiUrl}" alt="QR code" />
                <div class="link">${targetUrl}</div>
            </div>
            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 500);
                }
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// Past Session Details Modal operations
let currentDetailSession = null;
let currentSessionRecords = [];

async function openDetailModal(session) {
    currentDetailSession = session;
    const detailTitle = document.getElementById("modal-detail-title");
    if (detailTitle) detailTitle.textContent = `${session.moduleCode} - Statistics`;
    const detailTopic = document.getElementById("modal-detail-topic");
    if (detailTopic) detailTopic.textContent = `Topic: ${session.lectureTopic}`;

    // Add listener to flag checkbox
    const flagCheckbox = document.getElementById("checkbox-show-low-med");
    if (flagCheckbox) {
        flagCheckbox.checked = false;
        flagCheckbox.onclick = () => renderAttendeeList();
    }

    await loadSessionRecords(session.sessionId);
    const detailModal = document.getElementById("detail-modal");
    if (detailModal) detailModal.classList.remove("hidden");
}

function closeDetailModal() {
    const detailModal = document.getElementById("detail-modal");
    if (detailModal) detailModal.classList.add("hidden");
    currentDetailSession = null;
    currentSessionRecords = [];
}

async function loadSessionRecords(sessionId) {
    try {
        const res = await fetch(`${BASE_URL}/api/attendance/session/${sessionId}`, {
            headers: getHeaders()
        });

        if (!res.ok) return;

        currentSessionRecords = await res.json();

        // Draw chart & attendee cards
        renderDetailChart();
        renderAttendeeList();

    } catch (err) {
        console.error(err);
    }
}

function renderDetailChart() {
    const expected = currentDetailSession.expectedStudents || 1;
    const attended = currentSessionRecords.filter(r => r.status === 'PRESENT' || r.status === 'LATE').length;

    const attendedEl = document.getElementById("attended-count");
    if (attendedEl) attendedEl.textContent = attended;
    const expectedEl = document.getElementById("expected-count");
    if (expectedEl) expectedEl.textContent = expected;

    const percent = Math.min(100, Math.round((attended / expected) * 100));
    const percentEl = document.getElementById("attendance-percent");
    if (percentEl) percentEl.textContent = `${percent}%`;

    // SVG circle dashoffset
    // Circumference of circle r=55 is 2 * PI * 55 = 345.5
    const offset = 345.5 - (345.5 * percent) / 100;
    const circle = document.getElementById("attendance-chart");
    if (circle) circle.style.strokeDashoffset = offset;
}

function renderAttendeeList() {
    const container = document.getElementById("attendees-list-box");
    if (!container) return;
    container.innerHTML = "";

    if (currentSessionRecords.length === 0) {
        container.innerHTML = `<p style="text-align:center; font-size:0.8rem; color:var(--text-secondary); padding: 1rem 0;">No attendees recorded.</p>`;
        return;
    }

    const flagCheckbox = document.getElementById("checkbox-show-low-med");
    const showLowMed = flagCheckbox ? flagCheckbox.checked : false;

    currentSessionRecords.forEach(r => {
        // Determine if we show flag icon
        let showFlag = false;
        if (r.flagLevel === 'HIGH') {
            showFlag = true;
        } else if ((r.flagLevel === 'MEDIUM' || r.flagLevel === 'LOW') && showLowMed) {
            showFlag = true;
        }

        const card = document.createElement("div");
        card.className = "attendee-card";
        card.innerHTML = `
            <div class="attendee-main">
                <div>
                    <div class="attendee-name">${r.studentName}</div>
                    <div class="attendee-id">ID: ${r.studentId} | status: ${r.status}</div>
                </div>
                ${showFlag ? `<span class="flag-icon" onclick="toggleFlagReason(this)">🚩</span>` : ''}
            </div>
            ${showFlag ? `
                <div class="flag-reason-box hidden">
                    <strong>Flag Level: ${r.flagLevel}</strong><br>
                    Reason: ${r.flagReason || 'Generic security flag'}
                </div>
            ` : ''}
        `;
        container.appendChild(card);
    });
}

function toggleFlagReason(iconElement) {
    const reasonBox = iconElement.closest(".attendee-card").querySelector(".flag-reason-box");
    if (reasonBox) {
        reasonBox.classList.toggle("hidden");
    }
}

let allLoadedLogs = [];

// Get Audit Logs
async function loadAuditLogs() {
    const sessionId = activeSession ? activeSession.sessionId : (allSessions.length > 0 ? allSessions[0].sessionId : null);
    if (!sessionId) return;

    try {
        const res = await fetch(`${BASE_URL}/api/events/session/${sessionId}`, {
            headers: getHeaders()
        });

        if (!res.ok) return;

        allLoadedLogs = await res.json();
        filterLogs();

    } catch (e) {
        console.error(e);
    }
}

function filterLogs() {
    const filterEl = document.getElementById("log-filter");
    if (!filterEl) return;
    const filterVal = filterEl.value;
    const consoleBox = document.getElementById("console-box");
    if (!consoleBox) return;
    consoleBox.innerHTML = "";

    const filtered = filterVal === "ALL" ? allLoadedLogs : allLoadedLogs.filter(l => l.eventType === filterVal);

    if (filtered.length === 0) {
        consoleBox.innerHTML = `<div class="console-line"><span class="console-time">[--:--:--]</span><span class="console-type sys">SYSTEM</span><span class="console-msg">No event logs captured matching the selected filter.</span></div>`;
        return;
    }

    filtered.forEach(l => {
        const date = new Date(l.timestamp);
        const timeStr = date.toLocaleTimeString();

        let typeClass = "sys";
        const et = l.eventType || "";
        if (et === "LOGIN_SUCCESS") typeClass = "success";
        else if (et === "LOGIN_FAILED") typeClass = "failed";
        else if (et === "LOGIN_ATTEMPT") typeClass = "attempt";
        else if (et === "ATTENDANCE_SUBMITTED") typeClass = "submit";
        else if (et === "QR_GENERATED" || et === "QR_OPENED") typeClass = "qr";

        const div = document.createElement("div");
        div.className = "console-line";
        div.innerHTML = `
            <span class="console-time">[${timeStr}]</span>
            <span class="console-type ${typeClass}">${l.eventType}</span>
            <span class="console-msg">
                User: ${l.userEmail || 'Anonymous'} | IP: ${l.ipAddress} | Info: ${l.extraData || 'None'}
            </span>
        `;
        consoleBox.appendChild(div);
    });
}

// Close modal when clicking outside modal-content
window.onclick = function (event) {
    const qrModal = document.getElementById("qr-modal");
    const detailModal = document.getElementById("detail-modal");
    const addStudentModal = document.getElementById("add-student-modal");
    const studentDetailModal = document.getElementById("student-detail-modal");
    if (event.target === qrModal) closeQrModal();
    if (event.target === detailModal) closeDetailModal();
    if (event.target === addStudentModal) closeAddStudentModal();
    if (event.target === studentDetailModal) closeStudentDetailModal();
}

// ─── STUDENT MANAGEMENT ────────────────────────────────────────────

let allStudents = [];
let selectedStudent = null;

async function loadStudents() {
    try {
        const res = await fetch(`${BASE_URL}/api/students`, { headers: getHeaders() });
        if (!res.ok) return;
        allStudents = await res.json();
        renderStudentCards(allStudents);
    } catch (e) {
        console.error("[Students] Load error:", e);
    }
}

function renderStudentCards(students) {
    const grid = document.getElementById("student-cards-grid");
    if (!grid) return;
    grid.innerHTML = "";
    if (students.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:2rem;">No students found.</div>`;
        return;
    }
    students.forEach(s => {
        const card = document.createElement("div");
        card.className = "attendee-card";
        card.style.cssText = "cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;";
        card.onmouseenter = () => { card.style.transform = "translateY(-2px)"; card.style.boxShadow = "0 8px 24px rgba(59,130,246,0.2)"; };
        card.onmouseleave = () => { card.style.transform = ""; card.style.boxShadow = ""; };
        card.onclick = () => openStudentDetailModal(s);
        card.innerHTML = `
            <div style="display:flex;align-items:center;gap:0.75rem;">
                <div style="width:2.5rem;height:2.5rem;border-radius:50%;background:linear-gradient(135deg,#3b82f6,#8b5cf6);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0;">
                    ${(s.fullName || "?")[0].toUpperCase()}
                </div>
                <div style="overflow:hidden;">
                    <div style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${s.fullName}</div>
                    <div style="font-size:0.75rem;color:var(--text-secondary);font-family:monospace;">${s.studentId || "—"}</div>
                </div>
            </div>`;
        grid.appendChild(card);
    });
}

function filterStudentCards() {
    const searchEl = document.getElementById("student-search");
    if (!searchEl) return;
    const q = searchEl.value.toLowerCase().trim();
    const filtered = q
        ? allStudents.filter(s =>
            (s.fullName || "").toLowerCase().includes(q) ||
            (s.studentId || "").toLowerCase().includes(q))
        : allStudents;
    renderStudentCards(filtered);
}

// ── Add Student Modal ──
function openAddStudentModal() {
    const addForm = document.getElementById("add-student-form");
    if (addForm) addForm.reset();
    const errorEl = document.getElementById("add-student-error");
    if (errorEl) errorEl.classList.add("hidden");
    const btn = document.getElementById("add-student-submit-btn");
    if (btn) btn.disabled = false;
    const addModal = document.getElementById("add-student-modal");
    if (addModal) addModal.classList.remove("hidden");
}

function closeAddStudentModal() {
    const addModal = document.getElementById("add-student-modal");
    if (addModal) addModal.classList.add("hidden");
}

const addStudentForm = document.getElementById("add-student-form");
if (addStudentForm) {
    addStudentForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errorBox = document.getElementById("add-student-error");
        if (errorBox) errorBox.classList.add("hidden");
        const btn = document.getElementById("add-student-submit-btn");
        if (btn) {
            btn.disabled = true;
            btn.textContent = "Creating…";
        }

        const payload = {
            studentId: document.getElementById("add-student-id").value.trim(),
            fullName:  document.getElementById("add-student-name").value.trim(),
            email:     document.getElementById("add-student-email").value.trim()
        };

        try {
            const res = await fetch(`${BASE_URL}/api/students`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                let msg = `Error (HTTP ${res.status})`;
                try { const b = await res.json(); msg = b.message || msg; } catch(_) {}
                throw new Error(msg);
            }
            closeAddStudentModal();
            showToast("Student created — password sent by email", "success");
            await loadStudents();
        } catch (err) {
            console.error("[AddStudent]", err);
            if (errorBox) {
                errorBox.textContent = err.message;
                errorBox.classList.remove("hidden");
            }
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.textContent = "Create & Send Password";
            }
        }
    });
}

// ── Student Detail Modal ──
function openStudentDetailModal(student) {
    selectedStudent = student;
    const heading = document.getElementById("detail-student-heading");
    if (heading) heading.textContent = student.fullName;
    const idEl = document.getElementById("view-student-id");
    if (idEl) idEl.textContent = student.studentId || "—";
    const nameEl = document.getElementById("view-student-name");
    if (nameEl) nameEl.textContent = student.fullName;
    const emailEl = document.getElementById("view-student-email");
    if (emailEl) emailEl.textContent = student.email;

    const viewMode = document.getElementById("student-view-mode");
    if (viewMode) viewMode.classList.remove("hidden");
    const editMode = document.getElementById("student-edit-mode");
    if (editMode) editMode.classList.add("hidden");
    const detailModal = document.getElementById("student-detail-modal");
    if (detailModal) detailModal.classList.remove("hidden");
}

function closeStudentDetailModal() {
    const detailModal = document.getElementById("student-detail-modal");
    if (detailModal) detailModal.classList.add("hidden");
    selectedStudent = null;
}

function enterEditMode() {
    const idInput = document.getElementById("edit-student-id");
    if (idInput) idInput.value = selectedStudent.studentId || "";
    const nameInput = document.getElementById("edit-student-name");
    if (nameInput) nameInput.value = selectedStudent.fullName;
    const emailInput = document.getElementById("edit-student-email");
    if (emailInput) emailInput.value = selectedStudent.email;

    const errorEl = document.getElementById("edit-student-error");
    if (errorEl) errorEl.classList.add("hidden");
    const viewMode = document.getElementById("student-view-mode");
    if (viewMode) viewMode.classList.add("hidden");
    const editMode = document.getElementById("student-edit-mode");
    if (editMode) editMode.classList.remove("hidden");
}

function exitEditMode() {
    const viewMode = document.getElementById("student-view-mode");
    if (viewMode) viewMode.classList.remove("hidden");
    const editMode = document.getElementById("student-edit-mode");
    if (editMode) editMode.classList.add("hidden");
}

const editStudentForm = document.getElementById("edit-student-form");
if (editStudentForm) {
    editStudentForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errorBox = document.getElementById("edit-student-error");
        if (errorBox) errorBox.classList.add("hidden");

        const payload = {
            studentId: document.getElementById("edit-student-id").value.trim(),
            fullName:  document.getElementById("edit-student-name").value.trim(),
            email:     document.getElementById("edit-student-email").value.trim()
        };

        try {
            const res = await fetch(`${BASE_URL}/api/students/${selectedStudent.userId}`, {
                method: "PUT",
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                let msg = `Error (HTTP ${res.status})`;
                try { const b = await res.json(); msg = b.message || msg; } catch(_) {}
                throw new Error(msg);
            }
            const updated = await res.json();
            selectedStudent = updated;
            closeStudentDetailModal();
            showToast("Student record updated", "success");
            await loadStudents();
        } catch (err) {
            console.error("[EditStudent]", err);
            if (errorBox) {
                errorBox.textContent = err.message;
                errorBox.classList.remove("hidden");
            }
        }
    });
}

async function deleteStudent() {
    if (!selectedStudent) return;
    if (!confirm(`Delete student "${selectedStudent.fullName}"? This cannot be undone.`)) return;

    try {
        const res = await fetch(`${BASE_URL}/api/students/${selectedStudent.userId}`, {
            method: "DELETE",
            headers: getHeaders()
        });
        if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
        closeStudentDetailModal();
        showToast("Student deleted", "success");
        await loadStudents();
    } catch (err) {
        console.error("[DeleteStudent]", err);
        showToast(err.message, "error");
    }
}

async function resetStudentPassword() {
    if (!selectedStudent) return;
    const btn = document.getElementById("btn-reset-password");
    if (btn) {
        btn.disabled = true;
        btn.textContent = "Sending…";
    }

    try {
        const res = await fetch(`${BASE_URL}/api/students/${selectedStudent.userId}/reset-password`, {
            method: "POST",
            headers: getHeaders()
        });
        if (!res.ok) throw new Error(`Reset failed (HTTP ${res.status})`);
        showToast("New password sent to student's email", "success");
        closeStudentDetailModal();
    } catch (err) {
        console.error("[ResetPassword]", err);
        showToast(err.message, "error");
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.textContent = "🔑 Reset Password";
        }
    }
}
