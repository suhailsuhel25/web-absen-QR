import React, { useState } from 'react';
import { 
  Ticket, Mail, Lock, User, Phone, MapPin, Calendar, Home, Users, ArrowLeft 
} from 'lucide-react';
import { playSound } from '../../App';

export default function UserAuth({ 
  supabase, 
  setCurrentUser, 
  setSupabaseUser, 
  showToast, 
  onBackToLanding 
}) {
  const [authTab, setAuthTab] = useState('login'); // 'login' | 'register'
  
  // Auth Form Fields
  const [loginPhone, setLoginPhone] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regGender, setRegGender] = useState('Laki-laki');
  const [regBirthPlace, setRegBirthPlace] = useState('');
  const [regBirthDate, setRegBirthDate] = useState('');
  const [regProvince, setRegProvince] = useState('');
  const [regRegency, setRegRegency] = useState('');
  const [regDistrict, setRegDistrict] = useState('');
  const [regVillage, setRegVillage] = useState('');
  const [regAddress, setRegAddress] = useState('');

  // Unique Token Generator
  const generateUniqueToken = () => {
    const chars = "0123456789ABCDEF";
    let tokenSuffix = "";
    for (let i = 0; i < 8; i++) {
      tokenSuffix += chars[Math.floor(Math.random() * chars.length)];
    }
    return `TKT-${tokenSuffix}`;
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
      const authEmail = `${loginPhone.trim()}@qrevent.com`;
      const { data, error } = await supabase.auth.signInWithPassword({
        email: authEmail,
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
        token: profile.ticket_token,
        checked_in: profile.checked_in,
        check_in_time: profile.check_in_time,
        check_in_gate: profile.check_in_gate
      });

      showToast("Masuk Berhasil", "Selamat datang kembali di QREvent!", "success");
    } catch (err) {
      console.error(err);
      showToast("Gagal Masuk", err.message || "Nomor telepon atau kata sandi salah.", "error");
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

    if (
      !regPhone.trim() ||
      !regEmail.trim() ||
      !regPassword.trim() ||
      !regName.trim() ||
      !regBirthPlace.trim() ||
      !regBirthDate.trim() ||
      !regProvince.trim() ||
      !regRegency.trim() ||
      !regDistrict.trim() ||
      !regVillage.trim() ||
      !regAddress.trim()
    ) {
      showToast("Validasi Error", "Semua kolom pendaftaran wajib diisi.", "warning");
      return;
    }

    if (regPassword.length < 6) {
      showToast("Validasi Error", "Kata sandi minimal 6 karakter.", "warning");
      return;
    }

    try {
      showToast("Menghubungkan", "Membuat akun baru...", "info");
      const authEmail = `${regPhone.trim()}@qrevent.com`;
      const { data, error: authError } = await supabase.auth.signUp({
        email: authEmail,
        password: regPassword
      });

      if (authError) throw authError;

      const user = data.user;
      if (!user) throw new Error("Registrasi gagal. Silakan coba nomor telepon lain.");

      const generatedToken = generateUniqueToken();

      // Insert into public profiles table
      showToast("Menyimpan Profil", "Membuat data tiket unik...", "info");
      const { error: profileError } = await supabase
        .from('profiles')
        .insert([{
          id: user.id,
          name: regName,
          email: regEmail || null,
          phone: regPhone,
          gender: regGender,
          birth_place: regBirthPlace,
          birth_date: regBirthDate || null,
          province: regProvince,
          regency: regRegency,
          district: regDistrict,
          village: regVillage,
          full_address: regAddress,
          ticket_token: generatedToken,
          checked_in: false
        }]);

      if (profileError) throw profileError;

      setSupabaseUser(user);
      setCurrentUser({
        id: user.id,
        name: regName,
        email: regEmail,
        phone: regPhone,
        gender: regGender,
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

  return (
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
            <label>Nomor Telepon</label>
            <div className="input-wrapper">
              <Phone className="input-icon" size={16} />
              <input 
                type="tel" 
                placeholder="Contoh: 08123456789" 
                value={loginPhone}
                onChange={(e) => setLoginPhone(e.target.value)}
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

          {/* 1. Nomor Telepon */}
          <div className="form-group">
            <label>Nomor Telepon</label>
            <div className="input-wrapper">
              <Phone className="input-icon" size={16} />
              <input
                type="tel"
                placeholder="08123456789"
                value={regPhone}
                onChange={(e) => setRegPhone(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 2. Email */}
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

          {/* Kata Sandi */}
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

          {/* 3. Nama Lengkap */}
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

          {/* 4. Jenis Kelamin */}
          <div className="form-group">
            <label>Jenis Kelamin</label>
            <div className="select-wrapper border-input">
              <Users className="select-icon" size={16} />
              <select
                value={regGender}
                onChange={(e) => setRegGender(e.target.value)}
              >
                <option value="Laki-laki">Laki-laki</option>
                <option value="Perempuan">Perempuan</option>
              </select>
            </div>
          </div>

          {/* 5. Tempat Lahir */}
          <div className="form-group">
            <label>Tempat Lahir</label>
            <div className="input-wrapper">
              <MapPin className="input-icon" size={16} />
              <input
                type="text"
                placeholder="Kota lahir"
                value={regBirthPlace}
                onChange={(e) => setRegBirthPlace(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 6. Tanggal Lahir */}
          <div className="form-group">
            <label>Tanggal Lahir</label>
            <div className="input-wrapper">
              <Calendar className="input-icon" size={16} />
              <input
                type="date"
                value={regBirthDate}
                onChange={(e) => setRegBirthDate(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 7. Provinsi */}
          <div className="form-group">
            <label>Provinsi</label>
            <div className="input-wrapper">
              <MapPin className="input-icon" size={16} />
              <input
                type="text"
                placeholder="Contoh: Jawa Barat"
                value={regProvince}
                onChange={(e) => setRegProvince(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 8. Kabupaten */}
          <div className="form-group">
            <label>Kabupaten / Kota</label>
            <div className="input-wrapper">
              <MapPin className="input-icon" size={16} />
              <input
                type="text"
                placeholder="Contoh: Kab. Bogor"
                value={regRegency}
                onChange={(e) => setRegRegency(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 9. Kecamatan */}
          <div className="form-group">
            <label>Kecamatan</label>
            <div className="input-wrapper">
              <MapPin className="input-icon" size={16} />
              <input
                type="text"
                placeholder="Nama kecamatan"
                value={regDistrict}
                onChange={(e) => setRegDistrict(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 10. Desa */}
          <div className="form-group">
            <label>Desa / Kelurahan</label>
            <div className="input-wrapper">
              <Home className="input-icon" size={16} />
              <input
                type="text"
                placeholder="Nama desa/kelurahan"
                value={regVillage}
                onChange={(e) => setRegVillage(e.target.value)}
                required
              />
            </div>
          </div>

          {/* 11. Alamat Lengkap */}
          <div className="form-group">
            <label>Alamat Lengkap</label>
            <textarea
              placeholder="Jl. Contoh No. 123, RT 01/RW 02"
              value={regAddress}
              onChange={(e) => setRegAddress(e.target.value)}
              rows={3}
              required
              style={{
                width: '100%',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-color)',
                borderRadius: '10px',
                padding: '10px 14px',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: '12px',
                lineHeight: '1.5',
                resize: 'none',
                outline: 'none',
                boxSizing: 'border-box',
                display: 'block'
              }}
            />
          </div>

          <button type="submit" className="btn btn-primary btn-block">Daftar Akun</button>
        </form>
      )}
    </div>
  );
}
