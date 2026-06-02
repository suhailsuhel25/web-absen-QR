import React from 'react';
import { QrCode, Smartphone, Monitor } from 'lucide-react';

export default function LandingScreen({ onSelectRole }) {
  return (
    <section id="landing-screen" className="landing-screen">
      <div className="landing-card">
        <div className="landing-logo">
          <div className="logo-icon-lg">
            <QrCode size={40} />
          </div>
          <h2>QREvent <span className="text-accent">Portal</span></h2>
          <p>Event Check-in & Ticket Management System</p>
        </div>
        
        <div className="role-selector-box">
          <h3>Pilih Akses Masuk</h3>
          <div className="role-buttons">
            <button className="btn-role" onClick={() => onSelectRole('user')}>
              <div className="role-icon-box bg-accent-glow text-accent">
                <Smartphone size={24} />
              </div>
              <div className="role-info">
                <span className="role-title">Peserta Event</span>
                <span className="role-desc">Tampilkan E-Tiket & QR Code (Android UI)</span>
              </div>
            </button>

            <button className="btn-role" onClick={() => onSelectRole('admin')}>
              <div className="role-icon-box bg-success-glow text-success">
                <Monitor size={24} />
              </div>
              <div className="role-info">
                <span className="role-title">Panitia / Admin</span>
                <span className="role-desc">Scanner Kehadiran & Live Dashboard</span>
              </div>
            </button>
          </div>
        </div>

        <div className="landing-footer" style={{ justifyContent: 'center', color: 'var(--text-muted)' }}>
          <span>&copy; 2026 QREvent. All rights reserved.</span>
        </div>
      </div>
    </section>
  );
}
