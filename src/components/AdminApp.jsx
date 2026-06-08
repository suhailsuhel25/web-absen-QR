import React, { useState } from 'react';
import AdminSidebar from './admin/AdminSidebar';
import AdminHeader from './admin/AdminHeader';
import AdminDashboard from './admin/AdminDashboard';
import AdminScanner from './admin/AdminScanner';
import AdminReports from './admin/AdminReports';
import GateSelectorModal from './admin/GateSelectorModal';
import { playSound } from '../App';

export default function AdminApp({
  supabase,
  participants,
  setParticipants,
  checkInLogs,
  setCheckInLogs,
  isOnline,
  setIsOnline,
  selectedGate,
  setSelectedGate,
  soundEnabled,
  setSoundEnabled,
  offlineQueue,
  setOfflineQueue,
  isSyncing,
  showToast,
  fetchDatabaseData,
  onLogoutAdmin
}) {
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'scanner', 'reports'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showGateSelector, setShowGateSelector] = useState(true);

  // Core Check-In database and local state synchronization logic
  const handleCheckIn = async (token, gate) => {
    const cleanToken = token.trim();
    if (!cleanToken) return;

    // Search attendee in loaded state
    const participant = participants.find(p => p.token === cleanToken);

    // 1. INVALID CODE ERROR
    if (!participant) {
      playSound("error", soundEnabled);
      if (supabase) {
        try {
          await supabase.from('check_in_logs').insert([{
            participant_name: "TIKET INVALID",
            ticket_token: cleanToken,
            gate: gate,
            status: "ERROR",
            details: `Token '${cleanToken}' tidak terdaftar di database.`
          }]);
        } catch (err) {
          console.error("Failed to log invalid check-in:", err);
        }
      }
      showToast("Scan Error", "Tiket tidak terdaftar di database peserta.", "error");
      return;
    }

    // 2. GENDER MISMATCH ERROR
    const isMaleGate = gate.includes("(Laki-laki)");
    const isFemaleGate = gate.includes("(Perempuan)");
    const isGenderMismatch = participant.gender && (
      (participant.gender === "Laki-laki" && isFemaleGate) || 
      (participant.gender === "Perempuan" && isMaleGate)
    );

    if (isGenderMismatch) {
      playSound("error", soundEnabled);
      if (supabase) {
        try {
          await supabase.from('check_in_logs').insert([{
            participant_name: participant.name,
            ticket_token: cleanToken,
            gate: gate,
            status: "ERROR",
            details: `BLOCKED: Salah Pintu (Gender Mismatch). Peserta ${participant.gender} di ${gate}.`
          }]);
        } catch (err) {
          console.error("Failed to log gender mismatch check-in:", err);
        }
      }
      showToast("Salah Pintu!", `Peserta (${participant.gender}) tidak boleh masuk lewat ${gate}!`, "error");
      return;
    }

    const isAlreadyChecked = participant.checked_in || participant.checkInTime !== null;
    const isOfflineDuplicate = offlineQueue.some(q => q.token === cleanToken);

    // 2. DUPLICATE CHECK-IN ERROR
    if (isAlreadyChecked || isOfflineDuplicate) {
      const prevGate = participant.check_in_gate || participant.checkInGate || gate;
      const prevTime = participant.check_in_time || participant.checkInTime || "Baru saja";

      playSound("duplicate", soundEnabled);
      if (supabase) {
        try {
          await supabase.from('check_in_logs').insert([{
            participant_name: participant.name,
            ticket_token: cleanToken,
            gate: gate,
            status: "DUPLICATE",
            details: `Percobaan scan ulang di ${gate}. Sebelumnya terdaftar di ${prevGate}.`
          }]);
        } catch (err) {
          console.error("Failed to log duplicate check-in:", err);
        }
      }
      showToast("Scan Ditolak", `Tiket ${participant.name} terdeteksi duplikat!`, "warning");
      return;
    }

    const timeString = new Date().toISOString();

    // 3. SUCCESS CHECK-IN (ONLINE VS OFFLINE CACHE)
    if (isOnline) {
      playSound("success", soundEnabled);
      try {
        if (supabase) {
          // Update profile in DB
          await supabase.from('profiles')
            .update({
              checked_in: true,
              check_in_time: timeString,
              check_in_gate: gate
            })
            .eq('id', participant.id);

          // Add log
          await supabase.from('check_in_logs').insert([{
            participant_name: participant.name,
            ticket_token: cleanToken,
            gate: gate,
            status: "SUCCESS",
            details: `Check-in berhasil di ${gate}`
          }]);
        }
      } catch (err) {
        console.error("Failed to commit check-in online:", err);
      }
      showToast("Check-in Sukses", `${participant.name} berhasil masuk.`, "success");
    } else {
      // Offline cached simulation
      playSound("success", soundEnabled);

      // Update state locally
      setParticipants(prev => prev.map(p => {
        if (p.id === participant.id) {
          return {
            ...p,
            checked_in: true,
            check_in_time: timeString,
            check_in_gate: gate,
            checkedIn: true,
            checkInTime: timeString,
            checkInGate: gate
          };
        }
        return p;
      }));

      // Add to logs state directly for immediate feedback
      setCheckInLogs(prev => [
        {
          id: Date.now(),
          time: new Date(timeString).toLocaleString("id-ID"),
          name: participant.name,
          token: cleanToken,
          gate: gate,
          status: "SUCCESS",
          details: `Check-in Offline (Tersimpan Lokal)`
        },
        ...prev
      ]);

      // Push to offline queue
      setOfflineQueue(prev => [
        ...prev,
        {
          id: participant.id,
          name: participant.name,
          token: cleanToken,
          gate: gate,
          time: timeString
        }
      ]);

      showToast("Tersimpan Offline", `${participant.name} dimasukkan ke antrean sinkronisasi.`, "info");
    }
  };

  return (
    <div id="admin-app-container" className="app-container">
      <AdminSidebar
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        sidebarOpen={sidebarOpen}
        setSidebarOpen={setSidebarOpen}
        isOnline={isOnline}
        setIsOnline={setIsOnline}
        onLogoutAdmin={onLogoutAdmin}
      />

      <main className="main-content">
        <AdminHeader
          activeTab={activeTab}
          setSidebarOpen={setSidebarOpen}
          soundEnabled={soundEnabled}
          setSoundEnabled={setSoundEnabled}
          selectedGate={selectedGate}
          offlineQueue={offlineQueue}
          isSyncing={isSyncing}
        />

        <div className="tab-content-container">
          {activeTab === 'dashboard' && (
            <AdminDashboard
              participants={participants}
              checkInLogs={checkInLogs}
            />
          )}

          {activeTab === 'scanner' && (
            <AdminScanner
              isOnline={isOnline}
              selectedGate={selectedGate}
              soundEnabled={soundEnabled}
              participants={participants}
              checkInLogs={checkInLogs}
              showToast={showToast}
              handleCheckIn={handleCheckIn}
            />
          )}

          {activeTab === 'reports' && (
            <AdminReports
              checkInLogs={checkInLogs}
              showToast={showToast}
            />
          )}
        </div>
      </main>
      {showGateSelector && (
        <GateSelectorModal
          currentGate={selectedGate}
          onConfirm={(gate) => {
            setSelectedGate(gate);
            setShowGateSelector(false);
          }}
        />
      )}
    </div>
  );
}
