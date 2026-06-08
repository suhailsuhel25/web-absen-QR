import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { Sparkles, LogOut, Ticket, User, Clock } from 'lucide-react';
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
          <span>EXPO 2026</span>
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
                <span className="event-tag">CONFERENCE TICKET</span>
                <h4 className="event-title">EXPO EVENT 2026</h4>
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
