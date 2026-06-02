/**
 * QREvent - Supabase Event Check-in & Android UI
 * Core JavaScript Logic
 */

document.addEventListener("DOMContentLoaded", () => {
    // -------------------------------------------------------------
    // 1. STATE MANAGEMENT & SUPABASE CLIENT INITIALIZATION
    // -------------------------------------------------------------
    let state = {
        participants: [],
        checkInLogs: [],
        offlineQueue: [],
        isOnline: true,
        selectedGate: "Gate A",
        activeTab: "dashboard",
        soundEnabled: true,
        scannedThrottle: false,
        
        // Supabase specific state
        supabaseConfig: { url: "", key: "" },
        useSupabase: true,
        currentUser: null, // Logged in attendee user
        supabaseUser: null, // Logged in Supabase Auth user
        realtimeChannels: []
    };

    let supabase = null;

    // Safe LocalStorage Wrappers to prevent SecurityErrors in private/restricted environments
    function safeLocalStorageGet(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn("localStorage.getItem failed:", e);
            return null;
        }
    }

    function safeLocalStorageSet(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.warn("localStorage.setItem failed:", e);
            return false;
        }
    }

    function safeLocalStorageRemove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.warn("localStorage.removeItem failed:", e);
            return false;
        }
    }

    // Load environment variables from config.json or fallback to .env file asynchronously
    async function loadEnv() {
        // Try loading config.json first (preferred for Netlify deployment)
        try {
            const response = await fetch('/config.json');
            if (response.ok) {
                const config = await response.json();
                console.log("Environment variables loaded from config.json");
                return config;
            }
        } catch (e) {
            console.warn("Could not load config.json, trying .env file:", e);
        }

        // Fallback to loading .env (used for local development)
        try {
            const response = await fetch('/.env');
            if (!response.ok) return null;
            const text = await response.text();
            const env = {};
            text.split('\n').forEach(line => {
                const cleanLine = line.trim();
                if (!cleanLine || cleanLine.startsWith('#')) return;
                const parts = cleanLine.split('=');
                if (parts.length >= 2) {
                    const key = parts[0].trim();
                    const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
                    env[key] = value;
                }
            });
            console.log("Environment variables loaded from .env");
            return env;
        } catch (e) {
            console.warn("Failed to load .env file:", e);
            return null;
        }
    }

    // Initialize Supabase Client
    async function initSupabase() {
        const env = await loadEnv();
        const savedUrl = (env && env.SUPABASE_URL) || "https://sxgjhivrclawaxqtphge.supabase.co";
        let savedKey = (env && env.SUPABASE_KEY) || "";

        // Check if the loaded key is still the default placeholder
        if (savedKey === "PASTE_YOUR_SUPABASE_ANON_KEY_HERE") {
            savedKey = "";
        }

        state.supabaseConfig = { url: savedUrl, key: savedKey };
        state.useSupabase = true;

        if (savedUrl && savedKey) {
            try {
                // Initialize Supabase Client
                supabase = window.supabase.createClient(savedUrl, savedKey);
                console.log("Supabase Client initialized successfully.");
            } catch (err) {
                console.error("Supabase init error:", err);
            }
        } else {
            console.warn("Supabase Anon Key is missing from config.json or .env.");
        }
    }

    // Load local storage values for persisting UI options
    function loadLocalState() {
        const savedOnline = safeLocalStorageGet("qrevent_online");
        const savedGate = safeLocalStorageGet("qrevent_gate");
        const savedSound = safeLocalStorageGet("qrevent_sound");

        if (savedOnline !== null) {
            try {
                state.isOnline = JSON.parse(savedOnline);
            } catch(e) {
                console.error("Parse online failed", e);
            }
        }
        if (savedGate) state.selectedGate = savedGate;
        if (savedSound !== null) {
            try {
                state.soundEnabled = JSON.parse(savedSound);
            } catch(e) {
                console.error("Parse sound failed", e);
            }
        }
    }

    // Save UI options to localStorage
    function saveLocalState() {
        safeLocalStorageSet("qrevent_online", JSON.stringify(state.isOnline));
        safeLocalStorageSet("qrevent_gate", state.selectedGate);
        safeLocalStorageSet("qrevent_sound", JSON.stringify(state.soundEnabled));
    }

    // -------------------------------------------------------------
    // TICKET TOKEN GENERATION
    // -------------------------------------------------------------
    function generateUniqueToken(category) {
        const chars = "0123456789ABCDEF";
        let tokenSuffix = "";
        for (let i = 0; i < 5; i++) {
            tokenSuffix += chars[Math.floor(Math.random() * chars.length)];
        }
        return `TKT-${category.toUpperCase()}-${tokenSuffix}`;
    }

    // -------------------------------------------------------------
    // SOUND EFFECTS (WEB AUDIO API SYNTHESIZER)
    // -------------------------------------------------------------
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

    function playSound(type) {
        if (!state.soundEnabled) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        const now = audioCtx.currentTime;

        if (type === "success") {
            osc.type = "sine";
            osc.frequency.setValueAtTime(523.25, now); // C5
            osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
            osc.frequency.setValueAtTime(783.99, now + 0.16); // G5
            gainNode.gain.setValueAtTime(0.15, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === "duplicate") {
            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(140, now);
            osc.frequency.setValueAtTime(100, now + 0.15);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
            osc.start(now);
            osc.stop(now + 0.4);
        } else if (type === "error") {
            osc.type = "square";
            osc.frequency.setValueAtTime(180, now);
            gainNode.gain.setValueAtTime(0.2, now);
            gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
            osc.start(now);
            osc.stop(now + 0.5);
        }
    }

    // -------------------------------------------------------------
    // TOAST NOTIFICATIONS
    // -------------------------------------------------------------
    const toastContainer = document.getElementById("toast-container");

    function showToast(title, message, type = "info") {
        const toast = document.createElement("div");
        toast.className = `toast ${type}`;

        let iconName = "info";
        if (type === "success") iconName = "check-circle";
        if (type === "error") iconName = "alert-triangle";
        if (type === "warning") iconName = "alert-circle";

        toast.innerHTML = `
            <i data-lucide="${iconName}" class="toast-icon"></i>
            <div class="toast-content">
                <div class="toast-title">${title}</div>
                <div class="toast-message">${message}</div>
            </div>
            <button class="toast-close">&times;</button>
        `;

        toastContainer.appendChild(toast);
        lucide.createIcons();

        toast.querySelector(".toast-close").addEventListener("click", () => toast.remove());
        setTimeout(() => {
            toast.style.animation = "fadeIn 0.3s ease reverse forwards";
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    // -------------------------------------------------------------
    // CHART.JS GRAPHICS
    // -------------------------------------------------------------
    let checkinTypeChartInstance = null;
    let gateDistributionChartInstance = null;

    function initCharts() {
        const ctxType = document.getElementById("checkinTypeChart").getContext("2d");
        const ctxGate = document.getElementById("gateDistributionChart").getContext("2d");

        const accentColor = "#6366f1";
        const successColor = "#10b981";
        const warningColor = "#f59e0b";
        const textColor = "#94a3b8";

        checkinTypeChartInstance = new Chart(ctxType, {
            type: "doughnut",
            data: {
                labels: ["Checked In", "Belum Hadir"],
                datasets: [{
                    data: [0, 0],
                    backgroundColor: [successColor, "#1e293b"],
                    borderWidth: 2,
                    borderColor: "#141c2f"
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { color: textColor, font: { family: "Plus Jakarta Sans", size: 10, weight: "600" }, padding: 10 }
                    },
                    title: { display: true, text: "STATUS KEHADIRAN", color: "#f8fafc", font: { family: "Plus Jakarta Sans", size: 11, weight: "700" } }
                },
                cutout: "70%"
            }
        });

        gateDistributionChartInstance = new Chart(ctxGate, {
            type: "bar",
            data: {
                labels: ["Gate A", "Gate B", "Gate C"],
                datasets: [{
                    label: "Check-ins",
                    data: [0, 0, 0],
                    backgroundColor: [accentColor, "#3b82f6", warningColor],
                    borderRadius: 6,
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false },
                    title: { display: true, text: "VOLUME TICKETS PER PINTU", color: "#f8fafc", font: { family: "Plus Jakarta Sans", size: 11, weight: "700" } }
                },
                scales: {
                    x: { grid: { display: false }, ticks: { color: textColor, font: { family: "Plus Jakarta Sans", size: 9 } } },
                    y: { grid: { color: "rgba(255, 255, 255, 0.05)" }, ticks: { color: textColor, font: { family: "Plus Jakarta Sans", size: 9 }, stepSize: 1 } }
                }
            }
        });
    }

    function updateCharts() {
        if (!checkinTypeChartInstance || !gateDistributionChartInstance) return;

        const total = state.participants.length;
        const checkedIn = state.participants.filter(p => p.checked_in === true || p.checkInTime !== null).length;
        const remaining = total - checkedIn;

        checkinTypeChartInstance.data.datasets[0].data = [checkedIn, remaining];
        checkinTypeChartInstance.update();

        const gateA = state.participants.filter(p => p.check_in_gate === "Gate A" || p.checkInGate === "Gate A").length;
        const gateB = state.participants.filter(p => p.check_in_gate === "Gate B" || p.checkInGate === "Gate B").length;
        const gateC = state.participants.filter(p => p.check_in_gate === "Gate C" || p.checkInGate === "Gate C").length;

        gateDistributionChartInstance.data.datasets[0].data = [gateA, gateB, gateC];
        gateDistributionChartInstance.update();
    }

    function updateStats() {
        const total = state.participants.length;
        const checkedIn = state.participants.filter(p => p.checked_in === true || p.checkInTime !== null).length;
        const remaining = total - checkedIn;
        const percent = total > 0 ? Math.round((checkedIn / total) * 100) : 0;

        document.getElementById("stat-total-participants").innerText = total;
        document.getElementById("stat-checked-in").innerText = checkedIn;
        document.getElementById("stat-checked-in-pct").innerText = `${percent}% success rate`;
        document.getElementById("stat-remaining").innerText = remaining;
    }

    function refreshAllUIs() {
        updateStats();
        updateCharts();
        renderDashboardFeed();
        renderParticipantsTable();
        renderParticipantSelectorList();
        renderQuickPickList();
        renderReportsTable();
    }

    // -------------------------------------------------------------
    // FETCH DATA FROM SUPABASE DATABASE
    // -------------------------------------------------------------
    async function fetchDatabaseData() {
        if (!state.useSupabase || !supabase) return;

        try {
            // 1. Fetch participants (profiles table)
            const { data: profiles, error: errProf } = await supabase
                .from('profiles')
                .select('*');
            if (errProf) throw errProf;
            
            // Map keys of Supabase back to local compatible object
            state.participants = profiles.map(p => ({
                id: p.id,
                name: p.name,
                email: p.email,
                ticketType: p.ticket_type,
                token: p.ticket_token,
                checked_in: p.checked_in,
                checkedIn: p.checked_in,
                check_in_time: p.check_in_time,
                checkInTime: p.check_in_time,
                check_in_gate: p.check_in_gate,
                checkInGate: p.check_in_gate
            }));

            // 2. Fetch check-in logs
            const { data: logs, error: errLogs } = await supabase
                .from('check_in_logs')
                .select('*')
                .order('created_at', { ascending: false });
            if (errLogs) throw errLogs;

            state.checkInLogs = logs.map(l => ({
                time: new Date(l.created_at).toLocaleString("id-ID"),
                name: l.participant_name,
                token: l.ticket_token,
                gate: l.gate,
                status: l.status,
                details: l.details
            }));

            refreshAllUIs();
        } catch (err) {
            console.error("Supabase fetch database error:", err);
            showToast("Database Sync Error", "Gagal memuat data dari Supabase. Menggunakan data lokal.", "error");
        }
    }

    // -------------------------------------------------------------
    // SUPABASE REALTIME SUBSCRIPTION CHANNELS
    // -------------------------------------------------------------
    function subscribeToRealtimeDatabase() {
        if (!state.useSupabase || !supabase) return;

        try {
            // Clean existing channels first
            state.realtimeChannels.forEach(c => supabase.removeChannel(c));
            state.realtimeChannels = [];

            // 1. Channel for check_in_logs insertions (live dashboard feed)
            const logChannel = supabase.channel('schema-db-logs')
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'check_in_logs' }, payload => {
                    const newLog = payload.new;
                    
                    // Add to head of logs
                    state.checkInLogs.unshift({
                        time: new Date(newLog.created_at).toLocaleString("id-ID"),
                        name: newLog.participant_name,
                        token: newLog.ticket_token,
                        gate: newLog.gate,
                        status: newLog.status,
                        details: newLog.details
                    });

                    showToast("Scan Masuk Baru", `${newLog.participant_name} masuk melalui ${newLog.gate}.`, "success");
                    refreshAllUIs();
                })
                .subscribe();

            // 2. Channel for profiles updates (sync participants state and charts)
            const profilesChannel = supabase.channel('schema-db-profiles')
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
                    const updatedProfile = payload.new;
                    
                    const idx = state.participants.findIndex(p => p.id === updatedProfile.id);
                    if (idx !== -1) {
                        state.participants[idx].checked_in = updatedProfile.checked_in;
                        state.participants[idx].checkedIn = updatedProfile.checked_in;
                        state.participants[idx].check_in_time = updatedProfile.check_in_time;
                        state.participants[idx].checkInTime = updatedProfile.check_in_time;
                        state.participants[idx].check_in_gate = updatedProfile.check_in_gate;
                        state.participants[idx].checkInGate = updatedProfile.check_in_gate;
                    }

                    // If currently logged in user is updated (Live updating ticket on user's phone!)
                    if (state.currentUser && state.currentUser.id === updatedProfile.id) {
                        state.currentUser.checked_in = updatedProfile.checked_in;
                        state.currentUser.checkedIn = updatedProfile.checked_in;
                        state.currentUser.check_in_time = updatedProfile.check_in_time;
                        state.currentUser.checkInTime = updatedProfile.check_in_time;
                        state.currentUser.check_in_gate = updatedProfile.check_in_gate;
                        state.currentUser.checkInGate = updatedProfile.check_in_gate;
                        
                        updateUserTicketScreen();
                        
                        // Visual confirmation sound & flash screen
                        if (updatedProfile.checked_in) {
                            playSound("success");
                            const screen = document.querySelector(".android-screen");
                            screen.style.animation = "scaleShake 0.4s ease";
                            setTimeout(() => screen.style.animation = "", 400);
                            showToast("Scan Berhasil", "Tiket Anda berhasil dipindai oleh Panitia!", "success");
                        }
                    }

                    refreshAllUIs();
                })
                .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, payload => {
                    const newProfile = payload.new;
                    state.participants.push({
                        id: newProfile.id,
                        name: newProfile.name,
                        email: newProfile.email,
                        ticketType: newProfile.ticket_type,
                        token: newProfile.ticket_token,
                        checked_in: newProfile.checked_in,
                        checkedIn: newProfile.checked_in,
                        check_in_time: newProfile.check_in_time,
                        checkInTime: newProfile.check_in_time,
                        check_in_gate: newProfile.check_in_gate,
                        checkInGate: newProfile.check_in_gate
                    });
                    refreshAllUIs();
                })
                .subscribe();

            state.realtimeChannels.push(logChannel, profilesChannel);
        } catch (err) {
            console.error("Supabase Realtime subscription error:", err);
            showToast("Realtime Connection Error", "Gagal berlangganan update real-time database.", "warning");
        }
    }

    // -------------------------------------------------------------
    // ROUTING AND LOGIN VIEW SWITCHES
    // -------------------------------------------------------------
    const landingScreen = document.getElementById("landing-screen");
    const userAppContainer = document.getElementById("user-app-container");
    const adminAppContainer = document.getElementById("admin-app-container");

    document.getElementById("btn-select-user").addEventListener("click", () => {
        landingScreen.classList.add("hidden");
        userAppContainer.classList.remove("hidden");
        // Show auth view
        showUserScreen("auth");
    });

    document.getElementById("btn-select-admin").addEventListener("click", () => {
        landingScreen.classList.add("hidden");
        adminAppContainer.classList.remove("hidden");
        switchTab("dashboard");
    });

    document.getElementById("btn-auth-back").addEventListener("click", () => {
        userAppContainer.classList.add("hidden");
        landingScreen.classList.remove("hidden");
    });

    document.getElementById("btn-admin-logout").addEventListener("click", () => {
        adminAppContainer.classList.add("hidden");
        landingScreen.classList.remove("hidden");
    });

    function showUserScreen(screenName) {
        document.getElementById("user-auth-screen").classList.remove("active");
        document.getElementById("user-home-screen").classList.remove("active");

        if (screenName === "auth") {
            document.getElementById("user-auth-screen").classList.add("active");
        } else if (screenName === "home") {
            document.getElementById("user-home-screen").classList.add("active");
            showAndroidTab("ticket");
        }
    }

    // -------------------------------------------------------------
    // USER SIDE (ANDROID UI): AUTHENTICATION
    // -------------------------------------------------------------
    const tabLoginBtn = document.getElementById("tab-login-btn");
    const tabRegisterBtn = document.getElementById("tab-register-btn");
    const loginForm = document.getElementById("user-login-form");
    const registerForm = document.getElementById("user-register-form");

    tabLoginBtn.addEventListener("click", () => {
        tabLoginBtn.classList.add("active");
        tabRegisterBtn.classList.remove("active");
        loginForm.classList.add("active");
        registerForm.classList.remove("active");
    });

    tabRegisterBtn.addEventListener("click", () => {
        tabRegisterBtn.classList.add("active");
        tabLoginBtn.classList.remove("active");
        registerForm.classList.add("active");
        loginForm.classList.remove("active");
    });

    // Attendee Registration
    registerForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const name = document.getElementById("register-name").value.trim();
        const email = document.getElementById("register-email").value.trim();
        const password = document.getElementById("register-password").value;
        const ticketType = document.getElementById("register-ticket").value;

        if (password.length < 6) {
            showToast("Kata Sandi Pendek", "Kata sandi minimal 6 karakter.", "warning");
            return;
        }

        const generatedToken = generateUniqueToken(ticketType);

        if (state.useSupabase && supabase) {
            // Real sign up using Supabase Auth
            showToast("Mendaftarkan...", "Membuat akun auth di Supabase...", "info");
            try {
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: email,
                    password: password
                });

                if (authError) throw authError;

                const user = authData.user;
                if (!user) throw new Error("Registrasi gagal. Coba email lain.");

                // Insert into public profiles table
                showToast("Menyimpan Profil", "Membuat data tiket unik...", "info");
                const { error: profileError } = await supabase.from('profiles').insert([{
                    id: user.id,
                    name: name,
                    email: email,
                    ticket_type: ticketType,
                    ticket_token: generatedToken,
                    checked_in: false
                }]);

                if (profileError) throw profileError;

                showToast("Pendaftaran Berhasil", "Selamat! E-Tiket Anda telah siap.", "success");
                state.supabaseUser = user;
                state.currentUser = {
                    id: user.id,
                    name: name,
                    email: email,
                    ticketType: ticketType,
                    token: generatedToken,
                    checked_in: false,
                    check_in_time: null,
                    check_in_gate: null
                };

                // Move to home
                showUserScreen("home");
                updateUserTicketScreen();
                registerForm.reset();
                
            } catch (err) {
                console.error("SignUp error:", err);
                showToast("Pendaftaran Gagal", err.message, "error");
            }
        } else {
            // Simulated Register in Demo Mode
            const emailExists = state.participants.some(p => p.email.toLowerCase() === email.toLowerCase());
            if (emailExists) {
                showToast("Registrasi Gagal", "Email ini sudah terdaftar.", "error");
                return;
            }

            const newAttendee = {
                id: `local-${Date.now()}`,
                name: name,
                email: email,
                ticketType: ticketType,
                token: generatedToken,
                password: password,
                checked_in: false,
                check_in_time: null,
                check_in_gate: null
            };

            state.participants.push(newAttendee);
            saveLocalState();
            
            state.currentUser = newAttendee;
            showToast("Registrasi Demo Berhasil", "Masuk menggunakan simulasi database lokal.", "success");
            showUserScreen("home");
            updateUserTicketScreen();
            registerForm.reset();
            refreshAllUIs();
        }
    });

    // Attendee Login
    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const email = document.getElementById("login-email").value.trim();
        const password = document.getElementById("login-password").value;

        if (state.useSupabase && supabase) {
            showToast("Menghubungkan...", "Verifikasi akun di Supabase...", "info");
            try {
                const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                    email: email,
                    password: password
                });

                if (authError) throw authError;

                const user = authData.user;
                
                // Fetch profile
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('*')
                    .eq('id', user.id)
                    .single();

                if (profileError) throw profileError;

                state.supabaseUser = user;
                state.currentUser = {
                    id: profile.id,
                    name: profile.name,
                    email: profile.email,
                    ticketType: profile.ticket_type,
                    token: profile.ticket_token,
                    checked_in: profile.checked_in,
                    check_in_time: profile.check_in_time,
                    check_in_gate: p => p.check_in_gate || null
                };

                // Fetch full details
                state.currentUser.checked_in = profile.checked_in;
                state.currentUser.check_in_time = profile.check_in_time;
                state.currentUser.check_in_gate = profile.check_in_gate;

                showToast("Login Berhasil", `Selamat datang kembali, ${profile.name}!`, "success");
                showUserScreen("home");
                updateUserTicketScreen();
                loginForm.reset();

                // Start live sync to this specific user ticket
                subscribeToRealtimeDatabase();

            } catch (err) {
                console.error("Login error:", err);
                showToast("Login Gagal", "Email atau password salah / Database offline.", "error");
            }
        } else {
            // Simulated login in Demo Mode
            const attendee = state.participants.find(p => p.email.toLowerCase() === email.toLowerCase() && p.password === password);
            
            if (attendee) {
                state.currentUser = attendee;
                showToast("Login Berhasil (Demo)", `Selamat datang, ${attendee.name}!`, "success");
                showUserScreen("home");
                updateUserTicketScreen();
                loginForm.reset();
            } else {
                showToast("Login Gagal", "Akun demo tidak ditemukan. Gunakan daftar terlebih dahulu.", "error");
            }
        }
    });

    // Logout attendee
    const logoutHandler = () => {
        state.currentUser = null;
        state.supabaseUser = null;
        showUserScreen("auth");
        showToast("Logged Out", "Anda telah keluar dari aplikasi peserta.", "info");
    };

    document.getElementById("btn-user-logout").addEventListener("click", logoutHandler);
    document.getElementById("btn-logout-profile").addEventListener("click", logoutHandler);

    // -------------------------------------------------------------
    // USER SIDE (ANDROID UI): DISPLAY E-TICKET & PROFILE
    // -------------------------------------------------------------
    function updateUserTicketScreen() {
        if (!state.currentUser) return;

        const user = state.currentUser;

        // 1. Update Home tab
        document.getElementById("user-display-name").innerText = user.name;
        document.getElementById("user-ticket-type").innerText = user.ticketType;
        document.getElementById("user-ticket-type").style.backgroundColor = getTicketColor(user.ticketType);
        document.getElementById("user-ticket-token").innerText = user.token;

        const statusCard = document.getElementById("user-checkin-status-card");
        const gateBox = document.getElementById("user-gate-info-box");

        // Use correct field name checked_in or checkedIn
        const isCheckedIn = user.checked_in || user.checkedIn || user.checkInTime !== null;
        const checkinGate = user.check_in_gate || user.checkInGate;
        const checkinTime = user.check_in_time || user.checkInTime;

        if (isCheckedIn) {
            statusCard.className = "ticket-status-pill status-scanned";
            statusCard.innerHTML = `<i data-lucide="check-circle" class="icon-sm"></i> <span id="user-checkin-status-text">Sudah Hadir</span>`;
            
            if (checkinGate) {
                gateBox.classList.remove("hidden");
                document.getElementById("user-gate-label").innerText = checkinGate;
            }
        } else {
            statusCard.className = "ticket-status-pill status-unscanned";
            statusCard.innerHTML = `<i data-lucide="clock" class="icon-sm"></i> <span id="user-checkin-status-text">Belum Hadir</span>`;
            gateBox.classList.add("hidden");
        }
        
        // Re-compile Lucide Icons for the newly added HTML elements
        lucide.createIcons();

        // Render QR Code canvas
        const qrContainer = document.getElementById("user-qr-renderer");
        qrContainer.innerHTML = "";
        setTimeout(() => {
            new QRCode(qrContainer, {
                text: user.token,
                width: 132,
                height: 132,
                colorDark: "#0f172a",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.M
            });
        }, 50);

        // 2. Update Profile tab
        const initials = user.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();
        document.getElementById("user-profile-avatar").innerText = initials;
        document.getElementById("user-profile-name").innerText = user.name;
        document.getElementById("user-profile-email").innerText = user.email;

        document.getElementById("profile-token-val").innerText = user.token;
        document.getElementById("profile-type-val").innerText = `${user.ticketType} Ticket`;
        
        const profileStatus = document.getElementById("profile-status-val");
        const profileTimeVal = document.getElementById("profile-time-val");

        if (isCheckedIn) {
            profileStatus.innerText = "Sudah Check-in";
            profileStatus.className = "profile-val text-success";
            profileTimeVal.innerText = `${checkinTime} (${checkinGate || "Gate"})`;
        } else {
            profileStatus.innerText = "Belum Check-in";
            profileStatus.className = "profile-val text-warning";
            profileTimeVal.innerText = "-";
        }

        lucide.createIcons();
    }

    // Tab switcher bottom nav
    const androidNavItems = document.querySelectorAll(".android-nav-item");
    androidNavItems.forEach(item => {
        item.addEventListener("click", () => {
            const activeTab = item.getAttribute("data-android-tab");
            showAndroidTab(activeTab);
        });
    });

    function showAndroidTab(tabName) {
        androidNavItems.forEach(i => i.classList.remove("active"));
        document.querySelector(`.android-nav-item[data-android-tab="${tabName}"]`).classList.add("active");

        document.querySelectorAll(".android-tab-content").forEach(c => c.classList.remove("active"));
        document.getElementById(`android-tab-${tabName}`).classList.add("active");
        
        if (tabName === "ticket") {
            updateUserTicketScreen();
        }
    }

    // -------------------------------------------------------------
    // ADMIN SIDE: CORE REFRESH FUNCTIONS & VIEWS
    // -------------------------------------------------------------
    const menuItems = document.querySelectorAll(".menu-item");
    const tabPanes = document.querySelectorAll(".tab-pane");
    const pageTitle = document.getElementById("page-title");
    const pageSubtitle = document.getElementById("page-subtitle");

    const tabMeta = {
        dashboard: { title: "Dashboard Overview", subtitle: "Real-time event analytics and simulation diagnostics." },
        registration: { title: "Registrasi & Impor Peserta", subtitle: "Manage participant database and CSV uploads." },
        qrcode: { title: "Generate QR Code Unik", subtitle: "Generate, view, and print unique attendee QR tickets." },
        scanner: { title: "Scanner & Validasi Tiket", subtitle: "Fast scanning simulation via webcam or click controls." },
        reports: { title: "Laporan & Export Kehadiran", subtitle: "View complete check-in history log and export files." }
    };

    menuItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.preventDefault();
            switchTab(item.getAttribute("data-tab"));
        });
    });

    function switchTab(tabId) {
        state.activeTab = tabId;
        menuItems.forEach(i => i.classList.remove("active"));
        tabPanes.forEach(p => p.classList.remove("active"));

        document.querySelector(`.menu-item[data-tab="${tabId}"]`).classList.add("active");
        document.getElementById(`${tabId}-tab`).classList.add("active");

        pageTitle.innerText = tabMeta[tabId].title;
        pageSubtitle.innerText = tabMeta[tabId].subtitle;

        if (tabId === "dashboard") {
            setTimeout(updateCharts, 100);
        } else if (tabId !== "scanner") {
            stopWebcam();
        }

        if (tabId === "qrcode") {
            renderParticipantSelectorList();
        }
    }

    // -------------------------------------------------------------
    // ADMIN SIDE: FEATURE 1 (REGISTRATION & CSV IMPORT)
    // -------------------------------------------------------------
    const manualRegForm = document.getElementById("manual-reg-form");
    manualRegForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        const name = document.getElementById("reg-name").value.trim();
        const email = document.getElementById("reg-email").value.trim();
        const ticketType = document.getElementById("reg-ticket").value;

        // Check duplicate email in local memory cache
        const emailExists = state.participants.some(p => p.email.toLowerCase() === email.toLowerCase());
        if (emailExists) {
            showToast("Registration Failed", `Email ${email} is already registered.`, "error");
            return;
        }

        const generatedToken = generateUniqueToken(ticketType);

        if (state.useSupabase && supabase) {
            showToast("Menyimpan...", "Menyimpan ke database Supabase...", "info");
            try {
                // Since manual registrations are done by admins, they insert directly into profiles.
                // We'll create a random UUID for the profile (since it's not linked to a real user login)
                const tempId = '00000000-0000-0000-0000-' + Math.floor(Math.random()*1000000000000).toString().padStart(12, '0');
                const { error } = await supabase.from('profiles').insert([{
                    id: tempId,
                    name: name,
                    email: email,
                    ticket_type: ticketType,
                    ticket_token: generatedToken,
                    checked_in: false
                }]);

                if (error) throw error;
                showToast("Peserta Terdaftar", `${name} berhasil disimpan di database.`, "success");
                manualRegForm.reset();
                fetchDatabaseData();
            } catch (err) {
                console.error("Insert error:", err);
                showToast("Registrasi Gagal", err.message, "error");
            }
        } else {
            // Local fallback
            const newParticipant = {
                id: `local-${Date.now()}`,
                name: name,
                email: email,
                ticketType: ticketType,
                token: generatedToken,
                checked_in: false,
                check_in_time: null,
                check_in_gate: null
            };
            state.participants.push(newParticipant);
            saveLocalState();
            showToast("Peserta Terdaftar", `${name} has been added successfully.`, "success");
            manualRegForm.reset();
            refreshAllUIs();
        }
    });

    // CSV Import Handler
    const selectCsvBtn = document.getElementById("select-csv-btn");
    const csvFileInput = document.getElementById("csv-file-input");
    const csvDropzone = document.getElementById("csv-dropzone");

    selectCsvBtn.addEventListener("click", () => csvFileInput.click());
    csvFileInput.addEventListener("change", handleCsvUpload);

    csvDropzone.addEventListener("dragover", (e) => {
        e.preventDefault();
        csvDropzone.classList.add("dragover");
    });

    csvDropzone.addEventListener("dragleave", () => csvDropzone.classList.remove("dragover"));
    csvDropzone.addEventListener("drop", (e) => {
        e.preventDefault();
        csvDropzone.classList.remove("dragover");
        if (e.dataTransfer.files.length > 0) {
            csvFileInput.files = e.dataTransfer.files;
            handleCsvUpload();
        }
    });

    function handleCsvUpload() {
        const file = csvFileInput.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            parseAndImportCsv(e.target.result);
        };
        reader.readAsText(file);
    }

    async function parseAndImportCsv(text) {
        const lines = text.split("\n");
        let newEntries = [];
        
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;
            
            const columns = line.split(/[,;\t]/);
            if (columns.length >= 2) {
                const name = columns[0].replace(/['"]/g, "").trim();
                const email = columns[1].replace(/['"]/g, "").trim();
                const ticketType = columns[2] ? columns[2].replace(/['"]/g, "").trim() : "Regular";
                
                if (email.includes("@") && !state.participants.some(p => p.email.toLowerCase() === email.toLowerCase())) {
                    newEntries.push({
                        id: '00000000-0000-0000-0000-' + Math.floor(Math.random()*1000000000000 + i).toString().padStart(12, '0'),
                        name: name,
                        email: email,
                        ticket_type: ["Regular", "VIP", "VVIP"].includes(ticketType) ? ticketType : "Regular",
                        ticket_token: generateUniqueToken(ticketType),
                        checked_in: false
                    });
                }
            }
        }

        if (newEntries.length === 0) {
            // Mock random seed if file parse yields nothing
            const mockImportNames = [
                { name: "Mega Utami", email: "mega.u@yahoo.com", type: "Regular" },
                { name: "Dani Wardhana", email: "dani.w@outlook.com", type: "VIP" },
                { name: "Novi Lestari", email: "novi.l@office.com", type: "VIP" }
            ];

            mockImportNames.forEach((item, index) => {
                if (!state.participants.some(p => p.email.toLowerCase() === item.email.toLowerCase())) {
                    newEntries.push({
                        id: '00000000-0000-0000-0000-' + Math.floor(Math.random()*1000000000000 + index).toString().padStart(12, '0'),
                        name: item.name,
                        email: item.email,
                        ticket_type: item.type,
                        ticket_token: generateUniqueToken(item.type),
                        checked_in: false
                    });
                }
            });
        }

        if (state.useSupabase && supabase) {
            showToast("Mengunggah...", `Mengunggah ${newEntries.length} peserta ke database Supabase...`, "info");
            try {
                const { error } = await supabase.from('profiles').insert(newEntries);
                if (error) throw error;
                showToast("Impor Berhasil", `Berhasil memasukkan ${newEntries.length} peserta baru.`, "success");
                fetchDatabaseData();
            } catch (err) {
                console.error("Supabase import CSV error:", err);
                showToast("Gagal Impor DB", err.message, "error");
            }
        } else {
            // Local fallback
            newEntries.forEach(e => {
                state.participants.push({
                    id: e.id,
                    name: e.name,
                    email: e.email,
                    ticketType: e.ticket_type,
                    token: e.ticket_token,
                    checked_in: false,
                    check_in_time: null,
                    check_in_gate: null
                });
            });
            saveLocalState();
            showToast("Impor Sukses (Lokal)", `Berhasil mengimpor ${newEntries.length} data peserta baru.`, "success");
            refreshAllUIs();
        }
    }

    // Reset Table Database Button
    document.getElementById("clear-all-db-btn").addEventListener("click", async () => {
        if (confirm("Apakah Anda yakin ingin menghapus seluruh database peserta dan log check-in?")) {
            if (state.useSupabase && supabase) {
                showToast("Menghapus...", "Membersihkan seluruh baris tabel di Supabase...", "info");
                try {
                    // Delete logs first due to possible relationship (if any)
                    const { error: logsError } = await supabase.from('check_in_logs').delete().neq('id', 0);
                    if (logsError) throw logsError;

                    const { error: profilesError } = await supabase.from('profiles').delete().neq('email', 'admin-prevent-empty@email.com');
                    if (profilesError) throw profilesError;

                    showToast("Database Direset", "Tabel Supabase telah dikosongkan.", "success");
                    fetchDatabaseData();
                } catch (err) {
                    console.error("Truncate tables error:", err);
                    showToast("Gagal Reset Database", err.message, "error");
                }
            } else {
                state.participants = [];
                state.checkInLogs = [];
                state.offlineQueue = [];
                saveLocalState();
                showToast("Database Direset", "Semua data lokal telah dibersihkan.", "warning");
                refreshAllUIs();
            }
        }
    });

    function renderParticipantsTable() {
        const tbody = document.getElementById("participants-table-body");
        const searchVal = document.getElementById("participant-search").value.toLowerCase();
        
        const filtered = state.participants.filter(p => 
            p.name.toLowerCase().includes(searchVal) || 
            p.email.toLowerCase().includes(searchVal) || 
            p.token.toLowerCase().includes(searchVal)
        );

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty-state">
                        <i data-lucide="search-code"></i>
                        <p>Peserta tidak ditemukan.</p>
                    </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }

        tbody.innerHTML = filtered.map(p => {
            const hasChecked = p.checked_in === true || p.checkInTime !== null;
            const checkInStatus = hasChecked 
                ? `<span class="status-pill success"><i data-lucide="check" class="icon-sm"></i> Hadir</span>` 
                : `<span class="status-pill warning"><i data-lucide="clock" class="icon-sm"></i> Belum Hadir</span>`;

            return `
                <tr>
                    <td><span class="font-mono text-accent">${p.token}</span></td>
                    <td class="font-semibold text-white">${p.name}</td>
                    <td>${p.email}</td>
                    <td><span class="badge" style="background-color: ${getTicketColor(p.ticketType, true)}; color: ${getTicketColor(p.ticketType)}">${p.ticketType}</span></td>
                    <td>
                        <button class="btn btn-secondary btn-sm btn-icon show-qr-shortcut" data-token="${p.token}">
                            <i data-lucide="qr-code"></i> Tampilkan
                        </button>
                    </td>
                    <td>${checkInStatus}</td>
                </tr>
            `;
        }).join("");

        lucide.createIcons();

        // Attach action shortcut clicks
        tbody.querySelectorAll(".show-qr-shortcut").forEach(btn => {
            btn.addEventListener("click", () => {
                const token = btn.getAttribute("data-token");
                viewParticipantQR(token);
            });
        });
    }

    document.getElementById("participant-search").addEventListener("input", renderParticipantsTable);

    function getTicketColor(type, isGlow = false) {
        if (type === "VVIP") return isGlow ? "rgba(244, 63, 94, 0.15)" : "#f43f5e";
        if (type === "VIP") return isGlow ? "rgba(99, 102, 241, 0.15)" : "#6366f1";
        return isGlow ? "rgba(16, 185, 129, 0.15)" : "#10b981";
    }

    // -------------------------------------------------------------
    // ADMIN SIDE: FEATURE 2 (QR GENERATION & DETAILS TICKET)
    // -------------------------------------------------------------
    function renderParticipantSelectorList() {
        const listContainer = document.getElementById("participant-selector-list");
        const searchInput = document.getElementById("qr-search-input").value.toLowerCase();
        
        const filtered = state.participants.filter(p => 
            p.name.toLowerCase().includes(searchInput) || 
            p.email.toLowerCase().includes(searchInput)
        );

        if (filtered.length === 0) {
            listContainer.innerHTML = `
                <div class="empty-selector-state">
                    <p>Peserta tidak ditemukan.</p>
                </div>
            `;
            return;
        }

        listContainer.innerHTML = filtered.map(p => `
            <div class="selector-item" data-token="${p.token}">
                <div class="selector-info">
                    <span class="selector-name">${p.name}</span>
                    <span class="selector-email">${p.email}</span>
                </div>
                <span class="badge" style="background-color: ${getTicketColor(p.ticketType, true)}; color: ${getTicketColor(p.ticketType)}">${p.ticketType}</span>
            </div>
        `).join("");

        listContainer.querySelectorAll(".selector-item").forEach(item => {
            item.addEventListener("click", () => {
                listContainer.querySelectorAll(".selector-item").forEach(i => i.classList.remove("active"));
                item.classList.add("active");
                renderTicketDetails(item.getAttribute("data-token"));
            });
        });
    }

    document.getElementById("qr-search-input").addEventListener("input", renderParticipantSelectorList);

    function viewParticipantQR(token) {
        switchTab("qrcode");
        renderParticipantSelectorList();
        
        const items = document.querySelectorAll(".selector-item");
        items.forEach(item => {
            if (item.getAttribute("data-token") === token) {
                item.classList.add("active");
                item.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            } else {
                item.classList.remove("active");
            }
        });

        renderTicketDetails(token);
    }

    function renderTicketDetails(token) {
        const participant = state.participants.find(p => p.token === token);
        if (!participant) return;

        document.getElementById("qr-empty-display").classList.add("hidden");
        const ticketContent = document.getElementById("qr-ticket-content");
        ticketContent.classList.remove("hidden");

        document.getElementById("ticket-badge-category").innerText = participant.ticketType;
        document.getElementById("ticket-badge-category").style.backgroundColor = getTicketColor(participant.ticketType);
        
        document.getElementById("ticket-participant-name").innerText = participant.name;
        document.getElementById("ticket-participant-email").innerText = participant.email;
        document.getElementById("ticket-participant-token").innerText = participant.token;

        const statusLabel = document.getElementById("ticket-participant-status");
        const isChecked = participant.checked_in === true || participant.checkInTime !== null;
        const gate = participant.check_in_gate || participant.checkInGate;

        if (isChecked) {
            statusLabel.innerText = `HADIR (${gate || "Gate"})`;
            statusLabel.style.color = "#10b981";
        } else {
            statusLabel.innerText = "ACTIVE / BELUM MASUK";
            statusLabel.style.color = "#6366f1";
        }

        const qrContainer = document.getElementById("ticket-qr-renderer");
        qrContainer.innerHTML = "";
        setTimeout(() => {
            new QRCode(qrContainer, {
                text: participant.token,
                width: 116,
                height: 116,
                colorDark: "#0f172a",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
        }, 50);

        document.getElementById("print-ticket-btn").onclick = () => window.print();

        const sendBtn = document.getElementById("use-scanner-shortcut-btn");
        sendBtn.onclick = () => {
            switchTab("scanner");
            const tokenInput = document.getElementById("sim-token-input");
            tokenInput.value = participant.token;
            tokenInput.focus();
            showToast("Scanner Ready", `Token ${participant.token} dimasukkan ke scanner simulator. Klik 'Scan Token' untuk memproses.`, "info");
        };
    }

    // -------------------------------------------------------------
    // ADMIN SIDE: FEATURE 3 (SCAN & VALIDASI TIKET)
    // -------------------------------------------------------------
    const simSubmitBtn = document.getElementById("sim-submit-btn");
    const simTokenInput = document.getElementById("sim-token-input");

    simSubmitBtn.addEventListener("click", () => {
        const token = simTokenInput.value.trim();
        if (!token) {
            showToast("Input Empty", "Silakan masukkan token tiket terlebih dahulu.", "warning");
            return;
        }
        processCheckInScan(token);
        simTokenInput.value = "";
    });

    simTokenInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") simSubmitBtn.click();
    });

    function renderQuickPickList() {
        const grid = document.getElementById("sim-quick-pick-list");
        if (state.participants.length === 0) {
            grid.innerHTML = `<div class="empty-state">Belum ada peserta terdaftar.</div>`;
            return;
        }

        grid.innerHTML = state.participants.map(p => {
            const badgeColor = getTicketColor(p.ticketType);
            const badgeBg = getTicketColor(p.ticketType, true);

            return `
                <button class="btn-quick-pick" data-token="${p.token}">
                    <span class="quick-pick-name">${p.name}</span>
                    <span class="quick-pick-token">${p.token}</span>
                    <span class="quick-pick-badge" style="color: ${badgeColor}; background-color: ${badgeBg}">${p.ticketType}</span>
                </button>
            `;
        }).join("");

        grid.querySelectorAll(".btn-quick-pick").forEach(btn => {
            btn.addEventListener("click", () => {
                processCheckInScan(btn.getAttribute("data-token"));
            });
        });
    }

    // Core Scanner Logic (updates Supabase in real-time)
    async function processCheckInScan(token) {
        if (state.scannedThrottle) return;
        state.scannedThrottle = true;
        setTimeout(() => state.scannedThrottle = false, 1500);

        const currentTime = new Date().toLocaleTimeString("id-ID", { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const currentDate = new Date().toLocaleDateString("id-ID", { day: 'numeric', month: 'short' });
        const timeString = `${currentDate}, ${currentTime}`;

        const activeGate = state.selectedGate;

        // Smartphone simulator feedback viewports
        const phoneResult = document.getElementById("phone-scan-result");
        const phoneIconTag = document.getElementById("phone-result-icon-tag");
        const phoneTitle = document.getElementById("phone-result-title");
        const phoneDesc = document.getElementById("phone-result-desc");

        phoneResult.className = "phone-result-card";

        // Query participant details
        const participant = state.participants.find(p => p.token === token);

        // 1. INVALID CODE ERROR
        if (!participant) {
            playSound("error");
            phoneResult.classList.add("error");
            phoneIconTag.setAttribute("data-lucide", "shield-alert");
            phoneTitle.innerText = "Tiket Tidak Valid";
            phoneDesc.innerText = `Token: ${token.substring(0, 12)}...`;
            lucide.createIcons();

            if (state.useSupabase && supabase) {
                // Log failed scan directly to Supabase
                await supabase.from('check_in_logs').insert([{
                    participant_name: "TIKET INVALID",
                    ticket_token: token,
                    gate: activeGate,
                    status: "ERROR",
                    details: `Token '${token}' tidak terdaftar di database.`
                }]);
            } else {
                addLog(timeString, "TIKET INVALID", token, activeGate, "ERROR", `Token '${token}' tidak terdaftar di sistem.`);
            }
            showToast("Scan Error", "Tiket tidak terdaftar di database peserta.", "error");
            refreshAllUIs();
            return;
        }

        const isChecked = participant.checked_in === true || participant.checkInTime !== null;
        const isOfflineDuplicate = state.offlineQueue.some(item => item.token === token);

        // 2. DUPLICATE CHECK-IN DETECTION
        if (isChecked || isOfflineDuplicate) {
            const prevGate = participant.check_in_gate || participant.checkInGate || activeGate;
            const prevTime = participant.check_in_time || participant.checkInTime || "Baru saja";

            playSound("duplicate");
            phoneResult.classList.add("duplicate");
            phoneIconTag.setAttribute("data-lucide", "alert-triangle");
            phoneTitle.innerText = "Tiket Duplikat!";
            phoneDesc.innerText = `${participant.name} (${prevGate})`;
            lucide.createIcons();

            if (state.useSupabase && supabase) {
                await supabase.from('check_in_logs').insert([{
                    participant_name: participant.name,
                    ticket_token: token,
                    gate: activeGate,
                    status: "DUPLICATE",
                    details: `BLOCKED: Tiket sudah masuk di ${prevGate} pada ${prevTime}.`
                }]);
            } else {
                addLog(timeString, participant.name, token, activeGate, "DUPLICATE", `BLOCKED: Tiket sudah masuk di ${prevGate} pada ${prevTime}.`);
            }
            showToast("Duplikasi Terdeteksi", `Tiket ${participant.name} sudah digunakan sebelumnya!`, "error");
            refreshAllUIs();
            return;
        }

        // 3. OFFLINE SCANNER MODE (caching)
        if (!state.isOnline) {
            playSound("success");
            phoneResult.classList.add("success");
            phoneIconTag.setAttribute("data-lucide", "cloud-lightning");
            phoneTitle.innerText = "Cached Offline";
            phoneDesc.innerText = `${participant.name} (${participant.ticketType})`;
            lucide.createIcons();

            state.offlineQueue.push({
                id: participant.id,
                name: participant.name,
                token: token,
                gate: activeGate,
                time: timeString
            });

            participant.checkInTime = timeString;
            participant.checkInGate = activeGate;
            participant.checked_in = true;

            saveLocalState();
            addLog(timeString, participant.name, token, activeGate, "OFFLINE", `Tersimpan di cache offline gerbang.`);
            showToast("Offline Check-in Cached", `${participant.name} terdaftar offline di cache.`, "warning");
            updatePendingSyncBadge();
            refreshAllUIs();
            return;
        }

        // 4. ONLINE CHECK-IN (direct Supabase write)
        playSound("success");
        phoneResult.classList.add("success");
        phoneIconTag.setAttribute("data-lucide", "user-check");
        phoneTitle.innerText = "Check-in Berhasil";
        phoneDesc.innerText = `${participant.name} (${participant.ticketType})`;
        lucide.createIcons();

        if (state.useSupabase && supabase) {
            try {
                // Update profile record checked_in status in Supabase
                const { error: profileError } = await supabase
                    .from('profiles')
                    .update({
                        checked_in: true,
                        check_in_time: timeString,
                        check_in_gate: activeGate
                    })
                    .eq('ticket_token', token);

                if (profileError) throw profileError;

                // Log details to check_in_logs table
                const { error: logError } = await supabase.from('check_in_logs').insert([{
                    participant_name: participant.name,
                    ticket_token: token,
                    gate: activeGate,
                    status: "SUCCESS",
                    details: `Berhasil masuk lewat ${activeGate}.`
                }]);

                if (logError) throw logError;

                // Fetch new data to sync local UI
                fetchDatabaseData();
            } catch (err) {
                console.error("Check-in Supabase error:", err);
                showToast("Database Write Error", "Gagal menyimpan check-in ke Supabase.", "error");
            }
        } else {
            // Local Mode Write
            participant.checkInTime = timeString;
            participant.checkInGate = activeGate;
            participant.checked_in = true;
            
            saveLocalState();
            addLog(timeString, participant.name, token, activeGate, "SUCCESS", `Berhasil masuk lewat ${activeGate}.`);
            showToast("Check-in Berhasil", `${participant.name} Checked-in di ${activeGate}.`, "success");
            refreshAllUIs();
        }
    }

    function addLog(time, name, token, gate, status, details) {
        state.checkInLogs.unshift({
            time: time,
            name: name,
            token: token,
            gate: gate,
            status: status,
            details: details
        });
        saveLocalState();
    }

    function renderDashboardFeed() {
        const feedList = document.getElementById("dashboard-feed-list");
        if (state.checkInLogs.length === 0) {
            feedList.innerHTML = `
                <div class="empty-feed-state">
                    <i data-lucide="activity"></i>
                    <p>Belum ada aktivitas masuk. Jalankan scan untuk melihat data di sini.</p>
                </div>
            `;
            lucide.createIcons();
            return;
        }

        const visibleLogs = state.checkInLogs.slice(0, 5);
        feedList.innerHTML = visibleLogs.map(log => {
            let feedClass = "feed-success";
            if (log.status === "DUPLICATE" || log.status === "ERROR") feedClass = "feed-danger";
            if (log.status === "OFFLINE") feedClass = "feed-warning";

            const initials = log.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase();

            return `
                <div class="feed-item ${feedClass}">
                    <div class="feed-avatar">${initials}</div>
                    <div class="feed-body">
                        <div class="feed-meta">
                            <span class="feed-name">${log.name}</span>
                            <span class="feed-time">${log.time.split(",")[1] || log.time}</span>
                        </div>
                        <p class="feed-msg">
                            <span class="feed-token">${log.token}</span>
                            ${log.details}
                        </p>
                    </div>
                </div>
            `;
        }).join("");
    }

    function renderReportsTable() {
        const tbody = document.getElementById("reports-table-body");
        const filterGate = document.getElementById("filter-gate").value;
        const filterStatus = document.getElementById("filter-status").value;
        const filterSearch = document.getElementById("filter-search").value.toLowerCase();

        const filtered = state.checkInLogs.filter(log => {
            const matchesGate = filterGate === "ALL" || log.gate === filterGate;
            
            let matchesStatus = true;
            if (filterStatus !== "ALL") {
                if (filterStatus === "SUCCESS") matchesStatus = log.status === "SUCCESS";
                if (filterStatus === "DUPLICATE") matchesStatus = log.status === "DUPLICATE";
                if (filterStatus === "OFFLINE") matchesStatus = log.status === "OFFLINE";
            }

            const matchesSearch = 
                log.name.toLowerCase().includes(filterSearch) || 
                log.token.toLowerCase().includes(filterSearch) || 
                log.details.toLowerCase().includes(filterSearch);

            return matchesGate && matchesStatus && matchesSearch;
        });

        if (filtered.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="table-empty-state">
                        <i data-lucide="filter-x"></i>
                        <p>Tidak ada log check-in yang sesuai filter.</p>
                    </td>
                </tr>
            `;
            lucide.createIcons();
            return;
        }

        tbody.innerHTML = filtered.map(log => {
            let statusBadge = "";
            let netBadge = "";

            if (log.status === "SUCCESS") {
                statusBadge = `<span class="status-pill success"><i data-lucide="check" class="icon-sm"></i> Valid</span>`;
                netBadge = `<span class="status-pill info"><i data-lucide="wifi" class="icon-sm"></i> Online Sync</span>`;
            } else if (log.status === "DUPLICATE") {
                statusBadge = `<span class="status-pill danger"><i data-lucide="alert-triangle" class="icon-sm"></i> Blocked (Duplikat)</span>`;
                netBadge = `<span class="status-pill info"><i data-lucide="wifi" class="icon-sm"></i> Online Sync</span>`;
            } else if (log.status === "OFFLINE") {
                statusBadge = `<span class="status-pill success"><i data-lucide="check" class="icon-sm"></i> Valid</span>`;
                netBadge = `<span class="status-pill warning"><i data-lucide="cloud-off" class="icon-sm"></i> Offline Cache</span>`;
            } else {
                statusBadge = `<span class="status-pill danger"><i data-lucide="x" class="icon-sm"></i> Invalid</span>`;
                netBadge = `<span class="status-pill info"><i data-lucide="wifi" class="icon-sm"></i> Online Sync</span>`;
            }

            return `
                <tr>
                    <td class="font-mono text-muted">${log.time}</td>
                    <td><div class="font-semibold text-white">${log.name}</div></td>
                    <td><span class="font-mono text-accent">${log.token}</span></td>
                    <td><span class="font-semibold">${log.gate}</span></td>
                    <td>${statusBadge}</td>
                    <td>${netBadge}</td>
                </tr>
            `;
        }).join("");

        lucide.createIcons();
    }

    // Attach reporting filter triggers
    document.getElementById("filter-gate").addEventListener("change", renderReportsTable);
    document.getElementById("filter-status").addEventListener("change", renderReportsTable);
    document.getElementById("filter-search").addEventListener("input", renderReportsTable);
    document.getElementById("reset-filters-btn").addEventListener("click", () => {
        document.getElementById("filter-gate").value = "ALL";
        document.getElementById("filter-status").value = "ALL";
        document.getElementById("filter-search").value = "";
        renderReportsTable();
    });

    // -------------------------------------------------------------
    // ADMIN SIDE: FEATURE 5 (OFFLINE MODE & AUTO-SYNC)
    // -------------------------------------------------------------
    const networkToggle = document.getElementById("network-toggle");
    const globalStatusDot = document.getElementById("global-status-dot");
    const globalStatusText = document.getElementById("global-status-text");
    const phoneWifiIcon = document.getElementById("phone-wifi-icon");

    networkToggle.checked = !state.isOnline;
    updateNetworkStatusUI();

    networkToggle.addEventListener("change", (e) => {
        state.isOnline = !e.target.checked;
        saveLocalState();
        updateNetworkStatusUI();
        
        if (state.isOnline) {
            processOfflineSync();
        } else {
            showToast("Offline Mode Aktif", "Check-in akan tersimpan di cache browser dan disinkronisasi saat online.", "warning");
        }
    });

    function updateNetworkStatusUI() {
        if (state.isOnline) {
            globalStatusDot.className = "status-indicator-dot online";
            globalStatusText.innerText = "Online Mode";
            if (phoneWifiIcon) phoneWifiIcon.setAttribute("data-lucide", "wifi");
        } else {
            globalStatusDot.className = "status-indicator-dot offline";
            globalStatusText.innerText = "Offline Simulator";
            if (phoneWifiIcon) phoneWifiIcon.setAttribute("data-lucide", "wifi-off");
        }
        lucide.createIcons();
        updatePendingSyncBadge();
    }

    function updatePendingSyncBadge() {
        const badge = document.getElementById("pending-sync-badge");
        const countSpan = document.getElementById("pending-sync-count");
        
        if (state.offlineQueue.length > 0) {
            badge.classList.remove("hidden");
            countSpan.innerText = state.offlineQueue.length;
        } else {
            badge.classList.add("hidden");
        }
    }

    // Auto-Sync Algorithm for Supabase
    async function processOfflineSync() {
        if (state.offlineQueue.length === 0) return;

        showToast("Online Detected", "Menyinkronkan data check-in lokal ke server...", "info");
        const badge = document.getElementById("pending-sync-badge");
        badge.classList.add("syncing");

        const cachedQueue = [...state.offlineQueue];
        state.offlineQueue = []; // clear local queue
        saveLocalState();

        let syncSuccessCount = 0;
        let syncConflictCount = 0;

        for (const item of cachedQueue) {
            if (state.useSupabase && supabase) {
                try {
                    // Check if already checked in online
                    const { data: profile } = await supabase
                        .from('profiles')
                        .select('checked_in')
                        .eq('id', item.id)
                        .single();
                    
                    if (profile && profile.checked_in) {
                        // Conflict duplicate
                        await supabase.from('check_in_logs').insert([{
                            participant_name: item.name,
                            ticket_token: item.token,
                            gate: item.gate,
                            status: "DUPLICATE",
                            details: `SYNC CONFLICT: Tiket ganda disinkronkan dari offline.`
                        }]);
                        syncConflictCount++;
                    } else {
                        // Valid check-in sync
                        await supabase.from('profiles').update({
                            checked_in: true,
                            check_in_time: item.time,
                            check_in_gate: item.gate
                        }).eq('id', item.id);

                        await supabase.from('check_in_logs').insert([{
                            participant_name: item.name,
                            ticket_token: item.token,
                            gate: item.gate,
                            status: "SUCCESS",
                            details: `Sinkronisasi Berhasil dari ${item.gate}`
                        }]);
                        syncSuccessCount++;
                    }
                } catch (err) {
                    console.error("Offline sync error: ", err);
                    // Add back to queue on total network failure
                    state.offlineQueue.push(item);
                }
            } else {
                // Local sync
                const participant = state.participants.find(p => p.id === item.id);
                if (participant) {
                    participant.checked_in = true;
                    participant.checkInTime = item.time;
                    participant.checkInGate = item.gate;
                    addLog(item.time, participant.name, item.token, item.gate, "SUCCESS", `Sinkronisasi Berhasil dari ${item.gate}`);
                    syncSuccessCount++;
                }
            }
        }

        setTimeout(() => {
            badge.classList.remove("syncing");
            saveLocalState();
            updatePendingSyncBadge();
            
            if (syncSuccessCount > 0) {
                showToast("Sinkronisasi Selesai", `Berhasil menyinkronkan ${syncSuccessCount} check-in ke server.`, "success");
            }
            if (syncConflictCount > 0) {
                showToast("Konflik Ditemukan", `${syncConflictCount} check-in ditolak karena duplikasi tiket di server.`, "error");
            }

            if (state.useSupabase && supabase) {
                fetchDatabaseData();
            } else {
                refreshAllUIs();
            }
        }, 1200);
    }

    // -------------------------------------------------------------
    // ADMIN SIDE: MULTI GATE SETUP
    // -------------------------------------------------------------
    const activeGateSelect = document.getElementById("active-gate-select");
    const phoneGateLabel = document.getElementById("phone-gate-label");

    activeGateSelect.value = state.selectedGate;
    phoneGateLabel.innerText = state.selectedGate;

    activeGateSelect.addEventListener("change", (e) => {
        state.selectedGate = e.target.value;
        phoneGateLabel.innerText = state.selectedGate;
        saveLocalState();
        showToast("Gerbang Aktif Berubah", `Perangkat ini sekarang bertindak sebagai scanner di ${state.selectedGate}.`, "info");
        refreshAllUIs();
    });

    // -------------------------------------------------------------
    // ADMIN SIDE: WEBCAM CONTROLS (jsQR)
    // -------------------------------------------------------------
    const startWebcamBtn = document.getElementById("start-webcam-btn");
    const stopWebcamBtn = document.getElementById("stop-webcam-btn");
    const webcamPlaceholder = document.getElementById("webcam-placeholder-msg");
    const webcamVideoWrapper = document.getElementById("webcam-video-wrapper");
    const webcamVideo = document.getElementById("webcam-video");
    const webcamCanvas = document.getElementById("webcam-canvas");
    const canvasCtx = webcamCanvas.getContext("2d");

    let videoStream = null;
    let animationFrameId = null;

    const scanTabBtns = document.querySelectorAll(".scan-tab-btn");
    scanTabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            scanTabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const mode = btn.getAttribute("data-scan-mode");
            document.querySelectorAll(".scan-mode-content").forEach(c => c.classList.remove("active"));
            document.getElementById(`scan-mode-${mode}`).classList.add("active");

            if (mode !== "webcam") stopWebcam();
        });
    });

    startWebcamBtn.addEventListener("click", startWebcam);
    stopWebcamBtn.addEventListener("click", stopWebcam);

    // Camera compatibility / secure context check (mobile HTTP fallback support)
    const hasWebcamSupport = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
    const fallbackContainer = document.getElementById("camera-http-fallback-container");
    const fallbackInput = document.getElementById("camera-file-input");
    const fallbackBtn = document.getElementById("btn-camera-fallback");

    if (!hasWebcamSupport && fallbackContainer) {
        fallbackContainer.classList.remove("hidden");
        startWebcamBtn.style.display = "none"; // Hide live stream button since it is blocked
        const placeholderText = document.querySelector("#webcam-placeholder-msg p");
        if (placeholderText) {
            placeholderText.innerText = "Akses streaming kamera langsung diblokir oleh browser di koneksi HTTP (non-secure). Gunakan kamera foto di bawah ini sebagai fallback.";
        }
    }

    if (fallbackBtn && fallbackInput) {
        fallbackBtn.addEventListener("click", () => {
            fallbackInput.click();
        });

        fallbackInput.addEventListener("change", (e) => {
            const file = e.target.files[0];
            if (!file) return;

            showToast("Memproses Foto", "Menganalisis QR Code dari foto...", "info");

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const tempCanvas = document.createElement("canvas");
                    const tempCtx = tempCanvas.getContext("2d");
                    
                    // Downscale large phone pictures for fast decoding
                    const maxDim = 1000;
                    let w = img.width;
                    let h = img.height;
                    if (w > maxDim || h > maxDim) {
                        if (w > h) {
                            h = Math.round((h * maxDim) / w);
                            w = maxDim;
                        } else {
                            w = Math.round((w * maxDim) / h);
                            h = maxDim;
                        }
                    }
                    
                    tempCanvas.width = w;
                    tempCanvas.height = h;
                    tempCtx.drawImage(img, 0, 0, w, h);

                    try {
                        const imgData = tempCtx.getImageData(0, 0, w, h);
                        const code = jsQR(imgData.data, imgData.width, imgData.height, {
                            inversionAttempts: "dontInvert"
                        });

                        if (code) {
                            showToast("QR Terdeteksi", "Memproses check-in peserta...", "success");
                            processCheckInScan(code.data);
                        } else {
                            showToast("Gagal Membaca QR", "QR Code tidak terdeteksi. Pastikan foto fokus, tegak, dan memiliki pencahayaan yang baik.", "error");
                        }
                    } catch (err) {
                        console.error("jsQR process failed:", err);
                        showToast("Proses Gagal", "Gagal memproses gambar.", "error");
                    }
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
            fallbackInput.value = ""; // Reset file input
        });
    }

    function startWebcam() {
        if (!hasWebcamSupport) {
            showToast("Kamera Tidak Didukung", "Browser memblokir kamera streaming di situs non-HTTPS. Gunakan tombol HTTP Fallback di bawah.", "error");
            return;
        }
        navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } })
            .then(stream => {
                videoStream = stream;
                webcamVideo.srcObject = stream;
                webcamVideo.setAttribute("playsinline", true);
                webcamVideo.play();
                
                webcamPlaceholder.classList.add("hidden");
                webcamVideoWrapper.classList.remove("hidden");
                
                animationFrameId = requestAnimationFrame(tickWebcamScan);
                showToast("Webcam Aktif", "Scanner siap membaca kode QR.", "success");
            })
            .catch(err => {
                console.error("Webcam error: ", err);
                showToast("Gagal Membuka Kamera", "Kamera webcam tidak terdeteksi atau diblokir.", "error");
            });
    }

    function stopWebcam() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
        }
        webcamPlaceholder.classList.remove("hidden");
        webcamVideoWrapper.classList.add("hidden");
    }

    function tickWebcamScan() {
        if (webcamVideo.readyState === webcamVideo.HAVE_ENOUGH_DATA) {
            webcamCanvas.height = webcamVideo.videoHeight;
            webcamCanvas.width = webcamVideo.videoWidth;

            canvasCtx.drawImage(webcamVideo, 0, 0, webcamCanvas.width, webcamCanvas.height);
            
            const imageData = canvasCtx.getImageData(0, 0, webcamCanvas.width, webcamCanvas.height);
            const code = jsQR(imageData.data, imageData.width, imageData.height, {
                inversionAttempts: "dontInvert",
            });

            if (code) {
                drawQRBoundingBox(code.location);
                processCheckInScan(code.data);
            }
        }
        animationFrameId = requestAnimationFrame(tickWebcamScan);
    }

    function drawQRBoundingBox(location) {
        canvasCtx.lineWidth = 4;
        canvasCtx.strokeStyle = "#10b981";
        canvasCtx.beginPath();
        canvasCtx.moveTo(location.topLeftCorner.x, location.topLeftCorner.y);
        canvasCtx.lineTo(location.topRightCorner.x, location.topRightCorner.y);
        canvasCtx.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
        canvasCtx.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y);
        canvasCtx.closePath();
        canvasCtx.stroke();
    }

    // CSV & PDF Export Buttons
    document.getElementById("export-csv-btn").addEventListener("click", () => {
        if (state.checkInLogs.length === 0) {
            showToast("Export Failed", "Log check-in kosong, tidak ada data untuk diexport.", "warning");
            return;
        }

        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Waktu Check-in,Nama,Token,Gerbang,Status,Keterangan\n";

        state.checkInLogs.forEach(log => {
            csvContent += `"${log.time}","${log.name}","${log.token}","${log.gate}","${log.status}","${log.details}"\n`;
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `log_kehadiran_${Date.now()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("CSV Exported", "File CSV log kehadiran berhasil diunduh.", "success");
    });

    document.getElementById("export-pdf-btn").addEventListener("click", () => window.print());

    // Audio Cues global toggle
    const audioToggle = document.getElementById("audio-toggle");
    const audioIcon = document.getElementById("audio-icon");

    audioToggle.addEventListener("click", () => {
        state.soundEnabled = !state.soundEnabled;
        if (state.soundEnabled) {
            audioIcon.setAttribute("data-lucide", "volume-2");
            showToast("Suara Aktif", "Efek suara check-in diaktifkan.", "success");
            playSound("success");
        } else {
            audioIcon.setAttribute("data-lucide", "volume-x");
            showToast("Suara Dimatikan", "Efek suara dinonaktifkan.", "info");
        }
        lucide.createIcons();
    });



    // -------------------------------------------------------------
    // ADMIN SIDE: RESPONSIVE SIDEBAR TOGGLE
    // -------------------------------------------------------------
    const adminSidebar = document.getElementById("admin-sidebar");
    const adminSidebarOverlay = document.getElementById("admin-sidebar-overlay");
    const adminSidebarToggle = document.getElementById("admin-sidebar-toggle");
    const adminSidebarClose = document.getElementById("admin-sidebar-close");

    if (adminSidebarToggle && adminSidebar && adminSidebarOverlay) {
        adminSidebarToggle.addEventListener("click", () => {
            adminSidebar.classList.add("open");
            adminSidebarOverlay.classList.remove("hidden");
        });
    }

    const closeAdminSidebar = () => {
        if (adminSidebar) adminSidebar.classList.remove("open");
        if (adminSidebarOverlay) adminSidebarOverlay.classList.add("hidden");
    };

    if (adminSidebarClose) adminSidebarClose.addEventListener("click", closeAdminSidebar);
    if (adminSidebarOverlay) adminSidebarOverlay.addEventListener("click", closeAdminSidebar);

    // Close admin sidebar automatically when clicking navigation items on mobile
    const adminMenuItems = document.querySelectorAll("#admin-sidebar .menu-item");
    adminMenuItems.forEach(item => {
        item.addEventListener("click", closeAdminSidebar);
    });

    // -------------------------------------------------------------
    // INITIAL STARTUP PIPELINE
    // -------------------------------------------------------------
    async function startApp() {
        loadLocalState();
        await initSupabase();
        lucide.createIcons();
        initCharts();

        if (supabase) {
            fetchDatabaseData();
            subscribeToRealtimeDatabase();
        } else {
            refreshAllUIs();
        }
    }

    startApp();
});
