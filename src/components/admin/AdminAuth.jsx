import React, { useState } from 'react';
import { ShieldAlert, User, Lock, ArrowLeft, Terminal } from 'lucide-react';
import { playSound } from '../../App';

export default function AdminAuth({ supabase, onLoginSuccess, onBackToLanding, showToast }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleAdminLogin = async (e) => {
    e.preventDefault();
    if (!supabase) {
      showToast("Koneksi Error", "Supabase belum terinisialisasi.", "error");
      return;
    }

    const cleanUsername = username.trim();
    const cleanPassword = password.trim();

    if (!cleanUsername || !cleanPassword) {
      showToast("Validasi Error", "Username dan Password wajib diisi.", "warning");
      return;
    }

    setIsLoading(true);
    showToast("Autentikasi", "Memverifikasi hak akses admin...", "info");

    try {
      // Query the separate 'admins' table to verify credentials
      const { data, error } = await supabase
        .from('admins')
        .select('*')
        .eq('username', cleanUsername)
        .eq('password', cleanPassword)
        .maybeSingle(); // maybeSingle returns null if no row found instead of throwing error 406

      if (error) {
        throw new Error(error.message);
      }

      if (!data) {
        throw new Error("Username atau Password admin salah.");
      }

      // Login success
      playSound("success", true);
      showToast("Akses Diberikan", `Selamat datang kembali, Administrator ${cleanUsername}!`, "success");
      onLoginSuccess(cleanUsername);
    } catch (err) {
      console.error("Admin login error:", err);
      playSound("error", true);
      showToast("Gagal Masuk", err.message || "Gagal menghubungi database admin.", "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div id="admin-auth-container" className="user-app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: 'var(--bg-main)' }}>
      <div className="android-device" style={{ maxWidth: '420px', height: 'auto', minHeight: '520px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)' }}>
        <div className="android-screen" style={{ padding: '32px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center', height: '100%' }}>
          
          <div className="auth-header" style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '16px', background: 'var(--accent-glow, rgba(2, 107, 44, 0.08))', color: 'var(--accent, #026b2c)', marginBottom: '16px' }}>
              <ShieldAlert size={36} />
            </div>
            <h3 style={{ fontSize: '20px', fontWeight: '700', color: 'var(--text-primary)', margin: '0 0 8px 0' }}>Portal Panitia / Admin</h3>
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Masukkan kredensial khusus panitia untuk mengakses scanner & dasbor.</p>
          </div>

          <form onSubmit={handleAdminLogin} className="auth-form active">
            <div className="form-group" style={{ marginBottom: '16px' }}>
              <label htmlFor="admin-username-input">Nama Pengguna (Username)</label>
              <div className="input-wrapper">
                <User className="input-icon" size={16} />
                <input
                  id="admin-username-input"
                  type="text"
                  placeholder="Masukkan username admin"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label htmlFor="admin-password-input">Kata Sandi (Password)</label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={16} />
                <input
                  id="admin-password-input"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  required
                />
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" disabled={isLoading} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--accent, #026b2c)', border: 'none' }}>
              {isLoading ? (
                <span>Memproses...</span>
              ) : (
                <>
                  <Terminal size={16} />
                  <span>Masuk Administrator</span>
                </>
              )}
            </button>
          </form>

          <button 
            className="btn-back-to-landing" 
            onClick={onBackToLanding} 
            disabled={isLoading}
            style={{ 
              marginTop: '24px', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center', 
              width: '100%', 
              background: 'transparent', 
              border: 'none', 
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px'
            }}
          >
            <ArrowLeft size={16} style={{ marginRight: '6px' }} /> Kembali ke Beranda Peserta
          </button>

        </div>
      </div>
    </div>
  );
}
