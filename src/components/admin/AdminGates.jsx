import React, { useState } from 'react';
import { DoorOpen, Plus, Trash2, User, Users } from 'lucide-react';

export default function AdminGates({
  supabase,
  gatesList,
  setGatesList,
  selectedGate,
  setSelectedGate,
  showToast
}) {
  const [gateName, setGateName] = useState('');
  const [genderType, setGenderType] = useState('Laki-laki');

  const handleAddGate = async (e) => {
    e.preventDefault();
    const name = gateName.trim();
    if (!name) {
      showToast("Gagal Menambah", "Nama gerbang tidak boleh kosong.", "warning");
      return;
    }

    const newGateId = `${name} (${genderType})`;

    // Check if duplicate
    const isDuplicate = gatesList.some(g => g.id.toLowerCase() === newGateId.toLowerCase());
    if (isDuplicate) {
      showToast("Pintu Duplikat", `Gerbang dengan nama "${name}" untuk gender "${genderType}" sudah terdaftar.`, "warning");
      return;
    }

    const newGate = {
      id: newGateId,
      name: name,
      type: genderType
    };

    if (supabase) {
      try {
        const { error } = await supabase
          .from('gates')
          .insert([newGate]);
        if (error) {
          showToast("Gagal Menyimpan", "Gagal menyimpan ke DB: " + error.message, "error");
          return;
        }
      } catch (err) {
        showToast("Error Koneksi", "Gagal menyambung ke database.", "error");
        return;
      }
    }

    setGatesList(prev => [...prev, newGate]);
    showToast("Gerbang Ditambahkan", `"${newGateId}" berhasil ditambahkan ke sistem.`, "success");
    setGateName('');
  };

  const handleDeleteGate = async (idToDelete) => {
    if (gatesList.length <= 1) {
      showToast("Hapus Ditolak", "Harus ada minimal satu gerbang yang aktif di dalam sistem.", "error");
      return;
    }

    if (supabase) {
      try {
        const { error } = await supabase
          .from('gates')
          .delete()
          .eq('id', idToDelete);
        if (error) {
          showToast("Gagal Menghapus", "Gagal menghapus dari DB: " + error.message, "error");
          return;
        }
      } catch (err) {
        showToast("Error Koneksi", "Gagal menyambung ke database.", "error");
        return;
      }
    }

    const updatedGates = gatesList.filter(g => g.id !== idToDelete);
    setGatesList(updatedGates);
    showToast("Gerbang Dihapus", `Gerbang "${idToDelete}" berhasil dihapus.`, "success");

    // If the deleted gate was selected, select the first remaining gate
    if (selectedGate === idToDelete) {
      const fallbackGate = updatedGates[0]?.id || '';
      setSelectedGate(fallbackGate);
      showToast("Gerbang Berubah", `Tugas gerbang dialihkan ke "${fallbackGate}" karena gerbang sebelumnya dihapus.`, "info");
    }
  };

  return (
    <section className="tab-pane active" id="gates-tab">
      <div className="dashboard-row grid-2-1" style={{ gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
        
        {/* Form Card */}
        <div className="dashboard-card" style={{ height: 'fit-content' }}>
          <div className="card-header">
            <h3 className="card-title">Tambah Gate Baru</h3>
            <p className="card-subtitle">Masukkan gerbang baru secara manual ke dalam sistem.</p>
          </div>
          
          <form onSubmit={handleAddGate} className="gate-form" style={{ padding: '16px 0' }}>
            <div className="form-group">
              <label htmlFor="gate-name-input">Nama Gerbang</label>
              <div className="input-wrapper">
                <DoorOpen className="input-icon" size={16} />
                <input
                  id="gate-name-input"
                  type="text"
                  placeholder="Misal: Gate D, Gate VIP"
                  value={gateName}
                  onChange={(e) => setGateName(e.target.value)}
                  maxLength={30}
                  required
                />
              </div>
            </div>

            <div className="form-group" style={{ marginTop: '16px' }}>
              <label htmlFor="gender-select">Kategori Gender</label>
              <div className="select-wrapper border-input">
                {genderType === 'Laki-laki' ? (
                  <User className="select-icon" size={16} style={{ position: 'absolute', left: '14px', zIndex: 2 }} />
                ) : (
                  <Users className="select-icon" size={16} style={{ position: 'absolute', left: '14px', zIndex: 2 }} />
                )}
                <select
                  id="gender-select"
                  value={genderType}
                  onChange={(e) => setGenderType(e.target.value)}
                  style={{ paddingLeft: '42px' }}
                >
                  <option value="Laki-laki">Laki-laki (Male Only)</option>
                  <option value="Perempuan">Perempuan (Female Only)</option>
                </select>
              </div>
            </div>

            <button type="submit" className="btn btn-primary btn-block" style={{ marginTop: '24px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Plus size={16} />
              <span>Tambah Gerbang</span>
            </button>
          </form>
        </div>

        {/* List Card */}
        <div className="dashboard-card">
          <div className="card-header table-header-flex">
            <div>
              <h3 className="card-title">Daftar Pintu Gerbang Aktif</h3>
              <p className="card-subtitle">Mengelola gerbang yang tersedia untuk tugas validasi check-in.</p>
            </div>
            <div>
              <span className="badge badge-beta">{gatesList.length} Total Gate</span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="custom-table">
              <thead>
                <tr>
                  <th style={{ width: '60px' }}>No.</th>
                  <th>Nama Gerbang</th>
                  <th>Kategori Gender</th>
                  <th>ID Identifikasi Sistem</th>
                  <th style={{ textAlign: 'center', width: '100px' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {gatesList.map((g, index) => {
                  const isCurrent = selectedGate === g.id;
                  return (
                    <tr key={g.id} className={isCurrent ? 'row-active-gate' : ''} style={isCurrent ? { background: 'rgba(59, 130, 246, 0.08)' } : {}}>
                      <td>{index + 1}</td>
                      <td>
                        <strong>{g.name}</strong>
                        {isCurrent && <span className="badge badge-beta" style={{ marginLeft: '8px', background: 'var(--accent-glow)', color: 'var(--accent)' }}>Aktif Anda</span>}
                      </td>
                      <td>
                        <span className={`status-pill ${g.type === 'Laki-laki' ? 'status-success' : 'status-warning'}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                          {g.type === 'Laki-laki' ? <User size={12} /> : <Users size={12} />}
                          {g.type}
                        </span>
                      </td>
                      <td className="font-mono" style={{ fontSize: '12px' }}>{g.id}</td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-danger-ghost btn-sm"
                          onClick={() => handleDeleteGate(g.id)}
                          title="Hapus Gerbang"
                          disabled={gatesList.length <= 1}
                          style={{ padding: '6px', borderRadius: '4px' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  );
}
