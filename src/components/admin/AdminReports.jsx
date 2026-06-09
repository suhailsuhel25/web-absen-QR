import React, { useState } from 'react';
import { Search, Download, FileText, FileBarChart } from 'lucide-react';

export default function AdminReports({ checkInLogs, showToast }) {
  const [logsSearch, setLogsSearch] = useState('');

  const handleExportCsv = () => {
    if (checkInLogs.length === 0) {
      showToast("Export Failed", "Log check-in kosong, tidak ada data untuk diexport.", "warning");
      return;
    }

    let csvContent = "data:text/csv;charset=utf-8,";
    csvContent += "Waktu Check-in,Nama,Token,Gerbang,Status,Keterangan\n";

    checkInLogs.forEach(log => {
      csvContent += `"${log.time}","${log.name}","${log.token}","${log.gate}","${log.status}","${log.details}"\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `log_kehadiran_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast("CSV Exported", "File CSV log kehadiran berhasil diunduh.", "success");
  };

  const filteredLogs = checkInLogs.filter(l => 
    l.name.toLowerCase().includes(logsSearch.toLowerCase()) ||
    l.token.toLowerCase().includes(logsSearch.toLowerCase()) ||
    l.gate.toLowerCase().includes(logsSearch.toLowerCase()) ||
    l.status.toLowerCase().includes(logsSearch.toLowerCase())
  );

  return (
    <section className="tab-pane active" id="reports-tab">
      <div className="dashboard-card">
        <div className="card-header table-header-flex">
          <div>
            <h3 className="card-title">Log Sinkronisasi Kehadiran</h3>
            <p className="card-subtitle">Menampilkan seluruh riwayat pencatatan scan check-in pada database.</p>
          </div>
          
          <div className="table-search-actions">
            <div className="input-wrapper search-wrapper">
              <Search className="input-icon" size={16} />
              <input 
                type="text" 
                placeholder="Filter log (nama, status, pintu)..."
                value={logsSearch}
                onChange={(e) => setLogsSearch(e.target.value)}
              />
            </div>
            
            <button className="btn btn-secondary btn-icon btn-sm" onClick={handleExportCsv}>
              <Download size={14} style={{ marginRight: '4px' }} />
              <span>Export CSV</span>
            </button>
            <button className="btn btn-secondary btn-icon btn-sm" onClick={() => window.print()}>
              <FileText size={14} style={{ marginRight: '4px' }} />
              <span>Cetak PDF</span>
            </button>
          </div>
        </div>
        
        <div className="table-responsive">
          <table className="custom-table">
            <thead>
              <tr>
                <th>Waktu Check-in</th>
                <th>Nama Peserta</th>
                <th>Token Tiket</th>
                <th>Pintu Gerbang</th>
                <th>Status</th>
                <th>Detail Log</th>
              </tr>
            </thead>
            <tbody>
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan="6" className="table-empty-state">
                    <FileBarChart size={32} />
                    <p>Tidak ada data log yang sesuai filter pencarian.</p>
                  </td>
                </tr>
              ) : (
                filteredLogs.map(log => (
                  <tr key={log.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{log.time}</td>
                    <td><strong>{log.name}</strong></td>
                    <td className="font-mono" style={{ fontSize: '11px' }}>{log.token}</td>
                    <td>{log.gate}</td>
                    <td>
                      <span className={`status-pill ${log.status === 'SUCCESS' ? 'status-success' : log.status === 'DUPLICATE' ? 'status-warning' : 'status-danger'}`}>
                        {log.status}
                      </span>
                    </td>
                    <td>{log.details}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
