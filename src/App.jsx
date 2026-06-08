import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import LandingScreen from './components/LandingScreen';
import UserApp from './components/UserApp';
import AdminApp from './components/AdminApp';

// Web Audio API Sound Synthesizer Helper
export const playSound = (type, soundEnabled) => {
  if (!soundEnabled) return;
  try {
    const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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
  } catch (e) {
    console.warn("AudioContext failed to play sound:", e);
  }
};

let supabaseInstance = null;

export default function App() {
  const [role, setRole] = useState('landing'); // 'landing', 'user', 'admin'
  const [supabase, setSupabase] = useState(null);
  const [supabaseConfig, setSupabaseConfig] = useState({ url: '', key: '' });
  
  // App states
  const [participants, setParticipants] = useState([]);
  const [checkInLogs, setCheckInLogs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null); // Attendee profile
  const [supabaseUser, setSupabaseUser] = useState(null); // Auth user session
  
  // Settings (stored in localStorage)
  const [isOnline, setIsOnline] = useState(() => {
    try {
      const val = localStorage.getItem("qrevent_online");
      return val !== null ? JSON.parse(val) : true;
    } catch { return true; }
  });
  const [selectedGate, setSelectedGate] = useState(() => {
    return localStorage.getItem("qrevent_gate") || "Gate A (Laki-laki)";
  });
  const [soundEnabled, setSoundEnabled] = useState(() => {
    try {
      const val = localStorage.getItem("qrevent_sound");
      return val !== null ? JSON.parse(val) : true;
    } catch { return true; }
  });
  
  const [offlineQueue, setOfflineQueue] = useState(() => {
    try {
      const val = localStorage.getItem("qrevent_offline_queue");
      return val !== null ? JSON.parse(val) : [];
    } catch { return []; }
  });

  const [isSyncing, setIsSyncing] = useState(false);

  const [gatesList, setGatesList] = useState(() => {
    try {
      const val = localStorage.getItem("qrevent_gates_list");
      return val !== null ? JSON.parse(val) : [
        { id: "Gate A (Laki-laki)", name: "Gate A", type: "Laki-laki" },
        { id: "Gate A (Perempuan)", name: "Gate A", type: "Perempuan" },
        { id: "Gate B (Laki-laki)", name: "Gate B", type: "Laki-laki" },
        { id: "Gate B (Perempuan)", name: "Gate B", type: "Perempuan" },
        { id: "Gate C (Laki-laki)", name: "Gate C", type: "Laki-laki" },
        { id: "Gate C (Perempuan)", name: "Gate C", type: "Perempuan" }
      ];
    } catch {
      return [
        { id: "Gate A (Laki-laki)", name: "Gate A", type: "Laki-laki" },
        { id: "Gate A (Perempuan)", name: "Gate A", type: "Perempuan" },
        { id: "Gate B (Laki-laki)", name: "Gate B", type: "Laki-laki" },
        { id: "Gate B (Perempuan)", name: "Gate B", type: "Perempuan" },
        { id: "Gate C (Laki-laki)", name: "Gate C", type: "Laki-laki" },
        { id: "Gate C (Perempuan)", name: "Gate C", type: "Perempuan" }
      ];
    }
  });

  // Custom Toast System state
  const [toasts, setToasts] = useState([]);
  const showToast = (title, message, type = 'info') => {
    const id = Date.now() + Math.random().toString();
    setToasts(prev => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 4000);
  };

  // Persist options
  useEffect(() => {
    localStorage.setItem("qrevent_online", JSON.stringify(isOnline));
  }, [isOnline]);

  useEffect(() => {
    localStorage.setItem("qrevent_gate", selectedGate);
  }, [selectedGate]);

  useEffect(() => {
    localStorage.setItem("qrevent_sound", JSON.stringify(soundEnabled));
  }, [soundEnabled]);

  useEffect(() => {
    localStorage.setItem("qrevent_offline_queue", JSON.stringify(offlineQueue));
  }, [offlineQueue]);

  useEffect(() => {
    localStorage.setItem("qrevent_gates_list", JSON.stringify(gatesList));
  }, [gatesList]);

  // Load configuration and initialize Supabase
  useEffect(() => {
    const init = async () => {
      // Try to get from Vite environment variables first (most reliable on Netlify if prefixed with VITE_)
      let url = import.meta.env.VITE_SUPABASE_URL || "https://sxgjhivrclawaxqtphge.supabase.co";
      let key = import.meta.env.VITE_SUPABASE_KEY || "";

      // Fallback: Try to load from config.json (generated by node generate-env.js during build)
      if (!key || key === "PASTE_YOUR_SUPABASE_ANON_KEY_HERE") {
        try {
          const response = await fetch('/config.json');
          if (response.ok) {
            const config = await response.json();
            url = config.SUPABASE_URL || url;
            key = config.SUPABASE_KEY || "";
          }
        } catch (e) {
          console.warn("Could not load config.json fallback:", e);
        }
      }

      if (key && key !== "PASTE_YOUR_SUPABASE_ANON_KEY_HERE") {
        try {
          if (!supabaseInstance) {
            supabaseInstance = createClient(url, key);
            console.log("Supabase Client initialized successfully.");
          }
          setSupabase(supabaseInstance);
          setSupabaseConfig({ url, key });
        } catch (err) {
          console.error("Supabase init error:", err);
        }
      } else {
        console.warn("Supabase Anon Key is missing. Please check your environment variables or config.json.");
      }
    };
    init();
  }, []);

  // Fetch logged in attendee user session (if any)
  useEffect(() => {
    if (!supabase) return;
    const checkUser = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          setSupabaseUser(user);
          // Load attendee profile
          const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          if (!error && profile) {
            setCurrentUser({
              id: profile.id,
              name: profile.name,
              email: profile.email,
              token: profile.ticket_token,
              checked_in: profile.checked_in,
              check_in_time: profile.check_in_time,
              check_in_gate: profile.check_in_gate
            });
            setRole('user');
          }
        }
      } catch (err) {
        console.error("Session check error:", err);
      }
    };
    checkUser();
  }, [supabase]);

  // Load and subscribe to gates from Supabase
  useEffect(() => {
    if (!supabase) return;

    const fetchGates = async () => {
      try {
        const { data, error } = await supabase
          .from('gates')
          .select('*')
          .order('created_at', { ascending: true });
        
        if (!error && data && data.length > 0) {
          setGatesList(data.map(g => ({
            id: g.id,
            name: g.name,
            type: g.type
          })));
        } else if (error) {
          console.warn("Table 'gates' query failed (might not exist yet). Falling back to local storage.", error);
        }
      } catch (err) {
        console.warn("Exception while fetching gates:", err);
      }
    };

    fetchGates();

    // Set up realtime channel to sync gates database table
    const gatesChannel = supabase.channel('schema-db-gates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gates' }, () => {
        fetchGates();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(gatesChannel);
    };
  }, [supabase]);

  // Fetch Database Data for Admin Dashboard
  const fetchDatabaseData = async () => {
    if (!supabase) return;
    try {
      const { data: profiles, error: errProf } = await supabase
        .from('profiles')
        .select('*');
      if (errProf) throw errProf;

      setParticipants(profiles.map(p => ({
        id: p.id,
        name: p.name,
        email: p.email,
        token: p.ticket_token,
        phone: p.phone,
        gender: p.gender,
        checked_in: p.checked_in,
        checkedIn: p.checked_in,
        check_in_time: p.check_in_time,
        checkInTime: p.check_in_time,
        check_in_gate: p.check_in_gate,
        checkInGate: p.check_in_gate
      })));

      const { data: logs, error: errLogs } = await supabase
        .from('check_in_logs')
        .select('*')
        .order('created_at', { ascending: false });
      if (errLogs) throw errLogs;

      setCheckInLogs(logs.map(l => ({
        id: l.id,
        time: new Date(l.created_at).toLocaleString("id-ID"),
        name: l.participant_name,
        token: l.ticket_token,
        gate: l.gate,
        status: l.status,
        details: l.details
      })));
    } catch (err) {
      console.error("Supabase fetch data error:", err);
      showToast("Sync Error", "Gagal menyelaraskan data dengan database Supabase.", "error");
    }
  };

  // Fetch initially when entering admin panel
  useEffect(() => {
    if (role === 'admin' && supabase) {
      fetchDatabaseData();
    }
  }, [role, supabase]);

  // Realtime Database Subscriptions
  useEffect(() => {
    if (!supabase) return;

    let profilesChannel = null;
    let logsChannel = null;

    if (role === 'admin') {
      // Subscribe to live scan logs insertions
      logsChannel = supabase.channel('schema-db-logs')
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'check_in_logs' }, payload => {
          const newLog = payload.new;
          setCheckInLogs(prev => [
            {
              id: newLog.id,
              time: new Date(newLog.created_at).toLocaleString("id-ID"),
              name: newLog.participant_name,
              token: newLog.ticket_token,
              gate: newLog.gate,
              status: newLog.status,
              details: newLog.details
            },
            ...prev
          ]);
          showToast("Scan Masuk Baru", `${newLog.participant_name} masuk melalui ${newLog.gate}.`, "success");
        })
        .subscribe();

      // Subscribe to profiles updates
      profilesChannel = supabase.channel('schema-db-profiles')
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, payload => {
          const updatedProfile = payload.new;
          setParticipants(prev => prev.map(p => {
            if (p.id === updatedProfile.id) {
              return {
                ...p,
                checked_in: updatedProfile.checked_in,
                checkedIn: updatedProfile.checked_in,
                check_in_time: updatedProfile.check_in_time,
                checkInTime: updatedProfile.check_in_time,
                check_in_gate: updatedProfile.check_in_gate,
                checkInGate: updatedProfile.check_in_gate
              };
            }
            return p;
          }));
        })
        .subscribe();
    } else if (role === 'user' && currentUser) {
      // Subscribe to profile changes for currently logged in user
      profilesChannel = supabase.channel(`schema-db-profile-${currentUser.id}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${currentUser.id}`
        }, payload => {
          const updatedProfile = payload.new;
          setCurrentUser(prev => {
            if (prev && prev.id === updatedProfile.id) {
              const isJustCheckedIn = !prev.checked_in && updatedProfile.checked_in;
              if (isJustCheckedIn) {
                playSound("success", soundEnabled);
                // Highlight scan success inside Android mockup screen
                const screenEl = document.querySelector(".android-screen");
                if (screenEl) {
                  screenEl.classList.add("checkin-success-flash");
                  setTimeout(() => screenEl.classList.remove("checkin-success-flash"), 1000);
                }
              }
              return {
                ...prev,
                checked_in: updatedProfile.checked_in,
                check_in_time: updatedProfile.check_in_time,
                check_in_gate: updatedProfile.check_in_gate
              };
            }
            return prev;
          });
        })
        .subscribe();
    }

    return () => {
      if (profilesChannel) supabase.removeChannel(profilesChannel);
      if (logsChannel) supabase.removeChannel(logsChannel);
    };
  }, [role, supabase, currentUser, soundEnabled]);

  // Handle Offline to Online auto-sync
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0 && supabase) {
      const processOfflineSync = async () => {
        setIsSyncing(true);
        showToast("Online Detected", "Menyinkronkan data check-in lokal ke server...", "info");
        const queueCopy = [...offlineQueue];
        setOfflineQueue([]);
        
        let syncedSuccessCount = 0;
        let syncedConflictCount = 0;

        for (const item of queueCopy) {
          try {
            // Check if already checked in online
            const { data: profile } = await supabase
              .from('profiles')
              .select('checked_in')
              .eq('id', item.id)
              .single();
            
            if (profile && profile.checked_in) {
              // Sync conflict
              await supabase.from('check_in_logs').insert([{
                participant_name: item.name,
                ticket_token: item.token,
                gate: item.gate,
                status: "DUPLICATE",
                details: `SYNC CONFLICT: Tiket ganda disinkronkan dari offline.`
              }]);
              syncedConflictCount++;
            } else {
              // Sync check-in
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
              syncedSuccessCount++;
            }
          } catch (err) {
            console.error("Offline sync item error:", err);
            // Put it back to queue
            setOfflineQueue(prev => [...prev, item]);
          }
        }

        setIsSyncing(false);
        if (syncedSuccessCount > 0 || syncedConflictCount > 0) {
          showToast(
            "Sync Selesai", 
            `Berhasil: ${syncedSuccessCount}, Konflik: ${syncedConflictCount}`, 
            "success"
          );
          fetchDatabaseData();
        }
      };
      
      processOfflineSync();
    }
  }, [isOnline, supabase]);

  const renderToastIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="toast-icon" size={18} />;
      case 'error': return <AlertTriangle className="toast-icon" size={18} />;
      case 'warning': return <AlertCircle className="toast-icon" size={18} />;
      default: return <Info className="toast-icon" size={18} />;
    }
  };

  return (
    <>
      {role === 'landing' && <LandingScreen onSelectRole={setRole} />}
      {role === 'user' && (
        <UserApp 
          supabase={supabase} 
          currentUser={currentUser}
          setCurrentUser={setCurrentUser}
          supabaseUser={supabaseUser}
          setSupabaseUser={setSupabaseUser}
          showToast={showToast}
          onBackToLanding={() => setRole('landing')}
        />
      )}
      {role === 'admin' && (
        <AdminApp 
          supabase={supabase}
          participants={participants}
          setParticipants={setParticipants}
          checkInLogs={checkInLogs}
          setCheckInLogs={setCheckInLogs}
          isOnline={isOnline}
          setIsOnline={setIsOnline}
          selectedGate={selectedGate}
          setSelectedGate={setSelectedGate}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          offlineQueue={offlineQueue}
          setOfflineQueue={setOfflineQueue}
          isSyncing={isSyncing}
          gatesList={gatesList}
          setGatesList={setGatesList}
          showToast={showToast}
          fetchDatabaseData={fetchDatabaseData}
          onLogoutAdmin={() => setRole('landing')}
        />
      )}

      {/* Toast Notifications Overlay Container */}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast ${toast.type}`}>
            {renderToastIcon(toast.type)}
            <div className="toast-content">
              <div className="toast-title">{toast.title}</div>
              <div className="toast-message">{toast.message}</div>
            </div>
            <button className="toast-close" onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </>
  );
}
