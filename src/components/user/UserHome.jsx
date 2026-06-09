import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Sparkles, LogOut, Ticket, User, Clock, Download } from 'lucide-react';
import UserProfile from './UserProfile';

export default function UserHome({ currentUser, handleLogout }) {
  const [userTab, setUserTab] = useState('ticket'); // 'ticket' | 'profile'
  const canvasRef = useRef(null);

  // Render QR Code inside user home ticket
  useEffect(() => {
    if (currentUser?.token && canvasRef.current && userTab === 'ticket') {
      QRCode.toCanvas(canvasRef.current, currentUser.token, {
        width: 132,
        margin: 1,
        color: {
          dark: '#0f172a',
          light: '#ffffff'
        }
      }, (error) => {
        if (error) console.error("QR Code generation error:", error);
      });
    }
  }, [currentUser?.token, userTab]);

  const handleDownloadQR = () => {
    if (canvasRef.current) {
      try {
        // Create an in-memory canvas for the receipt ticket
        const ticketCanvas = document.createElement("canvas");
        ticketCanvas.width = 400;
        ticketCanvas.height = 600;
        const ctx = ticketCanvas.getContext("2d");

        // 1. Draw Background (Off-white Receipt Paper)
        ctx.fillStyle = "#f8fafc";
        ctx.fillRect(0, 0, ticketCanvas.width, ticketCanvas.height);

        // Draw header background (Dark slate banner)
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(0, 0, ticketCanvas.width, 100);

        // 2. Draw Header Typography
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        
        ctx.font = "bold 24px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText("Matholek fest 2026", ticketCanvas.width / 2, 48);

        // 3. Draw Ticket Info Section
        ctx.textAlign = "left";
        ctx.fillStyle = "#0f172a";
        
        ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText("TICKET INFORMATION", 35, 148);
        
        ctx.font = "500 12px 'Plus Jakarta Sans', sans-serif";
        ctx.fillStyle = "#475569";
        ctx.fillText("Location: Kajen, Margoyoso, Pati", 35, 171);

        // 4. Draw Participant Info Section
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 13px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText("PARTICIPANT DETAILS", 35, 215);
        
        ctx.font = "500 12px 'Plus Jakarta Sans', sans-serif";
        ctx.fillStyle = "#475569";
        ctx.fillText(`Name:     ${currentUser.name || "-"}`, 35, 238);
        ctx.fillText(`Gender:   ${currentUser.gender || "-"}`, 35, 258);
        ctx.fillText(`Phone:    ${currentUser.phone || "-"}`, 35, 278);

        // 5. Draw Dotted Tear Line with side notches
        ctx.strokeStyle = "#cbd5e1";
        ctx.lineWidth = 1.5;
        ctx.setLineDash([6, 6]);
        ctx.beginPath();
        ctx.moveTo(20, 110);
        ctx.lineTo(ticketCanvas.width - 20, 110);
        ctx.stroke();
        ctx.setLineDash([]); // Reset line dash

        // Draw Notch cuts (transparent circle slices)
        ctx.globalCompositeOperation = "destination-out";
        ctx.beginPath();
        ctx.arc(0, 110, 8, 0, Math.PI * 2);
        ctx.arc(ticketCanvas.width, 110, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = "source-over"; // Reset composite operation

        // 6. Draw QR Code
        const qrSize = 160;
        const qrX = (ticketCanvas.width - qrSize) / 2;
        const qrY = 310;
        ctx.drawImage(canvasRef.current, qrX, qrY, qrSize, qrSize);

        // 7. Draw Token & Footer details
        ctx.textAlign = "center";
        ctx.fillStyle = "#0f172a";
        ctx.font = "bold 20px 'Courier New', monospace";
        ctx.fillText(currentUser.token || "-", ticketCanvas.width / 2, 495);

        ctx.fillStyle = "#64748b";
        ctx.font = "500 10px 'Plus Jakarta Sans', sans-serif";
        ctx.fillText("*This ticket is valid for single entry only.", ticketCanvas.width / 2, 535);

        // Convert canvas to image and trigger download
        const url = ticketCanvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.href = url;
        const safeName = currentUser.name ? currentUser.name.replace(/\s+/g, "_").toLowerCase() : 'user';
        link.download = `tiket_receipt_${safeName}_${currentUser.token}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
      } catch (err) {
        console.error("Gagal mengunduh Struk E-Tiket:", err);
      }
    }
  };

  const getStatusText = () => {
    return currentUser?.checked_in ? "Sudah Hadir" : "Belum Hadir";
  };

  const getStatusClass = () => {
    return currentUser?.checked_in ? "status-success" : "status-unscanned";
  };

  return (
    <div id="user-home-screen" className="user-screen-content active">
      <header className="android-app-header">
        <div className="android-app-logo">
          <Sparkles size={16} style={{ marginRight: '4px' }} />
          <span>Matholek fest 2026</span>
        </div>
        <button className="btn-logout-icon" onClick={handleLogout} title="Log Out">
          <LogOut size={16} />
        </button>
      </header>

      {userTab === 'ticket' ? (
        /* USER TICKET SUB-TAB */
        <div className="android-tab-content active" id="android-tab-ticket">
          <div className="android-welcome-card">
            <p className="greeting">Halo,</p>
            <h4 id="user-display-name">{currentUser.name}</h4>
            <p className="sub-greeting">Tunjukkan E-Tiket di bawah ini saat memasuki ruangan event.</p>
          </div>

          {/* Ticket Card Visualization */}
          <div className="mobile-ticket">
            <div className="mobile-ticket-header">
              <div>
                <h4 className="event-title">Matholek Fest 2026</h4>
              </div>
            </div>

            <div className="mobile-ticket-body">
              <div className="mobile-qr-box">
                <div className="user-qr-renderer">
                  <canvas ref={canvasRef} style={{ display: 'block' }} />
                </div>
                <div className="scan-laser-line"></div>
              </div>
              <span className="mobile-token-label" id="user-ticket-token">{currentUser.token}</span>
            </div>

            <div className="mobile-ticket-footer">
              <div className={`ticket-status-pill ${getStatusClass()}`} id="user-checkin-status-card">
                <Clock size={12} style={{ marginRight: '4px' }} />
                <span id="user-checkin-status-text">{getStatusText()}</span>
              </div>
              {currentUser.checked_in && (
                <div className="gate-info-text" id="user-gate-info-box">
                  Pintu Masuk: <span id="user-gate-label">{currentUser.check_in_gate || 'Gate A'}</span>
                </div>
              )}
            </div>
          </div>

          <button 
            className="btn btn-secondary btn-sm btn-icon btn-block mt-3"
            onClick={handleDownloadQR}
            style={{ 
              maxWidth: '180px', 
              margin: '16px auto 0 auto', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            <Download size={14} />
            <span>Unduh QR Tiket</span>
          </button>
        </div>
      ) : (
        /* USER PROFILE SUB-TAB */
        <UserProfile currentUser={currentUser} handleLogout={handleLogout} />
      )}

      {/* Android Bottom Navigation Bar */}
      <nav className="android-nav-bar">
        <button 
          className={`android-nav-item ${userTab === 'ticket' ? 'active' : ''}`}
          onClick={() => setUserTab('ticket')}
        >
          <Ticket size={16} />
          <span>Tiket Saya</span>
        </button>
        <button 
          className={`android-nav-item ${userTab === 'profile' ? 'active' : ''}`}
          onClick={() => setUserTab('profile')}
        >
          <User size={16} />
          <span>Profil</span>
        </button>
      </nav>
    </div>
  );
}
