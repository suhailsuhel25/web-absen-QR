import React, { useState, useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import jsQR from 'jsqr';
import QRCode from 'qrcode';
import { 
  LayoutDashboard, UserPlus, Ticket, ScanLine, FileBarChart, 
  Menu, X, Volume2, VolumeX, DoorOpen, RefreshCw, Users, 
  UserCheck, Clock, Radio, Activity, Search, Trash2, 
  FileSpreadsheet, User2, Printer, Send, Key, Terminal, 
  Camera, CameraOff, Video, ShieldAlert, ShieldCheck, Copy, 
  Download, FileText
} from 'lucide-react';
import { playSound } from '../App';

Chart.register(...registerables);

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
  const [activeTab, setActiveTab] = useState('dashboard'); // 'dashboard', 'registration', 'qrcode', 'scanner', 'reports'
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Dashboard states
  const doughnutCanvasRef = useRef(null);
  const barCanvasRef = useRef(null);
  const doughnutChartRef = useRef(null);
  const barChartRef = useRef(null);

  // Registration & CSV Import States
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regTicketType, setRegTicketType] = useState('Regular');
  const [participantSearch, setParticipantSearch] = useState('');
  const csvFileInputRef = useRef(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // QR Code Tab States
  const [qrSearch, setQrSearch] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState(null);
  const qrCanvasRef = useRef(null);

  // Scanner Tab States
  const [scannerMode, setScannerMode] = useState('simulator'); // 'simulator' | 'webcam'
  const [manualToken, setManualToken] = useState('');
  const [scanResult, setScanResult] = useState({
    status: 'idle', // 'idle', 'success', 'duplicate', 'error'
    title: 'Ready to Scan',
    desc: 'Arahkan kamera ke QR tiket atau gunakan simulator.'
  });
  
  // Webcam scanning references
  const videoRef = useRef(null);
  const webcamCanvasRef = useRef(null);
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const videoStreamRef = useRef(null);
  const scanLoopRef = useRef(null);
  const scanThrottleRef = useRef(false);
  const fileInputRef = useRef(null);

  // CSV Reports Tab States
  const [logsSearch, setLogsSearch] = useState('');

  // Clean up webcam scan animation loop and stream on unmount or tab change
  useEffect(() => {
    return () => stopWebcam();
  }, []);

  useEffect(() => {
    if (activeTab !== 'scanner') {
      stopWebcam();
    }
  }, [activeTab]);

  // Chart.js initialization & update
  useEffect(() => {
    if (activeTab === 'dashboard' && participants.length >= 0) {
      // 1. Doughnut Chart Data
      const checkedInCount = participants.filter(p => p.checked_in).length;
      const remainingCount = participants.length - checkedInCount;

      if (doughnutCanvasRef.current) {
        if (doughnutChartRef.current) doughnutChartRef.current.destroy();
        doughnutChartRef.current = new Chart(doughnutCanvasRef.current, {
          type: "doughnut",
          data: {
            labels: ["Checked In", "Belum Hadir"],
            datasets: [{
              data: [checkedInCount, remainingCount],
              backgroundColor: ["#10b981", "#1e293b"],
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
                labels: { color: "#94a3b8", font: { family: "Plus Jakarta Sans", size: 10, weight: "600" }, padding: 10 }
              },
              title: { display: true, text: "STATUS KEHADIRAN", color: "#f8fafc", font: { family: "Plus Jakarta Sans", size: 11, weight: "700" } }
            },
            cutout: "70%"
          }
        });
      }

      // 2. Bar Chart Data (Check-ins per gate)
      const successLogs = checkInLogs.filter(l => l.status === 'SUCCESS');
      const gateCounts = { "Gate A": 0, "Gate B": 0, "Gate C": 0 };
      successLogs.forEach(log => {
        if (gateCounts[log.gate] !== undefined) {
          gateCounts[log.gate]++;
        }
      });

      if (barCanvasRef.current) {
        if (barChartRef.current) barChartRef.current.destroy();
        barChartRef.current = new Chart(barCanvasRef.current, {
          type: "bar",
          data: {
            labels: ["Gate A", "Gate B", "Gate C"],
            datasets: [{
              label: "Check-ins",
              data: [gateCounts["Gate A"], gateCounts["Gate B"], gateCounts["Gate C"]],
              backgroundColor: ["#6366f1", "#3b82f6", "#f59e0b"],
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
              x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { family: "Plus Jakarta Sans", size: 9, weight: "600" } } },
              y: { 
                grid: { color: "#1e293b" }, 
                ticks: { color: "#94a3b8", font: { family: "Plus Jakarta Sans", size: 9 }, stepSize: 1 },
                beginAtZero: true
              }
            }
          }
        });
      }
    }
  }, [activeTab, participants, checkInLogs]);

  // QR Code Rendering inside ticket
  useEffect(() => {
    if (activeTab === 'qrcode' && selectedParticipant && qrCanvasRef.current) {
      QRCode.toCanvas(qrCanvasRef.current, selectedParticipant.token, {
        width: 140,
        margin: 1,
        color: {
          dark: "#0f172a",
          light: "#ffffff"
        }
      }, (err) => {
        if (err) console.error(err);
      });
    }
  }, [activeTab, selectedParticipant]);

  // -------------------------------------------------------------
  // EVENT HANDLERS & DB OPERATIONS
  // -------------------------------------------------------------

  // Manual Check-In logic
  const handleCheckIn = async (token, gate) => {
    const cleanToken = token.trim();
    if (!cleanToken) return;

    // Search attendee in loaded state
    const participant = participants.find(p => p.token === cleanToken);

    // 1. INVALID CODE ERROR
    if (!participant) {
      playSound("error", soundEnabled);
      setScanResult({
        status: 'error',
        title: 'Tiket Tidak Valid',
        desc: `Token '${cleanToken}' tidak terdaftar di database.`
      });

      if (supabase) {
        await supabase.from('check_in_logs').insert([{
          participant_name: "TIKET INVALID",
          ticket_token: cleanToken,
          gate: gate,
          status: "ERROR",
          details: `Token '${cleanToken}' tidak terdaftar di database.`
        }]);
      }
      showToast("Scan Error", "Tiket tidak terdaftar di database peserta.", "error");
      return;
    }

    const isAlreadyChecked = participant.checked_in || participant.checkInTime !== null;
    const isOfflineDuplicate = offlineQueue.some(q => q.token === cleanToken);

    // 2. DUPLICATE CHECK-IN ERROR
    if (isAlreadyChecked || isOfflineDuplicate) {
      const prevGate = participant.check_in_gate || participant.checkInGate || gate;
      const prevTime = participant.check_in_time || participant.checkInTime || "Baru saja";

      playSound("duplicate", soundEnabled);
      setScanResult({
        status: 'duplicate',
        title: 'Blocked (Duplikat)',
        desc: `Tiket milik ${participant.name} sudah discan sebelumnya di ${prevGate} pada ${prevTime.includes('T') ? new Date(prevTime).toLocaleTimeString() : prevTime}.`
      });

      if (supabase) {
        await supabase.from('check_in_logs').insert([{
          participant_name: participant.name,
          ticket_token: cleanToken,
          gate: gate,
          status: "DUPLICATE",
          details: `Percobaan scan ulang di ${gate}. Sebelumnya terdaftar di ${prevGate}.`
        }]);
      }
      showToast("Scan Ditolak", `Tiket ${participant.name} terdeteksi duplikat!`, "warning");
      return;
    }

    const timeString = new Date().toISOString();

    // 3. SUCCESS CHECK-IN (ONLINE VS OFFLINE CACHE)
    if (isOnline) {
      playSound("success", soundEnabled);
      setScanResult({
        status: 'success',
        title: 'Check-in Berhasil',
        desc: `Nama: ${participant.name} (${participant.ticketType})\nPintu: ${gate}\nWaktu: ${new Date(timeString).toLocaleTimeString()}`
      });

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
      setScanResult({
        status: 'success',
        title: 'Check-in Offline (Disimpan)',
        desc: `Nama: ${participant.name} (${participant.ticketType})\nPintu: ${gate}\nWaktu: ${new Date(timeString).toLocaleTimeString()}\nMenunggu koneksi online untuk sinkronisasi.`
      });

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

  // -------------------------------------------------------------
  // REGISTRATION & CSV IMPORTS
  // -------------------------------------------------------------
  
  const handleManualRegSubmit = async (e) => {
    e.preventDefault();
    if (!regName.trim() || !regEmail.trim()) return;

    if (!supabase) {
      showToast("Koneksi Error", "Supabase belum terinisiasi.", "error");
      return;
    }

    const token = `TKT-${regTicketType.toUpperCase()}-${Math.random().toString(16).substring(2, 7).toUpperCase()}`;

    try {
      showToast("Menyimpan", "Menambahkan peserta baru...", "info");
      
      const { error } = await supabase.from('profiles').insert([{
        id: '00000000-0000-0000-0000-' + Math.floor(Math.random()*1000000000000).toString().padStart(12, '0'),
        name: regName,
        email: regEmail,
        ticket_type: regTicketType,
        ticket_token: token,
        checked_in: false
      }]);

      if (error) throw error;

      showToast("Peserta Ditambahkan", `${regName} berhasil didaftarkan.`, "success");
      setRegName('');
      setRegEmail('');
      fetchDatabaseData();
    } catch (err) {
      console.error(err);
      showToast("Gagal Mendaftar", err.message || "Email sudah digunakan.", "error");
    }
  };

  // CSV Drag and drop / file load handlers
  const handleCsvFileLoad = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      parseAndImportCsv(event.target.result);
    };
    reader.readAsText(file);
  };

  const parseAndImportCsv = async (text) => {
    if (!supabase) {
      showToast("Koneksi Error", "Supabase belum terhubung.", "error");
      return;
    }

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
        
        // Prevent duplicate emails in import
        if (email.includes("@") && !participants.some(p => p.email.toLowerCase() === email.toLowerCase())) {
          const suffixToken = Math.random().toString(16).substring(2, 7).toUpperCase();
          const cleanTicketType = ["Regular", "VIP", "VVIP"].includes(ticketType) ? ticketType : "Regular";
          
          newEntries.push({
            id: '00000000-0000-0000-0000-' + Math.floor(Math.random()*1000000000000 + i).toString().padStart(12, '0'),
            name: name,
            email: email,
            ticket_type: cleanTicketType,
            ticket_token: `TKT-${cleanTicketType.toUpperCase()}-${suffixToken}`,
            checked_in: false
          });
        }
      }
    }

    if (newEntries.length === 0) {
      showToast("Import Gagal", "Tidak ada data email baru yang dapat dimasukkan.", "warning");
      return;
    }

    try {
      showToast("Mengimpor", `Mengunggah ${newEntries.length} data peserta...`, "info");
      const { error } = await supabase.from('profiles').insert(newEntries);
      if (error) throw error;
      
      showToast("Impor Berhasil", `Berhasil memasukkan ${newEntries.length} peserta baru.`, "success");
      fetchDatabaseData();
    } catch (err) {
      console.error(err);
      showToast("Impor Gagal", "Gagal menyimpan data massal ke Supabase.", "error");
    }
  };

  // Reset database values
  const handleResetDatabase = async () => {
    if (!window.confirm("Apakah Anda yakin ingin menghapus SELURUH logs dan profiles dari Supabase?\nIni tidak dapat dibatalkan.")) {
      return;
    }

    if (!supabase) return;

    try {
      showToast("Pembersihan", "Menghapus records dari database...", "info");
      
      // Delete check_in_logs first
      const { error: logsError } = await supabase.from('check_in_logs').delete().neq('id', 0);
      if (logsError) throw logsError;

      // Delete profiles
      const { error: profilesError } = await supabase.from('profiles').delete().neq('email', 'admin-prevent-empty@email.com');
      if (profilesError) throw profilesError;

      setOfflineQueue([]);
      showToast("Database Direset", "Seluruh data logs dan peserta berhasil dibersihkan.", "success");
      fetchDatabaseData();
    } catch (err) {
      console.error(err);
      showToast("Reset Gagal", err.message || "Gagal menghapus database.", "error");
    }
  };

  // -------------------------------------------------------------
  // CAMERA WEBCAM QR SCANNER
  // -------------------------------------------------------------

  const startWebcam = async () => {
    if (isWebcamActive) return;
    
    setScanResult({
      status: 'idle',
      title: 'Menyalakan Kamera...',
      desc: 'Membuka akses ke kamera peramban Anda.'
    });

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      videoStreamRef.current = stream;
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute("playsinline", true); // required to prevent iOS Safari from fullscreening video
        videoRef.current.play();
        setIsWebcamActive(true);
        scanLoopRef.current = requestAnimationFrame(tickScan);
        showToast("Kamera Aktif", "Arahkan kamera ke QR Code peserta.", "success");
      }
    } catch (err) {
      console.error("Camera access error:", err);
      showToast("Kamera Diblokir", "Gagal membuka kamera. Pastikan Anda mengizinkan akses kamera.", "error");
      
      // Show fallback container style
      const fallbackContainer = document.getElementById("camera-http-fallback-container");
      if (fallbackContainer) fallbackContainer.classList.remove("hidden");
    }
  };

  const stopWebcam = () => {
    if (scanLoopRef.current) {
      cancelAnimationFrame(scanLoopRef.current);
      scanLoopRef.current = null;
    }
    if (videoStreamRef.current) {
      videoStreamRef.current.getTracks().forEach(track => track.stop());
      videoStreamRef.current = null;
    }
    setIsWebcamActive(false);
  };

  const drawRect = (location) => {
    const canvas = webcamCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    
    ctx.beginPath();
    ctx.moveTo(location.topLeftCorner.x, location.topLeftCorner.y);
    ctx.lineTo(location.topRightCorner.x, location.topRightCorner.y);
    ctx.lineTo(location.bottomRightCorner.x, location.bottomRightCorner.y);
    ctx.lineTo(location.bottomLeftCorner.x, location.bottomLeftCorner.y);
    ctx.closePath();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#10b981";
    ctx.stroke();
  };

  const tickScan = () => {
    const video = videoRef.current;
    const canvas = webcamCanvasRef.current;
    
    if (video && canvas && video.readyState === video.HAVE_ENOUGH_DATA) {
      const ctx = canvas.getContext("2d");
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      
      const code = jsQR(imageData.data, imageData.width, imageData.height, {
        inversionAttempts: "dontInvert",
      });
      
      if (code) {
        drawRect(code.location);
        
        // Throttling process to prevent duplicate continuous scans on same code
        if (!scanThrottleRef.current) {
          scanThrottleRef.current = true;
          handleCheckIn(code.data, selectedGate);
          
          setTimeout(() => {
            scanThrottleRef.current = false;
          }, 3000); // 3s cooldown
        }
      }
    }
    scanLoopRef.current = requestAnimationFrame(tickScan);
  };

  // Mobile HTTP Camera Fallback (decodes static photo file)
  const handleCameraFileFallback = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);
      
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const code = jsQR(imageData.data, imageData.width, imageData.height);
      
      if (code) {
        showToast("Dekode Sukses", "QR code berhasil terbaca dari foto.", "success");
        handleCheckIn(code.data, selectedGate);
      } else {
        showToast("Dekode Gagal", "QR code tidak terbaca. Pastikan foto fokus dan pencahayaan terang.", "error");
        playSound("error", soundEnabled);
      }
    };
    img.src = URL.createObjectURL(file);
  };

  // -------------------------------------------------------------
  // EXPORTS
  // -------------------------------------------------------------
  const handleExportCsv = () => {
    if (checkInLogs.length === 0) {
      showToast("Export Failed", "Log check-in kosong, tidak ada data untuk diexport.", "warning");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Waktu Check-in,Nama,Token,Gerbang,Status,Keterangan\n";

    checkInLogs.forEach(log => {
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
  };

  // Filter lists based on searches
  const filteredParticipants = participants.filter(p => 
    p.name.toLowerCase().includes(participantSearch.toLowerCase()) ||
    p.email.toLowerCase().includes(participantSearch.toLowerCase()) ||
    p.token.toLowerCase().includes(participantSearch.toLowerCase())
  );

  const filteredQrParticipants = participants.filter(p =>
    p.name.toLowerCase().includes(qrSearch.toLowerCase())
  );

  const filteredLogs = checkInLogs.filter(l => 
    l.name.toLowerCase().includes(logsSearch.toLowerCase()) ||
    l.token.toLowerCase().includes(logsSearch.toLowerCase()) ||
    l.gate.toLowerCase().includes(logsSearch.toLowerCase()) ||
    l.status.toLowerCase().includes(logsSearch.toLowerCase())
  );

  return (
    <div id="admin-app-container" className="app-container">
      <div 
        className={`sidebar-overlay ${sidebarOpen ? '' : 'hidden'}`} 
        onClick={() => setSidebarOpen(false)}
      ></div>
      
      {/* Sidebar Navigation */}
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <Ticket size={20} />
            </div>
            <span className="logo-text">QR<span className="text-accent">Event</span></span>
          </div>
          <div className="sidebar-header-right">
            <span className="badge badge-beta">ADMIN</span>
            <button className="btn-sidebar-close" onClick={() => setSidebarOpen(false)} title="Close Sidebar">
              <X size={16} />
            </button>
          </div>
        </div>

        <nav className="sidebar-menu">
          <button 
            className={`menu-item ${activeTab === 'dashboard' ? 'active' : ''}`} 
            onClick={() => { setActiveTab('dashboard'); setSidebarOpen(false); }}
          >
            <LayoutDashboard size={18} />
            <span>Dashboard Overview</span>
          </button>
          <button 
            className={`menu-item ${activeTab === 'registration' ? 'active' : ''}`}
            onClick={() => { setActiveTab('registration'); setSidebarOpen(false); }}
          >
            <UserPlus size={18} />
            <span>Registrasi & Import</span>
          </button>
          <button 
            className={`menu-item ${activeTab === 'qrcode' ? 'active' : ''}`}
            onClick={() => { setActiveTab('qrcode'); setSidebarOpen(false); }}
          >
            <Ticket size={18} />
            <span>Generate QR Code</span>
          </button>
          <button 
            className={`menu-item ${activeTab === 'scanner' ? 'active' : ''}`}
            onClick={() => { setActiveTab('scanner'); setSidebarOpen(false); }}
          >
            <ScanLine size={18} />
            <span>Scanner & Validasi</span>
          </button>
          <button 
            className={`menu-item ${activeTab === 'reports' ? 'active' : ''}`}
            onClick={() => { setActiveTab('reports'); setSidebarOpen(false); }}
          >
            <FileBarChart size={18} />
            <span>Laporan & Export</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="network-card">
            <div className="network-status-header">
              <span className={`status-indicator-dot ${isOnline ? 'online' : 'offline'}`}></span>
              <span className="status-label">{isOnline ? 'Online Mode' : 'Offline Mode'}</span>
            </div>
            <p className="status-desc">Simulate offline state to test caching and auto-sync.</p>
            <label className="switch-container">
              <span className="switch-label">Offline Simulation</span>
              <input 
                type="checkbox" 
                checked={!isOnline} 
                onChange={(e) => setIsOnline(!e.target.checked)} 
              />
              <span className="switch-slider"></span>
            </label>
          </div>
          
          <button className="btn btn-secondary btn-sm btn-icon" onClick={onLogoutAdmin}>
            <LogOut size={14} />
            <span>Keluar Admin</span>
          </button>
        </div>
      </aside>

      {/* Main Content Pane */}
      <main className="main-content">
        
        {/* Top Header Bar */}
        <header className="top-bar">
          <div className="top-bar-left-wrapper">
            <button className="btn-menu-toggle" onClick={() => setSidebarOpen(true)} title="Open Sidebar">
              <Menu size={20} />
            </button>
            <div className="page-title-container">
              <h1>
                {activeTab === 'dashboard' && 'Dashboard Overview'}
                {activeTab === 'registration' && 'Registrasi & Impor Peserta'}
                {activeTab === 'qrcode' && 'Cetak E-Tiket & QR'}
                {activeTab === 'scanner' && 'Scanner Kehadiran'}
                {activeTab === 'reports' && 'Laporan Check-in'}
              </h1>
              <p>
                {activeTab === 'dashboard' && 'Real-time event analytics and simulation diagnostics.'}
                {activeTab === 'registration' && 'Manage participant database and CSV uploads.'}
                {activeTab === 'qrcode' && 'Generate and download participant entry codes.'}
                {activeTab === 'scanner' && 'Scan codes via camera or virtual token inputs.'}
                {activeTab === 'reports' && 'View, search, and export check-in logs.'}
              </p>
            </div>
          </div>
          
          <div className="top-bar-actions">
            <button 
              className="btn btn-icon-only" 
              onClick={() => setSoundEnabled(!soundEnabled)} 
              title="Toggle Sound Effects"
            >
              {soundEnabled ? <Volume2 id="audio-icon" size={18} /> : <VolumeX id="audio-icon" size={18} />}
            </button>

            <div className="select-wrapper">
              <DoorOpen className="select-icon" size={16} />
              <select value={selectedGate} onChange={(e) => setSelectedGate(e.target.value)}>
                <option value="Gate A">Gate A (Main Entrance)</option>
                <option value="Gate B">Gate B (VIP Entrance)</option>
                <option value="Gate C">Gate C (North Gate)</option>
              </select>
            </div>

            <div className={`sync-status-badge ${offlineQueue.length > 0 ? '' : 'hidden'} ${isSyncing ? 'syncing' : ''}`}>
              <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
              <span>{offlineQueue.length}</span> Pending Sync
            </div>
          </div>
        </header>

        <div className="tab-content-container">
          
          {/* TAB 1: DASHBOARD */}
          {activeTab === 'dashboard' && (
            <section className="tab-pane active" id="dashboard-tab">
              <div className="metrics-grid">
                <div className="metric-card border-accent">
                  <div className="metric-icon bg-accent-glow">
                    <Users size={20} className="text-accent" />
                  </div>
                  <div className="metric-info">
                    <span className="metric-label">Total Peserta</span>
                    <h3 className="metric-val">{participants.length}</h3>
                    <span className="metric-subtext">Registered in database</span>
                  </div>
                </div>

                <div className="metric-card border-success">
                  <div className="metric-icon bg-success-glow">
                    <UserCheck size={20} className="text-success" />
                  </div>
                  <div className="metric-info">
                    <span className="metric-label">Checked In</span>
                    <h3 className="metric-val">
                      {participants.filter(p => p.checked_in).length}
                    </h3>
                    <span className="metric-subtext">
                      {participants.length > 0 
                        ? Math.round((participants.filter(p => p.checked_in).length / participants.length) * 100) 
                        : 0
                      }% success rate
                    </span>
                  </div>
                </div>

                <div className="metric-card border-warning">
                  <div className="metric-icon bg-warning-glow">
                    <Clock size={20} className="text-warning" />
                  </div>
                  <div className="metric-info">
                    <span className="metric-label">Belum Hadir</span>
                    <h3 className="metric-val">
                      {participants.filter(p => !p.checked_in).length}
                    </h3>
                    <span className="metric-subtext">Waiting for arrival</span>
                  </div>
                </div>

                <div className="metric-card border-info">
                  <div className="metric-icon bg-info-glow">
                    <Radio size={20} className="text-info" />
                  </div>
                  <div className="metric-info">
                    <span className="metric-label">Active Gates</span>
                    <h3 className="metric-val">3</h3>
                    <span className="metric-subtext">Receiving live scans</span>
                  </div>
                </div>
              </div>

              <div className="dashboard-row grid-2-1">
                <div className="dashboard-card chart-container-card">
                  <div className="card-header">
                    <h3 className="card-title">Analisis Kehadiran Realtime</h3>
                    <p className="card-subtitle">Perbandingan status check-in dan volume per gerbang.</p>
                  </div>
                  <div className="chart-flex-wrapper">
                    <div className="chart-box">
                      <canvas ref={doughnutCanvasRef}></canvas>
                    </div>
                    <div className="chart-box">
                      <canvas ref={barCanvasRef}></canvas>
                    </div>
                  </div>
                </div>

                <div className="dashboard-card activity-feed-card">
                  <div className="card-header">
                    <div className="card-title-flex">
                      <h3 className="card-title">Live Check-in Feed</h3>
                      <span className="live-indicator"><span className="ping-dot"></span>LIVE</span>
                    </div>
                    <p className="card-subtitle">Aktivitas masuk di seluruh gerbang.</p>
                  </div>
                  <div className="feed-list">
                    {checkInLogs.length === 0 ? (
                      <div className="empty-feed-state">
                        <Activity size={32} />
                        <p>Belum ada aktivitas masuk. Jalankan scan untuk melihat data di sini.</p>
                      </div>
                    ) : (
                      checkInLogs.slice(0, 10).map((log) => (
                        <div key={log.id} className={`feed-item ${log.status.toLowerCase()}`}>
                          <div className="feed-status-line"></div>
                          <div className="feed-item-header">
                            <span className="feed-name">{log.name}</span>
                            <span className="feed-time">{log.time.split(" ")[1]}</span>
                          </div>
                          <div className="feed-item-detail">
                            Token: <span className="font-mono">{log.token.substring(0, 12)}</span> | Pintu: {log.gate}
                          </div>
                          <div className="feed-item-desc">{log.details}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              <div className="dashboard-card helper-card">
                <div className="card-header">
                  <h3 className="card-title">Cara Mensimulasikan Alur Sistem:</h3>
                </div>
                <div className="flow-steps-timeline">
                  <div className="flow-step">
                    <div className="step-num">1</div>
                    <h4>Registrasi User</h4>
                    <p>Gunakan opsi <strong>"Peserta Event"</strong> di landing page, daftar akun baru. QR Code dan token unik dihasilkan secara otomatis.</p>
                  </div>
                  <div className="flow-step">
                    <div className="step-num">2</div>
                    <h4>Buka Admin Scanner</h4>
                    <p>Buka sesi <strong>"Panitia / Admin"</strong> di tab lain atau di halaman ini. Aktifkan kamera scanner atau simulator token.</p>
                  </div>
                  <div className="flow-step">
                    <div className="step-num">3</div>
                    <h4>Proses Pemindaian</h4>
                    <p>Scan QR code dari layar ponsel peserta. Validasi anti-duplikasi akan memproses status check-in seketika.</p>
                  </div>
                  <div className="flow-step">
                    <div className="step-num">4</div>
                    <h4>Pantau Realtime</h4>
                    <p>Status kehadiran pada HP peserta akan otomatis terupdate menjadi "Sudah Hadir" melalui sistem sinkronisasi realtime database Supabase.</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 2: REGISTRATION & IMPORT */}
          {activeTab === 'registration' && (
            <section className="tab-pane active" id="registration-tab">
              <div className="dashboard-row grid-1-2">
                <div className="dashboard-card">
                  <div className="card-header">
                    <h3 className="card-title">Registrasi Manual</h3>
                    <p className="card-subtitle">Tambah peserta baru secara langsung ke database lokal/Supabase.</p>
                  </div>
                  <form className="reg-form" onSubmit={handleManualRegSubmit}>
                    <div className="form-group">
                      <label htmlFor="reg-name">Nama Lengkap</label>
                      <div className="input-wrapper">
                        <User className="input-icon" size={16} />
                        <input 
                          type="text" 
                          id="reg-name" 
                          placeholder="Contoh: Budi Santoso" 
                          value={regName}
                          onChange={(e) => setRegName(e.target.value)}
                          required 
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="reg-email">Alamat Email</label>
                      <div className="input-wrapper">
                        <Mail className="input-icon" size={16} />
                        <input 
                          type="email" 
                          id="reg-email" 
                          placeholder="Contoh: budi@gmail.com" 
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          required 
                        />
                      </div>
                    </div>
                    <div className="form-group">
                      <label htmlFor="reg-ticket">Kategori Tiket</label>
                      <div className="select-wrapper border-input">
                        <Tag className="select-icon" size={16} />
                        <select 
                          id="reg-ticket" 
                          value={regTicketType} 
                          onChange={(e) => setRegTicketType(e.target.value)}
                          required
                        >
                          <option value="Regular">Regular Class</option>
                          <option value="VIP">VIP Ticket</option>
                          <option value="VVIP">VVIP / Speaker</option>
                        </select>
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary btn-block">
                      <UserPlus size={16} style={{ marginRight: '6px' }} />
                      <span>Daftarkan Peserta</span>
                    </button>
                  </form>

                  <div className="divider"><span>atau</span></div>

                  <div className="card-header border-none p-0 mb-3">
                    <h3 className="card-title">Impor Massal (CSV/Excel Simulation)</h3>
                    <p className="card-subtitle">Simulasikan import file CSV peserta.</p>
                  </div>
                  <div 
                    className={`import-dropzone ${isDragOver ? 'dragover' : ''}`}
                    onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      if (e.dataTransfer.files.length > 0) {
                        const file = e.dataTransfer.files[0];
                        const reader = new FileReader();
                        reader.onload = (event) => parseAndImportCsv(event.target.result);
                        reader.readAsText(file);
                      }
                    }}
                  >
                    <FileSpreadsheet className="dropzone-icon" size={36} />
                    <p className="dropzone-text">Seret file CSV di sini atau</p>
                    <button className="btn btn-secondary btn-sm" onClick={() => csvFileInputRef.current.click()}>Pilih File Simulasi</button>
                    <input 
                      type="file" 
                      ref={csvFileInputRef} 
                      onChange={handleCsvFileLoad}
                      accept=".csv" 
                      className="hidden" 
                    />
                  </div>
                </div>

                <div className="dashboard-card">
                  <div className="card-header table-header-flex">
                    <div>
                      <h3 className="card-title">Daftar Peserta Terdaftar</h3>
                      <p className="card-subtitle">Menampilkan total peserta yang tersimpan dalam sistem.</p>
                    </div>
                    <div className="table-search-actions">
                      <div className="input-wrapper search-wrapper">
                        <Search className="input-icon" size={16} />
                        <input 
                          type="text" 
                          placeholder="Cari nama, email, token..."
                          value={participantSearch}
                          onChange={(e) => setParticipantSearch(e.target.value)}
                        />
                      </div>
                      <button className="btn btn-danger-ghost btn-sm" onClick={handleResetDatabase}>
                        <Trash2 size={14} style={{ marginRight: '4px' }} />
                        <span>Reset Database</span>
                      </button>
                    </div>
                  </div>
                  
                  <div className="table-responsive">
                    <table className="custom-table">
                      <thead>
                        <tr>
                          <th>ID/Token</th>
                          <th>Nama</th>
                          <th>Email</th>
                          <th>Kategori Tiket</th>
                          <th>QR Code</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredParticipants.length === 0 ? (
                          <tr>
                            <td colSpan="6" className="table-empty-state">
                              <User2 size={32} />
                              <p>Belum ada data peserta. Silakan melakukan pendaftaran di Portal Peserta atau impor CSV.</p>
                            </td>
                          </tr>
                        ) : (
                          filteredParticipants.map(p => (
                            <tr key={p.id}>
                              <td className="font-mono" style={{ fontSize: '11px' }}>{p.token}</td>
                              <td>{p.name}</td>
                              <td>{p.email}</td>
                              <td>
                                <span className={`badge badge-ticket-${p.ticketType.toLowerCase()}`}>
                                  {p.ticketType}
                                </span>
                              </td>
                              <td style={{ fontSize: '11px' }}>Available</td>
                              <td>
                                <span className={`status-pill ${p.checked_in ? 'status-success' : 'status-unscanned'}`}>
                                  {p.checked_in ? 'Checked In' : 'Belum Hadir'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 3: GENERATE QR CODE */}
          {activeTab === 'qrcode' && (
            <section className="tab-pane active" id="qrcode-tab">
              <div className="dashboard-row grid-1-2">
                <div className="dashboard-card select-participant-card">
                  <div className="card-header">
                    <h3 className="card-title">Pilih Peserta</h3>
                    <p className="card-subtitle">Pilih peserta terdaftar untuk melihat dan mengunduh QR Code tiket mereka.</p>
                  </div>
                  <div className="input-wrapper search-wrapper mb-3">
                    <Search className="input-icon" size={16} />
                    <input 
                      type="text" 
                      placeholder="Cari nama peserta..."
                      value={qrSearch}
                      onChange={(e) => setQrSearch(e.target.value)}
                    />
                  </div>
                  <div className="participant-list-selector">
                    {filteredQrParticipants.length === 0 ? (
                      <div className="empty-selector-state">
                        <p>Data peserta tidak ditemukan.</p>
                      </div>
                    ) : (
                      filteredQrParticipants.map(p => (
                        <button 
                          key={p.id}
                          className={`selector-item ${selectedParticipant?.id === p.id ? 'active' : ''}`}
                          onClick={() => setSelectedParticipant(p)}
                        >
                          <div className="selector-avatar">
                            {p.name.split(" ").map(n => n[0]).slice(0,2).join("").toUpperCase()}
                          </div>
                          <div className="selector-info">
                            <span className="selector-name">{p.name}</span>
                            <span className="selector-token font-mono">{p.token}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                <div className="dashboard-card qr-display-card-container">
                  {!selectedParticipant ? (
                    <div className="empty-qr-display" id="qr-empty-display">
                      <Ticket className="empty-qr-icon" size={48} />
                      <h3>Tidak Ada Peserta Terpilih</h3>
                      <p>Pilih peserta dari daftar di sebelah kiri untuk melihat detail tiket dan me-render QR Code unik.</p>
                    </div>
                  ) : (
                    <div className="qr-ticket-display" id="qr-ticket-content">
                      <div className="ticket-card">
                        <div className="ticket-header">
                          <div className="ticket-logo">
                            <Sparkles size={16} style={{ marginRight: '4px' }} />
                            <span>EXPO CONFERENCE 2026</span>
                          </div>
                          <span className={`ticket-badge badge-ticket-${selectedParticipant.ticketType.toLowerCase()}`}>
                            {selectedParticipant.ticketType}
                          </span>
                        </div>
                        
                        <div className="ticket-body">
                          <div className="ticket-details">
                            <div className="ticket-field">
                              <span className="field-label">NAMA PESERTA</span>
                              <span className="field-value">{selectedParticipant.name}</span>
                            </div>
                            <div className="ticket-field">
                              <span className="field-label">EMAIL</span>
                              <span className="field-value">{selectedParticipant.email}</span>
                            </div>
                            <div className="ticket-field">
                              <span className="field-label">UNIQUE TOKEN</span>
                              <span className="field-value font-mono">{selectedParticipant.token}</span>
                            </div>
                            <div className="ticket-row-two">
                              <div className="ticket-field">
                                <span className="field-label">STATUS TIKET</span>
                                <span className="field-value text-success">ACTIVE</span>
                              </div>
                              <div className="ticket-field">
                                <span className="field-label">DATE & TIME</span>
                                <span className="field-value">Jun 15, 2026 - 09:00</span>
                              </div>
                            </div>
                          </div>
                          
                          <div className="ticket-qr-zone">
                            <div className="qr-wrapper-box">
                              <canvas ref={qrCanvasRef} style={{ display: 'block' }} />
                            </div>
                            <span className="qr-hint">Scan with camera / simulator</span>
                          </div>
                        </div>
                        
                        <div className="ticket-rip-line"></div>
                        
                        <div className="ticket-footer">
                          <div className="footer-note">
                            <ShieldCheck size={14} style={{ marginRight: '4px' }} />
                            <span>Satu QR Code hanya valid untuk satu kali masuk (Anti Duplikasi).</span>
                          </div>
                          <div className="ticket-actions">
                            <button className="btn btn-secondary btn-sm btn-icon" onClick={() => window.print()}>
                              <Printer size={14} />
                              <span>Cetak Tiket</span>
                            </button>
                            <button 
                              className="btn btn-primary btn-sm btn-icon" 
                              onClick={() => {
                                setManualToken(selectedParticipant.token);
                                setScannerMode('simulator');
                                setActiveTab('scanner');
                                showToast("Token Dikirim", `Token ${selectedParticipant.name} disalin ke scanner.`, "info");
                              }}
                            >
                              <Send size={14} />
                              <span>Kirim ke Scanner</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* TAB 4: SCANNER & VALIDATION */}
          {activeTab === 'scanner' && (
            <section className="tab-pane active" id="scanner-tab">
              <div className="dashboard-row grid-2-1">
                <div className="dashboard-card scanner-main-panel">
                  <div className="scanner-header-toggle">
                    <div className="card-header p-0">
                      <h3 className="card-title">Scanner Tiket</h3>
                      <p className="card-subtitle">Simulasikan scan cepat menggunakan kamera riil atau simulator input token.</p>
                    </div>
                    
                    <div className="scanner-tabs">
                      <button 
                        className={`scan-tab-btn ${scannerMode === 'simulator' ? 'active' : ''}`}
                        onClick={() => { setScannerMode('simulator'); stopWebcam(); }}
                      >
                        <Terminal size={14} style={{ marginRight: '4px' }} />
                        <span>Virtual Simulator</span>
                      </button>
                      <button 
                        className={`scan-tab-btn ${scannerMode === 'webcam' ? 'active' : ''}`}
                        onClick={() => { setScannerMode('webcam'); startWebcam(); }}
                      >
                        <Camera size={14} style={{ marginRight: '4px' }} />
                        <span>Kamera Webcam</span>
                      </button>
                    </div>
                  </div>

                  {scannerMode === 'simulator' ? (
                    /* SCANNER MODE: SIMULATOR */
                    <div className="scan-mode-content active" id="scan-mode-simulator">
                      <div className="simulator-layout">
                        <div className="simulator-input-box">
                          <h4>Input Token / Scan Simulator</h4>
                          <p className="subtext">Simulasikan scan instan dengan memasukkan token manual atau memilih dari list cepat.</p>
                          
                          <div className="input-group">
                            <div className="input-wrapper search-wrapper">
                              <Key className="input-icon" size={16} />
                              <input 
                                type="text" 
                                placeholder="Masukkan Token (Contoh: TKT-REG-...)"
                                value={manualToken}
                                onChange={(e) => setManualToken(e.target.value)}
                              />
                            </div>
                            <button 
                              className="btn btn-primary"
                              onClick={() => {
                                handleCheckIn(manualToken, selectedGate);
                                setManualToken('');
                              }}
                            >
                              Scan Token
                            </button>
                          </div>
                          
                          <div className="quick-pick-participants-section">
                            <h5>List Tiket Cepat (Klik untuk mensimulasikan scan)</h5>
                            <div className="quick-pick-grid">
                              {participants.length === 0 ? (
                                <div className="empty-state">Load data peserta terlebih dahulu.</div>
                              ) : (
                                participants.slice(0, 12).map(p => (
                                  <button 
                                    key={p.id}
                                    className={`btn-quick-pick ${p.checked_in ? 'checked' : ''}`}
                                    onClick={() => handleCheckIn(p.token, selectedGate)}
                                  >
                                    <span className="pick-name">{p.name}</span>
                                    <span className="pick-token font-mono">{p.token.split("-")[2]}</span>
                                  </button>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="simulator-device-mockup">
                          <div className="phone-frame">
                            <div className="phone-notch"></div>
                            <div className="phone-screen">
                              <div className="phone-header">
                                <span className="phone-time">13:45</span>
                                <div className="phone-icons">
                                  <span className={`status-indicator-dot ${isOnline ? 'online' : 'offline'}`} style={{ width: '6px', height: '6px', marginRight: '6px' }}></span>
                                  <Battery size={10} />
                                </div>
                              </div>
                              
                              <div className="phone-app">
                                <div className="phone-app-header">
                                  <span className="phone-gate-name">{selectedGate}</span>
                                </div>
                                
                                <div className="scanner-viewfinder">
                                  <div className="viewfinder-box animate-pulse-border"></div>
                                  <div className="laser-scanner-line"></div>
                                  <div className="viewfinder-text">Pindai QR Code Tiket</div>
                                </div>
                                
                                <div className={`phone-result-card ${scanResult.status}`} id="phone-scan-result">
                                  <div className="result-status-icon">
                                    {scanResult.status === 'idle' && <Activity size={18} />}
                                    {scanResult.status === 'success' && <ShieldCheck size={18} />}
                                    {scanResult.status === 'duplicate' && <Copy size={18} />}
                                    {scanResult.status === 'error' && <ShieldAlert size={18} />}
                                  </div>
                                  <div className="result-details">
                                    <h4>{scanResult.title}</h4>
                                    <p style={{ whiteSpace: 'pre-line' }}>{scanResult.desc}</p>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    /* SCANNER MODE: WEBCAM HARDWARE */
                    <div className="scan-mode-content active" id="scan-mode-webcam">
                      <div className="webcam-scanner-layout">
                        <div className="webcam-feed-container">
                          {!isWebcamActive && (
                            <div className="webcam-placeholder">
                              <CameraOff className="placeholder-icon" size={36} />
                              <h4>Kamera Belum Aktif</h4>
                              <p>Izin kamera diperlukan untuk memulai pemindaian riil.</p>
                              <button className="btn btn-primary btn-icon mt-3" onClick={startWebcam}>
                                <Video size={14} style={{ marginRight: '6px' }} />
                                <span>Aktifkan Kamera</span>
                              </button>
                              
                              {/* HTTP CAMERA FALLBACK */}
                              <div id="camera-http-fallback-container" style={{ marginTop: '12px', display: 'flex', justifyContent: 'center', width: '100%' }}>
                                <button 
                                  className="btn btn-secondary btn-icon" 
                                  onClick={() => fileInputRef.current.click()}
                                  style={{ padding: '10px 16px', fontSize: '13px' }}
                                >
                                  <Camera size={14} style={{ marginRight: '6px' }} />
                                  <span>Ambil Foto QR (HTTP Fallback)</span>
                                </button>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  capture="environment" 
                                  ref={fileInputRef}
                                  onChange={handleCameraFileFallback}
                                  style={{ display: 'none' }}
                                />
                              </div>
                            </div>
                          )}
                          
                          <div className={`video-wrapper ${isWebcamActive ? '' : 'hidden'}`}>
                            <video ref={videoRef} playsInline style={{ display: 'none' }}></video>
                            <canvas ref={webcamCanvasRef} width="640" height="480"></canvas>
                            <div className="webcam-overlay-box"></div>
                            <button className="btn-camera-close-shortcut" onClick={stopWebcam} title="Stop Camera">
                              <X size={16} />
                            </button>
                          </div>
                        </div>

                        <div className="webcam-instructions-panel">
                          <h4>Hasil Scan Live Kamera</h4>
                          <div className={`phone-result-card ${scanResult.status}`} style={{ margin: 0, width: '100%' }}>
                            <div className="result-status-icon">
                              {scanResult.status === 'idle' && <Activity size={18} />}
                              {scanResult.status === 'success' && <ShieldCheck size={18} />}
                              {scanResult.status === 'duplicate' && <Copy size={18} />}
                              {scanResult.status === 'error' && <ShieldAlert size={18} />}
                            </div>
                            <div className="result-details">
                              <h4>{scanResult.title}</h4>
                              <p style={{ whiteSpace: 'pre-line' }}>{scanResult.desc}</p>
                            </div>
                          </div>

                          <div className="webcam-help-bullets mt-4">
                            <h5>Petunjuk Pemindaian:</h5>
                            <ul>
                              <li>Pegang QR code tegak lurus di depan kamera webcam.</li>
                              <li>Jarak ideal berkisar antara 10 - 25 cm dari sensor lensa.</li>
                              <li>Gunakan fallback foto jika memindai di peramban ponsel non-HTTPS.</li>
                            </ul>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="dashboard-card scanner-log-panel">
                  <div className="card-header">
                    <h3 className="card-title">Log Scan Sesi Ini</h3>
                    <p className="card-subtitle">Log validasi tiket yang berlangsung pada gerbang Anda.</p>
                  </div>
                  <div className="scanner-session-logs-list">
                    {checkInLogs.filter(l => l.gate === selectedGate).length === 0 ? (
                      <div className="empty-session-logs-state">
                        <Terminal size={24} />
                        <p>Belum ada log scan untuk pintu {selectedGate}.</p>
                      </div>
                    ) : (
                      checkInLogs.filter(l => l.gate === selectedGate).map(log => (
                        <div key={log.id} className={`scan-log-item ${log.status.toLowerCase()}`}>
                          <div className="scan-log-meta">
                            <span className="log-time">{log.time.split(" ")[1]}</span>
                            <span className={`log-status-badge ${log.status.toLowerCase()}`}>{log.status}</span>
                          </div>
                          <div className="log-msg font-mono" style={{ fontSize: '11px' }}>{log.token}</div>
                          <div className="log-msg-desc">{log.name} - {log.details}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* TAB 5: REPORTS & EXPORTS */}
          {activeTab === 'reports' && (
            <section className="tab-pane active" id="reports-tab">
              <div className="dashboard-card">
                <div className="card-header table-header-flex">
                  <div>
                    <h3 className="card-title">Log Sinkronisasi Kehadiran</h3>
                    <p className="card-subtitle">Menampilkan seluruh riwayat pencatatan scan check-in pada database.</p>
                  </div>
                  
                  <div className="table-search-actions">
                    <div className="input-wrapper search-wrapper">
                      <Search className="input-icon" size={16} />
                      <input 
                        type="text" 
                        placeholder="Filter log (nama, status, pintu)..."
                        value={logsSearch}
                        onChange={(e) => setLogsSearch(e.target.value)}
                      />
                    </div>
                    
                    <button className="btn btn-secondary btn-icon btn-sm" onClick={handleExportCsv}>
                      <Download size={14} style={{ marginRight: '4px' }} />
                      <span>Export CSV</span>
                    </button>
                    <button className="btn btn-secondary btn-icon btn-sm" onClick={() => window.print()}>
                      <FileText size={14} style={{ marginRight: '4px' }} />
                      <span>Cetak PDF</span>
                    </button>
                  </div>
                </div>
                
                <div className="table-responsive">
                  <table className="custom-table">
                    <thead>
                      <tr>
                        <th>Waktu Check-in</th>
                        <th>Nama Peserta</th>
                        <th>Token Tiket</th>
                        <th>Pintu Gerbang</th>
                        <th>Status</th>
                        <th>Detail Log</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredLogs.length === 0 ? (
                        <tr>
                          <td colSpan="6" className="table-empty-state">
                            <FileBarChart size={32} />
                            <p>Tidak ada data log yang sesuai filter pencarian.</p>
                          </td>
                        </tr>
                      ) : (
                        filteredLogs.map(log => (
                          <tr key={log.id}>
                            <td style={{ whiteSpace: 'nowrap' }}>{log.time}</td>
                            <td><strong>{log.name}</strong></td>
                            <td className="font-mono" style={{ fontSize: '11px' }}>{log.token}</td>
                            <td>{log.gate}</td>
                            <td>
                              <span className={`status-pill ${log.status === 'SUCCESS' ? 'status-success' : log.status === 'DUPLICATE' ? 'status-warning' : 'status-danger'}`}>
                                {log.status}
                              </span>
                            </td>
                            <td>{log.details}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          )}

        </div>
      </main>
    </div>
  );
}
