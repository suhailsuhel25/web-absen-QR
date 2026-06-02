import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { 
  Wifi, Battery, Ticket, Mail, Lock, User, Tag, 
  ArrowLeft, Sparkles, LogOut, Clock, ShieldCheck
} from 'lucide-react';
import { playSound } from '../App';

export default function UserApp({ 
  supabase, 
  currentUser, 
  setCurrentUser, 
  supabaseUser, 
  setSupabaseUser, 
  showToast, 
  onBackToLanding 
}) {
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  const [userTab, setUserTab] = useState('ticket'); // 'ticket' | 'profile'
  
  // Auth Form Fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regTicketType, setRegTicketType] = useState('Regular');
  
  const canvasRef = useRef(null);

  // Render QR Code inside user home ticket
  useEffect(() => {
    if (currentUser?.token && canvasRef.current) {
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

  // Unique Token Generator
  const generateUniqueToken = (category) => {
    const chars = "0123456789ABCDEF";
    let tokenSuffix = "";
    for (let i = 0; i < 5; i++) {
      tokenSuffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `TKT-${category.toUpperCase()}-${tokenSuffix}`;
  };

  // Handle Login
  const handleLogin = async (e) => {
    e.preventDefault();
    if (!supabase) {
      showToast("Koneksi Error", "Supabase belum terinisialisasi.", "error");
      return;
    }

    try {
      showToast("Menghubungkan", "Memverifikasi akun Anda...", "info");
      const { data, error } = await supabase.auth.signInWithPassword({
        email: loginEmail,
        password: loginPassword
      });

      if (error) throw error;

      // Load Profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error("Profil peserta tidak ditemukan.");
      }

      setSupabaseUser(data.user);
      setCurrentUser({
        id: profile.id,
        name: profile.name,
        email: profile.email,
        ticketType: profile.ticket_type,
        token: profile.ticket_token,
        checked_in: profile.checked_in,
        check_in_time: profile.check_in_time,
        check_in_gate: profile.check_in_gate
      });

      showToast("Masuk Berhasil", "Selamat datang kembali di QREvent!", "success");
    } catch (err) {
      console.error(err);
      showToast("Gagal Masuk", err.message || "Email atau kata sandi salah.", "error");
      playSound("error", true);
    }
  };

  // Handle Registration
  const handleRegister = async (e) => {
    e.preventDefault();
    if (!supabase) {
      showToast("Koneksi Error", "Supabase belum terinisialisasi.", "error");
      return;
    }

    if (regPassword.length < 6) {
      showToast("Validasi Error", "Kata sandi minimal 6 karakter.", "warning");
      return;
    }

    try {
      showToast("Menghubungkan", "Membuat akun baru...", "info");
      const { data, error: authError } = await supabase.auth.signUp({
        email: regEmail,
        password: regPassword
      });

      if (authError) throw authError;

      const user = data.user;
      if (!user) throw new Error("Registrasi gagal. Silakan coba email lain.");

      const generatedToken = generateUniqueToken(regTicketType);

      // Insert into public profiles table
      showToast("Menyimpan Profil", "Membuat data tiket unik...", "info");
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          name: regName,
          email: regEmail,
          ticket_type: regTicketType,
          ticket_token: generatedToken,
          checked_in: false
        }]);

      if (profileError) throw profileError;

      setSupabaseUser(user);
      setCurrentUser({
        id: user.id,
        name: regName,
        email: regEmail,
        ticketType: regTicketType,
        token: generatedToken,
        checked_in: false,
        check_in_time: null,
        check_in_gate: null
      });

      showToast("Pendaftaran Berhasil", "Selamat! E-Tiket Anda telah siap.", "success");
    } catch (err) {
      console.error(err);
      showToast("Registrasi Gagal", err.message || "Terjadi kesalahan saat mendaftar.", "error");
      playSound("error", true);
    }
  };

  // Handle Logout
  const handleLogout = async () => {
    if (supabase) {
      await supabase.auth.signOut();
    }
    setSupabaseUser(null);
    setCurrentUser(null);
    setUserTab('ticket');
    setAuthTab('login');
    showToast("Keluar Selesai", "Anda telah keluar dari aplikasi.", "info");
  };

  const getStatusText = () => {
    return currentUser?.checked_in ? "Sudah Hadir" : "Belum Hadir";
  };

  const getStatusClass = () => {
    return currentUser?.checked_in ? "status-success" : "status-unscanned";
  };

  return (
    <div id="user-app-container" className="user-app-container">
      <div className="android-device">
        <div className="android-screen">
          {/* Status bar */}
          <div className="android-status-bar">
            <span className="android-time">13:45</span>
            <div className="android-icons">
              <Wifi size={14} style={{ marginRight: '4px' }} />
              <Battery size={14} />
            </div>
          </div>

          {!currentUser ? (
            /* USER AUTHENTICATION SCREEN */
            <div id="user-auth-screen" className="user-screen-content active">
              <div className="auth-header">
                <Ticket className="auth-logo-icon" size={32} />
                <h3>Selamat Datang</h3>
                <p>Daftarkan akun untuk mendapatkan E-Tiket konferensi Anda.</p>
              </div>

              {/* Auth Tabs */}
              <div className="auth-tabs">
                <button 
                  className={`auth-tab-btn ${authTab === 'login' ? 'active' : ''}`}
                  onClick={() => setAuthTab('login')}
                >
                  Masuk
                </button>
                <button 
                  className={`auth-tab-btn ${authTab === 'register' ? 'active' : ''}`}
                  onClick={() => setAuthTab('register')}
                >
                  Daftar
                </button>
              </div>

              {/* Sign In Form */}
              {authTab === 'login' && (
                <form id="user-login-form" className="auth-form active" onSubmit={handleLogin}>
                  <div className="form-group">
                    <label>Alamat Email</label>
                    <div className="input-wrapper">
                      <Mail className="input-icon" size={16} />
                      <input 
                        type="email" 
                        placeholder="email@domain.com" 
                        value={loginEmail}
                        onChange={(e) => setLoginEmail(e.target.value)}
                        required 
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Kata Sandi</label>
                    <div className="input-wrapper">
                      <Lock className="input-icon" size={16} />
                      <input 
                        type="password" 
                        placeholder="••••••••" 
                        value={loginPassword}
                        onChange={(e) => setLoginPassword(e.target.value)}
                        required 
                      />
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-block">Masuk</button>
                </form>
              )}

              {/* Sign Up Form */}
              {authTab === 'register' && (
                <form id="user-register-form" className="auth-form active" onSubmit={handleRegister}>
                  <div className="form-group">
                    <label>Nama Lengkap</label>
                    <div className="input-wrapper">
                      <User className="input-icon" size={16} />
                      <input 
                        type="text" 
                        placeholder="Nama lengkap Anda" 
                        value={regName}
                        onChange={(e) => setRegName(e.target.value)}
                        required 
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Alamat Email</label>
                    <div className="input-wrapper">
                      <Mail className="input-icon" size={16} />
                      <input 
                        type="email" 
                        placeholder="email@domain.com" 
                        value={regEmail}
                        onChange={(e) => setRegEmail(e.target.value)}
                        required 
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Kata Sandi</label>
                    <div className="input-wrapper">
                      <Lock className="input-icon" size={16} />
                      <input 
                        type="password" 
                        placeholder="Minimal 6 karakter" 
                        value={regPassword}
                        onChange={(e) => setRegPassword(e.target.value)}
                        required 
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Kategori Tiket</label>
                    <div className="select-wrapper border-input">
                      <Tag className="select-icon" size={16} />
                      <select 
                        value={regTicketType} 
                        onChange={(e) => setRegTicketType(e.target.value)}
                      >
                        <option value="Regular">Regular Class</option>
                        <option value="VIP">VIP Entrance</option>
                        <option value="VVIP">VVIP / Speaker</option>
                      </select>
                    </div>
                  </div>
                  <button type="submit" className="btn btn-primary btn-block">Daftar Akun</button>
                </form>
              )}

              <button className="btn-back-to-landing mt-4" onClick={onBackToLanding}>
                <ArrowLeft size={16} style={{ marginRight: '6px' }} /> Kembali ke Menu Utama
              </button>
            </div>
          ) : (
            /* USER MAIN HOME & TICKET SCREEN */
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
                      <span className="mobile-ticket-badge" id="user-ticket-type">
                        {currentUser.ticketType}
                      </span>
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
                <div className="android-tab-content active" id="android-tab-profile">
                  <div className="profile-header-circle">
                    <div className="profile-avatar-lg" id="user-profile-avatar">
                      {currentUser.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()}
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
                      <span className="profile-label">Kelas Tiket</span>
                      <span className="profile-val" id="profile-type-val">{currentUser.ticketType} Ticket</span>
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
          )}
        </div>
      </div>
    </div>
  );
}
