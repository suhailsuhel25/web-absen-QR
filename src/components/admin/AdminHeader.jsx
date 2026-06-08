import React from 'react';
import { Menu, Volume2, VolumeX, DoorOpen, RefreshCw } from 'lucide-react';

export default function AdminHeader({
  activeTab,
  setSidebarOpen,
  soundEnabled,
  setSoundEnabled,
  selectedGate,
  offlineQueue,
  isSyncing
}) {
  return (
    <header className="top-bar">
      <div className="top-bar-left-wrapper">
        <button className="btn-menu-toggle" onClick={() => setSidebarOpen(true)} title="Open Sidebar">
          <Menu size={20} />
        </button>
        <div className="page-title-container">
          <h1>
            {activeTab === 'dashboard' && 'Dashboard Overview'}
            {activeTab === 'scanner' && 'Scanner Kehadiran'}
            {activeTab === 'reports' && 'Laporan Check-in'}
          </h1>
          <p>
            {activeTab === 'dashboard' && 'Real-time event analytics and simulation diagnostics.'}
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

        <div className="static-gate-badge">
          <DoorOpen className="select-icon" size={16} />
          <span className="static-gate-text">{selectedGate}</span>
        </div>

        <div className={`sync-status-badge ${offlineQueue.length > 0 ? '' : 'hidden'} ${isSyncing ? 'syncing' : ''}`}>
          <RefreshCw size={14} className={isSyncing ? 'spin' : ''} />
          <span>{offlineQueue.length}</span> Pending Sync
        </div>
      </div>
    </header>
  );
}
