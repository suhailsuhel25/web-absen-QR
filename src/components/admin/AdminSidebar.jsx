import React from 'react';
import { Ticket, X, LayoutDashboard, ScanLine, FileBarChart, LogOut, DoorOpen } from 'lucide-react';

export default function AdminSidebar({
  activeTab,
  setActiveTab,
  sidebarOpen,
  setSidebarOpen,
  isOnline,
  setIsOnline,
  onLogoutAdmin
}) {
  return (
    <>
      <div 
        className={`sidebar-overlay ${sidebarOpen ? '' : 'hidden'}`} 
        onClick={() => setSidebarOpen(false)}
      ></div>
      
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

          <button 
            className={`menu-item ${activeTab === 'gates' ? 'active' : ''}`}
            onClick={() => { setActiveTab('gates'); setSidebarOpen(false); }}
          >
            <DoorOpen size={18} />
            <span>Manajemen Gate</span>
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
    </>
  );
}
