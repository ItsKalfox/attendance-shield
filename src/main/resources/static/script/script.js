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
        const isLecturerActive = document.getElementById("subtab-lecturer-btn") && document.getElementById("subtab-lecturer-btn").classList.contains("active");
        if (isLecturerActive) {
            loadLecturers();
        } else {
            loadStudents();
        }
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
            logout(true);
            return;
        }

        if (claims.role === 'STUDENT') {
            logout(true);
            return;
        }

        currentUser = {
            userId: claims.userId,
            email: claims.sub,
            role: claims.role,
            fullName: claims.fullName || (claims.role === 'LECTURER' ? 'Lecturer' : claims.role === 'ADMIN' ? 'System Admin' : 'John Doe')
        };

        showDashboard(claims.role);
    } catch (e) {
        logout(true);
    }
}

// Logout
function logout(force = false) {
    if (force) {
        performLogout();
        return;
    }
    showConfirmModal({
        variant: 'danger',
        title: 'Logout?',
        body: 'Are you sure you want to log out?',
        confirmLabel: 'Yes, Logout',
        onConfirm: (closeModal) => {
            closeModal();
            performLogout();
        }
    });
}

function performLogout() {
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
                selectedLat = lecturerCurrentLat;
                selectedLng = lecturerCurrentLng;

                if (lecturerMap && lecturerMarker) {
                    lecturerMarker.setLatLng([selectedLat, selectedLng]);
                    lecturerMap.setView([selectedLat, selectedLng], 15);
                }

                btn.disabled = false;
                btn.textContent = "Recalibrate GPS Location";
                showToast("Lecturer GPS recalibrated successfully", "success");
            },
            (error) => {
                btn.disabled = false;
                btn.textContent = "Recalibrate GPS Location";
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
        btn.textContent = "Recalibrate GPS Location";
        showToast("Geolocation is not supported by this browser.", "error");
    }
}

// Toggle Geofencing inputs
function toggleGeofenceFields(enabled) {
    const fields = document.getElementById("geofence-fields");
    if (!fields) return;

    if (enabled) {
        fields.classList.remove("hidden");

        // Show the fields immediately, then acquire GPS before rendering the map
        const gpsBtn = document.getElementById("btn-lecturer-gps");
        if (gpsBtn) {
            gpsBtn.disabled = true;
            gpsBtn.textContent = "Locating...";
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    // Update coordinates with fresh GPS fix
                    lecturerCurrentLat = position.coords.latitude;
                    lecturerCurrentLng = position.coords.longitude;
                    selectedLat = lecturerCurrentLat;
                    selectedLng = lecturerCurrentLng;

                    // Re-enable button
                    if (gpsBtn) {
                        gpsBtn.disabled = false;
                        gpsBtn.textContent = "Recalibrate GPS Location";
                    }

                    // Init or reposition map at the real location
                    initLecturerMap();
                },
                (error) => {
                    // Geolocation failed — still show map at last known/default position
                    if (gpsBtn) {
                        gpsBtn.disabled = false;
                        gpsBtn.textContent = "Recalibrate GPS Location";
                    }
                    const msg = error.code === 1
                        ? "Location permission denied. Map shown at default position."
                        : "Could not get location. Map shown at default position.";
                    showToast(msg, "error");
                    initLecturerMap();
                },
                { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
            );
        } else {
            // No geolocation support
            if (gpsBtn) {
                gpsBtn.disabled = false;
                gpsBtn.textContent = "Recalibrate GPS Location";
            }
            showToast("Geolocation is not supported by this browser.", "error");
            initLecturerMap();
        }
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

        const btn = createSessionForm.querySelector("button[type='submit']");
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="btn-loader"><span></span><span></span><span></span></div>';
        }

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
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = "Generate Attendance QR";
            }
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

    // End session button inside modal — opens universal confirm modal
    const endBtn = document.getElementById("btn-modal-end");

    if (endBtn) {
        endBtn.disabled = false;
        endBtn.innerHTML = "Delete Session";

        // Clone to clear previous listeners
        const newEndBtn = endBtn.cloneNode(true);
        endBtn.parentNode.replaceChild(newEndBtn, endBtn);

        newEndBtn.onclick = () => {
            showConfirmModal({
                variant: 'danger',
                title: 'Delete Session?',
                body: 'This session and all its attendance records will be permanently removed. This action cannot be undone.',
                confirmLabel: 'Yes, Delete',
                onConfirm: async (closeModal) => {
                    try {
                        const res = await fetch(`${BASE_URL}/api/session/${session.sessionId}`, {
                            method: "DELETE",
                            headers: getHeaders()
                        });

                        if (res.ok) {
                            closeModal();
                            showToast("Session deleted successfully", "success");
                            closeQrModal();
                            loadSessions();
                        } else {
                            const errBody = await res.json().catch(() => ({}));
                            throw new Error(errBody.message || `Failed to delete session (HTTP ${res.status})`);
                        }
                    } catch (e) {
                        closeModal();
                        showToast(e.message, "error");
                    }
                }
            });
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
    if (detailTitle) detailTitle.textContent = `${session.moduleName}`;
    const detailTopic = document.getElementById("modal-detail-topic");
    if (detailTopic) detailTopic.textContent = `Topic: ${session.lectureTopic}`;

    // Reset all settings to default on each open
    const highFlagCheckbox = document.getElementById("checkbox-allow-high-flag");
    if (highFlagCheckbox) highFlagCheckbox.checked = false;
    const flagCheckbox = document.getElementById("checkbox-show-low-med");
    if (flagCheckbox) flagCheckbox.checked = false;
    const settingsPanel = document.getElementById("detail-settings-panel");
    if (settingsPanel) settingsPanel.classList.add("hidden");

    // Manage Delete Session button visibility and behavior (Admin only)
    const deleteBtn = document.getElementById("btn-detail-delete");
    if (deleteBtn) {
        if (currentUser && currentUser.role === 'ADMIN') {
            deleteBtn.classList.remove("hidden");
            deleteBtn.onclick = () => {
                showConfirmModal({
                    variant: 'danger',
                    title: 'Delete Session?',
                    body: 'This session and all its attendance records will be permanently removed. This action cannot be undone.',
                    confirmLabel: 'Yes, Delete',
                    onConfirm: async (closeModal) => {
                        try {
                            const res = await fetch(`${BASE_URL}/api/session/${session.sessionId}`, {
                                method: "DELETE",
                                headers: getHeaders()
                            });

                            if (res.ok) {
                                closeModal();
                                showToast("Session deleted successfully", "success");
                                closeDetailModal();
                                loadSessions();
                            } else {
                                const errBody = await res.json().catch(() => ({}));
                                throw new Error(errBody.message || `Failed to delete session (HTTP ${res.status})`);
                            }
                        } catch (e) {
                            closeModal();
                            showToast(e.message, "error");
                        }
                    }
                });
            };
        } else {
            deleteBtn.classList.add("hidden");
        }
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
    const allowHighFlag = document.getElementById("checkbox-allow-high-flag")?.checked;
    const attended = currentSessionRecords.filter(r => {
        if (allowHighFlag) {
            return r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'REJECTED';
        } else {
            if (r.flagLevel === 'HIGH') return false;
            return r.status === 'PRESENT' || r.status === 'LATE';
        }
    }).length;

    const attendedEl = document.getElementById("attended-count");
    if (attendedEl) attendedEl.textContent = attended;
    const expectedEl = document.getElementById("expected-count");
    if (expectedEl) expectedEl.textContent = expected;

    const percent = Math.min(100, Math.round((attended / expected) * 100));
    const percentEl = document.getElementById("attendance-percent");
    if (percentEl) percentEl.textContent = `${percent}%`;

    // SVG circle dashoffset — circumference of circle r=55 is 2 * PI * 55 = 345.5
    const offset = 345.5 - (345.5 * percent) / 100;
    const circle = document.getElementById("attendance-chart");
    if (circle) circle.style.strokeDashoffset = offset;
}

function renderAttendeeList() {
    const container = document.getElementById("attendees-list-box");
    if (!container) return;
    container.innerHTML = "";

    const allowHighFlag = document.getElementById("checkbox-allow-high-flag")?.checked;
    const flagCheckbox = document.getElementById("checkbox-show-low-med");
    const showLowMed = flagCheckbox ? flagCheckbox.checked : false;

    // Show all records regardless of the toggle status
    const visibleRecords = [...currentSessionRecords];

    if (visibleRecords.length === 0) {
        container.innerHTML = `<p style="text-align:center; font-size:0.8rem; color:var(--text-secondary); padding: 1rem 0;">No attendees recorded.</p>`;
        return;
    }

    visibleRecords.forEach(r => {
        // Determine if we show flag icon
        let showFlag = false;
        if (r.flagLevel === 'HIGH') {
            showFlag = true;
        } else if ((r.flagLevel === 'MEDIUM' || r.flagLevel === 'LOW') && showLowMed) {
            showFlag = true;
        }

        // When toggle is ON, the status of rejected students will temporarily say PRESENT
        const displayStatus = (allowHighFlag && r.status === 'REJECTED') ? 'PRESENT' : r.status;

        const card = document.createElement("div");
        card.className = "attendee-card";
        card.innerHTML = `
            <div class="attendee-main">
                <div>
                    <div class="attendee-name">${r.studentName}</div>
                    <div class="attendee-id">ID: ${r.studentId} | status: ${displayStatus}</div>
                </div>
                ${showFlag ? `
                    <span class="flag-icon" onclick="toggleFlagReason(this)" title="Click to view flag reason">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path fill-rule="evenodd" d="M3 2.25a.75.75 0 01.75.75v.54l1.838-.46a9.75 9.75 0 016.725.738l.108.054A8.25 8.25 0 0018 4.5h.75a.75.75 0 01.75.75v8.25a.75.75 0 01-.75.75H18a9.75 9.75 0 01-6.725-.738l-.108-.054A8.25 8.25 0 005.25 13.5v7.75a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75z" clip-rule="evenodd" />
                        </svg>
                    </span>
                ` : ''}
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

function toggleDetailSettings() {
    const panel = document.getElementById("detail-settings-panel");
    if (panel) panel.classList.toggle("hidden");
}

function exportAttendancePDF() {
    if (!currentDetailSession) return;

    const allowHighFlag = document.getElementById("checkbox-allow-high-flag")?.checked;
    const records = currentSessionRecords.filter(r => {
        if (allowHighFlag) {
            return r.status === 'PRESENT' || r.status === 'LATE' || r.status === 'REJECTED';
        } else {
            if (r.flagLevel === 'HIGH') return false;
            return r.status === 'PRESENT' || r.status === 'LATE';
        }
    });

    const session = currentDetailSession;
    const now = new Date().toLocaleString();

    const tableRows = records.map((r, i) => `
        <tr class="${i % 2 === 0 ? 'even' : 'odd'}">
            <td>${r.studentId || '—'}</td>
            <td>${r.studentName || '—'}</td>
        </tr>`).join('');

    const emptyMsg = records.length === 0
        ? `<tr><td colspan="2" style="text-align:center;color:#888;padding:1.5rem;">No attendance records to export.</td></tr>`
        : '';

    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <title>Attendance Report — ${session.moduleCode}</title>
            <style>
                * { box-sizing: border-box; margin: 0; padding: 0; }
                body {
                    font-family: 'Segoe UI', Arial, sans-serif;
                    color: #111;
                    padding: 3rem 3.5rem;
                    background: #fff;
                }
                .header {
                    border-bottom: 2px solid #1e40af;
                    padding-bottom: 1rem;
                    margin-bottom: 1.5rem;
                }
                .header-top {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                }
                .brand {
                    font-size: 0.75rem;
                    color: #1e40af;
                    font-weight: 700;
                    letter-spacing: 0.08em;
                    text-transform: uppercase;
                }
                .generated {
                    font-size: 0.7rem;
                    color: #777;
                    text-align: right;
                }
                h1 {
                    font-size: 1.4rem;
                    font-weight: 700;
                    color: #1e3a8a;
                    margin: 0.5rem 0 0.2rem;
                }
                .meta-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.5rem 2rem;
                    margin-bottom: 1.5rem;
                }
                .meta-item label {
                    display: block;
                    font-size: 0.65rem;
                    font-weight: 700;
                    text-transform: uppercase;
                    letter-spacing: 0.06em;
                    color: #6b7280;
                    margin-bottom: 0.15rem;
                }
                .meta-item span {
                    font-size: 0.9rem;
                    font-weight: 600;
                    color: #111;
                }
                .count-badge {
                    display: inline-block;
                    background: #dbeafe;
                    color: #1e40af;
                    font-weight: 700;
                    font-size: 0.78rem;
                    padding: 0.2rem 0.65rem;
                    border-radius: 9999px;
                    margin-bottom: 1rem;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 0.875rem;
                }
                thead th {
                    background: #1e40af;
                    color: #fff;
                    padding: 0.65rem 0.85rem;
                    text-align: left;
                    font-weight: 600;
                    font-size: 0.8rem;
                    letter-spacing: 0.03em;
                }
                thead th:first-child { border-radius: 0.375rem 0 0 0; }
                thead th:last-child  { border-radius: 0 0.375rem 0 0; }
                tbody td {
                    padding: 0.55rem 0.85rem;
                    border-bottom: 1px solid #e5e7eb;
                    color: #1f2937;
                }
                tr.even td { background: #f9fafb; }
                tr.odd  td { background: #fff; }
                .footer {
                    margin-top: 2rem;
                    padding-top: 0.75rem;
                    border-top: 1px solid #e5e7eb;
                    font-size: 0.68rem;
                    color: #9ca3af;
                    text-align: center;
                }
                @media print {
                    body { padding: 1.5cm 2cm; }
                    .no-print { display: none; }
                }
            </style>
        </head>
        <body>
            <div class="header">
                <div class="header-top">
                    <span class="brand">Attendance Shield</span>
                    <span class="generated">Generated: ${now}</span>
                </div>
                <h1>${session.moduleCode} — ${session.moduleName}</h1>
            </div>

            <div class="meta-grid">
                <div class="meta-item">
                    <label>Module Code</label>
                    <span>${session.moduleCode}</span>
                </div>
                <div class="meta-item">
                    <label>Module Name</label>
                    <span>${session.moduleName}</span>
                </div>
                <div class="meta-item">
                    <label>Lecture Topic</label>
                    <span>${session.lectureTopic}</span>
                </div>
                <div class="meta-item">
                    <label>Lecture Date</label>
                    <span>${new Date(session.lectureStartTime).toLocaleDateString()}</span>
                </div>
            </div>

            <div class="count-badge">${records.length} student${records.length !== 1 ? 's' : ''} attended</div>

            <table>
                <thead>
                    <tr>
                        <th style="width:35%">Student ID</th>
                        <th>Student Name</th>
                    </tr>
                </thead>
                <tbody>
                    ${tableRows}${emptyMsg}
                </tbody>
            </table>

            <div class="footer">
                Attendance Shield &mdash; Confidential &mdash; ${session.moduleCode} &mdash; ${now}
            </div>

            <script>
                window.onload = function() {
                    window.print();
                    setTimeout(function() { window.close(); }, 600);
                };
            <\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

let allLoadedLogs = [];

// Get Audit Logs
async function loadAuditLogs() {
    try {
        let url;
        if (currentUser && currentUser.role === 'ADMIN') {
            url = `${BASE_URL}/api/events/all`;
        } else {
            const sessionId = activeSession ? activeSession.sessionId : (allSessions.length > 0 ? allSessions[0].sessionId : null);
            if (!sessionId) return;
            url = `${BASE_URL}/api/events/session/${sessionId}`;
        }

        const res = await fetch(url, {
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
    const addLecturerModal = document.getElementById("add-lecturer-modal");
    const lecturerDetailModal = document.getElementById("lecturer-detail-modal");
    const confirmModal = document.getElementById("confirm-modal");
    if (event.target === qrModal) closeQrModal();
    if (event.target === detailModal) closeDetailModal();
    if (event.target === addStudentModal) closeAddStudentModal();
    if (event.target === studentDetailModal) closeStudentDetailModal();
    if (event.target === addLecturerModal) closeAddLecturerModal();
    if (event.target === lecturerDetailModal) closeLecturerDetailModal();
    if (event.target === confirmModal) closeConfirmModal();
}

// ─── Universal Confirmation Modal ───────────────────────────────────

/**
 * Shows the shared confirmation modal.
 * @param {object} opts
 * @param {'danger'|'reset'} opts.variant  - 'danger' (red) or 'reset' (green)
 * @param {string} opts.title
 * @param {string} opts.body
 * @param {string} opts.confirmLabel
 * @param {(closeModal: Function) => void} opts.onConfirm - called when user clicks confirm
 */
function showConfirmModal({ variant = 'danger', title, body, confirmLabel = 'Confirm', onConfirm }) {
    const modal       = document.getElementById('confirm-modal');
    const iconEl      = document.getElementById('confirm-modal-icon');
    const titleEl     = document.getElementById('confirm-modal-title');
    const bodyEl      = document.getElementById('confirm-modal-body');
    const confirmBtn  = document.getElementById('confirm-modal-confirm');
    const cancelBtn   = document.getElementById('confirm-modal-cancel');

    if (!modal) return;

    // Set icon
    if (variant === 'reset') {
        iconEl.className = 'confirm-modal-icon confirm-modal-icon--reset';
        iconEl.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#10b981" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21.5 2v6h-6"/><path d="M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/>
        </svg>`;
    } else {
        iconEl.className = 'confirm-modal-icon confirm-modal-icon--danger';
        iconEl.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="#ef4444" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
            <line x1="12" y1="9" x2="12" y2="13"/>
            <line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>`;
    }

    // Set text
    titleEl.textContent  = title || '';
    bodyEl.textContent   = body  || '';
    confirmBtn.textContent = confirmLabel;

    // Set button colour variant
    confirmBtn.className = `btn confirm-btn-confirm variant-${variant === 'reset' ? 'reset' : 'danger'}`;

    // Wire confirm button — clone to clear old listeners
    const newConfirmBtn = confirmBtn.cloneNode(true);
    confirmBtn.parentNode.replaceChild(newConfirmBtn, confirmBtn);
    newConfirmBtn.className = `btn confirm-btn-confirm variant-${variant === 'reset' ? 'reset' : 'danger'}`;
    newConfirmBtn.textContent = confirmLabel;
    newConfirmBtn.onclick = async () => {
        newConfirmBtn.disabled = true;
        newConfirmBtn.innerHTML = '<div class="btn-loader"><span></span><span></span><span></span></div>';
        if (onConfirm) await onConfirm(closeConfirmModal);
    };

    // Wire cancel button
    cancelBtn.onclick = () => closeConfirmModal();

    // Show
    modal.classList.remove('hidden');
}

function closeConfirmModal() {
    const modal = document.getElementById('confirm-modal');
    if (modal) modal.classList.add('hidden');
    // Re-enable the confirm button in case it was mid-loading
    const confirmBtn = document.getElementById('confirm-modal-confirm');
    if (confirmBtn) {
        confirmBtn.disabled = false;
    }
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
            btn.innerHTML = '<div class="btn-loader"><span></span><span></span><span></span></div>';
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
    showConfirmModal({
        variant: 'danger',
        title: 'Delete Student?',
        body: `"${selectedStudent.fullName}" and all their associated data will be permanently removed. This cannot be undone.`,
        confirmLabel: 'Yes, Delete',
        onConfirm: async (closeModal) => {
            try {
                const res = await fetch(`${BASE_URL}/api/students/${selectedStudent.userId}`, {
                    method: "DELETE",
                    headers: getHeaders()
                });
                if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
                closeModal();
                closeStudentDetailModal();
                showToast("Student deleted", "success");
                await loadStudents();
            } catch (err) {
                console.error("[DeleteStudent]", err);
                closeModal();
                showToast(err.message, "error");
            }
        }
    });
}

async function resetStudentPassword() {
    if (!selectedStudent) return;
    showConfirmModal({
        variant: 'reset',
        title: 'Reset Password?',
        body: `A new secure password will be generated and emailed to ${selectedStudent.fullName} (${selectedStudent.email}).`,
        confirmLabel: 'Yes, Reset',
        onConfirm: async (closeModal) => {
            try {
                const res = await fetch(`${BASE_URL}/api/students/${selectedStudent.userId}/reset-password`, {
                    method: "POST",
                    headers: getHeaders()
                });
                if (!res.ok) throw new Error(`Reset failed (HTTP ${res.status})`);
                closeModal();
                showToast("New password sent to student's email", "success");
                closeStudentDetailModal();
            } catch (err) {
                console.error("[ResetPassword]", err);
                closeModal();
                showToast(err.message, "error");
            }
        }
    });
}

// ─── LECTURER MANAGEMENT ───────────────────────────────────────────

let allLecturers = [];
let selectedLecturer = null;

function switchUserSubTab(userType) {
    document.querySelectorAll("#tab-students .sub-tab-item").forEach(el => el.classList.remove("active"));
    const subTabBtn = document.getElementById(`subtab-${userType}-btn`);
    if (subTabBtn) subTabBtn.classList.add("active");

    if (userType === 'student') {
        document.getElementById("panel-student-management").classList.remove("hidden");
        document.getElementById("panel-lecturer-management").classList.add("hidden");
        loadStudents();
    } else {
        document.getElementById("panel-student-management").classList.add("hidden");
        document.getElementById("panel-lecturer-management").classList.remove("hidden");
        loadLecturers();
    }
}

async function loadLecturers() {
    try {
        const res = await fetch(`${BASE_URL}/api/lecturers`, { headers: getHeaders() });
        if (!res.ok) return;
        allLecturers = await res.json();
        renderLecturerCards(allLecturers);
    } catch (e) {
        console.error("[Lecturers] Load error:", e);
    }
}

function renderLecturerCards(lecturers) {
    const grid = document.getElementById("lecturer-cards-grid");
    if (!grid) return;
    grid.innerHTML = "";
    if (lecturers.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:2rem;">No lecturers found.</div>`;
        return;
    }
    lecturers.forEach(l => {
        const card = document.createElement("div");
        card.className = "attendee-card";
        card.style.cssText = "cursor:pointer;transition:transform 0.15s,box-shadow 0.15s;";
        card.onmouseenter = () => { card.style.transform = "translateY(-2px)"; card.style.boxShadow = "0 8px 24px rgba(59,130,246,0.2)"; };
        card.onmouseleave = () => { card.style.transform = ""; card.style.boxShadow = ""; };
        card.onclick = () => openLecturerDetailModal(l);
        card.innerHTML = `
            <div style="display:flex;align-items:center;gap:0.75rem;">
                <div style="width:2.5rem;height:2.5rem;border-radius:50%;background:linear-gradient(135deg,#10b981,#3b82f6);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:1rem;flex-shrink:0;">
                    ${(l.fullName || "?")[0].toUpperCase()}
                </div>
                <div style="overflow:hidden;">
                    <div style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${l.fullName}</div>
                </div>
            </div>`;
        grid.appendChild(card);
    });
}

function filterLecturerCards() {
    const searchEl = document.getElementById("lecturer-search");
    if (!searchEl) return;
    const q = searchEl.value.toLowerCase().trim();
    const filtered = q
        ? allLecturers.filter(l =>
            (l.fullName || "").toLowerCase().includes(q))
        : allLecturers;
    renderLecturerCards(filtered);
}

// ── Add Lecturer Modal ──
function openAddLecturerModal() {
    const addForm = document.getElementById("add-lecturer-form");
    if (addForm) addForm.reset();
    const errorEl = document.getElementById("add-lecturer-error");
    if (errorEl) errorEl.classList.add("hidden");
    const btn = document.getElementById("add-lecturer-submit-btn");
    if (btn) btn.disabled = false;
    const addModal = document.getElementById("add-lecturer-modal");
    if (addModal) addModal.classList.remove("hidden");
}

function closeAddLecturerModal() {
    const addModal = document.getElementById("add-lecturer-modal");
    if (addModal) addModal.classList.add("hidden");
}

const addLecturerForm = document.getElementById("add-lecturer-form");
if (addLecturerForm) {
    addLecturerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errorBox = document.getElementById("add-lecturer-error");
        if (errorBox) errorBox.classList.add("hidden");
        const btn = document.getElementById("add-lecturer-submit-btn");
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<div class="btn-loader"><span></span><span></span><span></span></div>';
        }

        const payload = {
            fullName:  document.getElementById("add-lecturer-name").value.trim(),
            email:     document.getElementById("add-lecturer-email").value.trim()
        };

        try {
            const res = await fetch(`${BASE_URL}/api/lecturers`, {
                method: "POST",
                headers: getHeaders(),
                body: JSON.stringify(payload)
            });
            if (!res.ok) {
                let msg = `Error (HTTP ${res.status})`;
                try { const b = await res.json(); msg = b.message || msg; } catch(_) {}
                throw new Error(msg);
            }
            closeAddLecturerModal();
            showToast("Lecturer created — password sent by email", "success");
            await loadLecturers();
        } catch (err) {
            console.error("[AddLecturer]", err);
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

function openLecturerDetailModal(lecturer) {
    selectedLecturer = lecturer;
    const heading = document.getElementById("detail-lecturer-heading");
    if (heading) heading.textContent = lecturer.fullName;
    const nameEl = document.getElementById("view-lecturer-name");
    if (nameEl) nameEl.textContent = lecturer.fullName;
    const emailEl = document.getElementById("view-lecturer-email");
    if (emailEl) emailEl.textContent = lecturer.email;

    const viewMode = document.getElementById("lecturer-view-mode");
    if (viewMode) viewMode.classList.remove("hidden");
    const editMode = document.getElementById("lecturer-edit-mode");
    if (editMode) editMode.classList.add("hidden");
    const detailModal = document.getElementById("lecturer-detail-modal");
    if (detailModal) detailModal.classList.remove("hidden");
}

function closeLecturerDetailModal() {
    const detailModal = document.getElementById("lecturer-detail-modal");
    if (detailModal) detailModal.classList.add("hidden");
    selectedLecturer = null;
}

function enterLecturerEditMode() {
    const nameInput = document.getElementById("edit-lecturer-name");
    if (nameInput) nameInput.value = selectedLecturer.fullName;
    const emailInput = document.getElementById("edit-lecturer-email");
    if (emailInput) emailInput.value = selectedLecturer.email;

    const errorEl = document.getElementById("edit-lecturer-error");
    if (errorEl) errorEl.classList.add("hidden");
    const viewMode = document.getElementById("lecturer-view-mode");
    if (viewMode) viewMode.classList.add("hidden");
    const editMode = document.getElementById("lecturer-edit-mode");
    if (editMode) editMode.classList.remove("hidden");
}

function exitLecturerEditMode() {
    const viewMode = document.getElementById("lecturer-view-mode");
    if (viewMode) viewMode.classList.remove("hidden");
    const editMode = document.getElementById("lecturer-edit-mode");
    if (editMode) editMode.classList.add("hidden");
}

const editLecturerForm = document.getElementById("edit-lecturer-form");
if (editLecturerForm) {
    editLecturerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const errorBox = document.getElementById("edit-lecturer-error");
        if (errorBox) errorBox.classList.add("hidden");

        const payload = {
            fullName:  document.getElementById("edit-lecturer-name").value.trim(),
            email:     document.getElementById("edit-lecturer-email").value.trim()
        };

        try {
            const res = await fetch(`${BASE_URL}/api/lecturers/${selectedLecturer.userId}`, {
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
            selectedLecturer = updated;
            closeLecturerDetailModal();
            showToast("Lecturer record updated", "success");
            await loadLecturers();
        } catch (err) {
            console.error("[EditLecturer]", err);
            if (errorBox) {
                errorBox.textContent = err.message;
                errorBox.classList.remove("hidden");
            }
        }
    });
}

async function deleteLecturer() {
    if (!selectedLecturer) return;
    showConfirmModal({
        variant: 'danger',
        title: 'Delete Lecturer?',
        body: `"${selectedLecturer.fullName}" and all their associated data will be permanently removed. This cannot be undone.`,
        confirmLabel: 'Yes, Delete',
        onConfirm: async (closeModal) => {
            try {
                const res = await fetch(`${BASE_URL}/api/lecturers/${selectedLecturer.userId}`, {
                    method: "DELETE",
                    headers: getHeaders()
                });
                if (!res.ok) throw new Error(`Delete failed (HTTP ${res.status})`);
                closeModal();
                closeLecturerDetailModal();
                showToast("Lecturer deleted", "success");
                await loadLecturers();
            } catch (err) {
                console.error("[DeleteLecturer]", err);
                closeModal();
                showToast(err.message, "error");
            }
        }
    });
}

async function resetLecturerPassword() {
    if (!selectedLecturer) return;
    showConfirmModal({
        variant: 'reset',
        title: 'Reset Password?',
        body: `A new secure password will be generated and emailed to ${selectedLecturer.fullName} (${selectedLecturer.email}).`,
        confirmLabel: 'Yes, Reset',
        onConfirm: async (closeModal) => {
            try {
                const res = await fetch(`${BASE_URL}/api/lecturers/${selectedLecturer.userId}/reset-password`, {
                    method: "POST",
                    headers: getHeaders()
                });
                if (!res.ok) throw new Error(`Reset failed (HTTP ${res.status})`);
                closeModal();
                showToast("New password sent to lecturer's email", "success");
                closeLecturerDetailModal();
            } catch (err) {
                console.error("[ResetLecturerPassword]", err);
                closeModal();
                showToast(err.message, "error");
            }
        }
    });
}

async function refreshAuditLogs(btn) {
    if (!btn) return;
    const icon = btn.querySelector(".refresh-icon");
    if (icon) icon.classList.add("spinning");
    btn.disabled = true;

    try {
        await loadAuditLogs();
        showToast("Audit logs refreshed", "success");
    } catch (e) {
        showToast("Failed to refresh logs", "error");
    } finally {
        if (icon) icon.classList.remove("spinning");
        btn.disabled = false;
    }
}

async function refreshStudents(btn) {
    if (!btn) return;
    const icon = btn.querySelector(".refresh-icon");
    if (icon) icon.classList.add("spinning");
    btn.disabled = true;

    try {
        await loadStudents();
        showToast("Students list refreshed", "success");
    } catch (e) {
        showToast("Failed to refresh students", "error");
    } finally {
        if (icon) icon.classList.remove("spinning");
        btn.disabled = false;
    }
}

async function refreshLecturers(btn) {
    if (!btn) return;
    const icon = btn.querySelector(".refresh-icon");
    if (icon) icon.classList.add("spinning");
    btn.disabled = true;

    try {
        await loadLecturers();
        showToast("Lecturers list refreshed", "success");
    } catch (e) {
        showToast("Failed to refresh lecturers", "error");
    } finally {
        if (icon) icon.classList.remove("spinning");
        btn.disabled = false;
    }
}

