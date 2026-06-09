import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { 
  Terminal, Camera, Key, Battery, Activity, ShieldCheck, Copy, ShieldAlert, 
  CameraOff, Video, X, Phone 
} from 'lucide-react';
import { playSound } from '../../App';

export default function AdminScanner({
  isOnline,
  selectedGate,
  soundEnabled,
  participants,
  checkInLogs,
  showToast,
  handleCheckIn
}) {
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

  // Clean up webcam scan animation loop and stream on unmount or mode change
  useEffect(() => {
    return () => stopWebcam();
  }, []);

  useEffect(() => {
    if (scannerMode !== 'webcam') {
      stopWebcam();
    }
  }, [scannerMode]);

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
        videoRef.current.setAttribute("playsinline", true);
        videoRef.current.play();
        setIsWebcamActive(true);
        scanLoopRef.current = requestAnimationFrame(tickScan);
        showToast("Kamera Aktif", "Arahkan kamera ke QR Code peserta.", "success");
      }
    } catch (err) {
      console.error("Camera access error:", err);
      showToast("Kamera Diblokir", "Gagal membuka kamera. Pastikan Anda mengizinkan akses kamera.", "error");
      
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
        
        if (!scanThrottleRef.current) {
          scanThrottleRef.current = true;
          
          // Delegate database check and trigger local UI response
          triggerLocalCheckIn(code.data);
          
          setTimeout(() => {
            scanThrottleRef.current = false;
          }, 3000);
        }
      }
    }
    scanLoopRef.current = requestAnimationFrame(tickScan);
  };

  const triggerLocalCheckIn = async (token) => {
    // Perform standard checkin which updates local state & DB
    await handleCheckIn(token, selectedGate);
    
    // Determine the result state by looking at participant list
    const participant = participants.find(p => p.token === token.trim() || p.phone === token.trim());
    if (!participant) {
      setScanResult({
        status: 'error',
        title: 'Tiket Tidak Valid',
        desc: `Token '${token}' tidak terdaftar di database.`
      });
    } else {
      const isMaleGate = selectedGate.includes("(Laki-laki)");
      const isFemaleGate = selectedGate.includes("(Perempuan)");
      const isGenderMismatch = participant.gender && (
        (participant.gender === "Laki-laki" && isFemaleGate) || 
        (participant.gender === "Perempuan" && isMaleGate)
      );

      if (isGenderMismatch) {
        setScanResult({
          status: 'error',
          title: 'Blocked (Salah Pintu)',
          desc: `Gender Mismatch:\nPeserta (${participant.gender}) tidak boleh masuk lewat ${selectedGate}.`
        });
        return;
      }

      const isAlreadyChecked = participant.checked_in || participant.checkInTime !== null;
      if (isAlreadyChecked) {
        const prevGate = participant.check_in_gate || participant.checkInGate || selectedGate;
        const prevTime = participant.check_in_time || participant.checkInTime || "Baru saja";
        setScanResult({
          status: 'duplicate',
          title: 'Sudah Di-scan',
          desc: `Data sudah masuk.\nTiket milik ${participant.name} sudah discan sebelumnya di ${prevGate} pada ${prevTime.includes('T') ? new Date(prevTime).toLocaleTimeString() : prevTime}.`
        });
      } else {
        setScanResult({
          status: 'success',
          title: isOnline ? 'Check-in Berhasil' : 'Check-in Offline (Disimpan)',
          desc: `Nama: ${participant.name}\nPintu: ${selectedGate}\nWaktu: ${new Date().toLocaleTimeString()}`
        });
      }
    }
  };

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
        triggerLocalCheckIn(code.data);
      } else {
        showToast("Dekode Gagal", "QR code tidak terbaca. Pastikan foto fokus dan pencahayaan terang.", "error");
        playSound("error", soundEnabled);
      }
    };
    img.src = URL.createObjectURL(file);
  };

  return (
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
                onClick={() => { setScannerMode('simulator'); }}
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
                  <h4>Input No HP / Scan Simulator</h4>
                  <p className="subtext">Simulasikan scan instan dengan memasukkan nomor HP manual atau memilih dari list cepat.</p>
                  
                  <div className="input-group">
                    <div className="input-wrapper search-wrapper">
                      <Phone className="input-icon" size={16} />
                      <input 
                        type="text" 
                        placeholder="Masukkan No HP (Contoh: 08123456789)"
                        value={manualToken}
                        onChange={(e) => setManualToken(e.target.value)}
                      />
                    </div>
                    <button 
                      className="btn btn-primary"
                      onClick={() => {
                        triggerLocalCheckIn(manualToken);
                        setManualToken('');
                      }}
                    >
                      Scan No HP
                    </button>
                  </div>
                  
                  <div className="quick-pick-participants-section">
                    <h5>List No HP Cepat (Klik untuk mensimulasikan scan)</h5>
                    <div className="quick-pick-grid">
                      {participants.length === 0 ? (
                        <div className="empty-state">Load data peserta terlebih dahulu.</div>
                      ) : (
                        participants.slice(0, 12).map(p => (
                          <button 
                            key={p.id}
                            className={`btn-quick-pick ${p.checked_in ? 'checked' : ''}`}
                            onClick={() => triggerLocalCheckIn(p.phone || '')}
                          >
                            <span className="pick-name">{p.name}</span>
                            <span className="pick-token font-mono">{p.phone || 'No HP'}</span>
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
  );
}
