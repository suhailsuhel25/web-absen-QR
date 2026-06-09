import React from 'react';
import { LogOut } from 'lucide-react';

export default function UserProfile({ currentUser, handleLogout }) {
  return (
    <div className="android-tab-content active" id="android-tab-profile">
      <div className="profile-header-circle">
        <div className="profile-avatar-lg" id="user-profile-avatar">
          {currentUser.name
            ? currentUser.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
            : 'U'
          }
        </div>
        <h4 id="user-profile-name">{currentUser.name}</h4>
        <p id="user-profile-email">{currentUser.email}</p>
      </div>

      <div className="profile-details-list">
        <div className="profile-detail-item">
          <span className="profile-label">Nomor Tiket</span>
          <span className="profile-val font-mono" id="profile-token-val">{currentUser.token}</span>
        </div>
        <div className="profile-detail-item">
          <span className="profile-label">Status Kehadiran</span>
          <span className={`profile-val ${currentUser.checked_in ? 'text-success' : 'text-warning'}`} id="profile-status-val">
            {currentUser.checked_in ? 'Sudah Check-in' : 'Belum Check-in'}
          </span>
        </div>
        <div className="profile-detail-item">
          <span className="profile-label">Waktu Check-in</span>
          <span className="profile-val" id="profile-time-val">
            {currentUser.checked_in && currentUser.check_in_time 
              ? new Date(currentUser.check_in_time).toLocaleString("id-ID")
              : '-'
            }
          </span>
        </div>
      </div>

      <button className="btn btn-secondary btn-block mt-4" onClick={handleLogout} id="btn-logout-profile">
        <LogOut size={16} style={{ marginRight: '6px' }} /> Keluar Akun
      </button>
    </div>
  );
}
