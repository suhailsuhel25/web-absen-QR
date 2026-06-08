import React, { useEffect, useRef } from 'react';
import { Chart, registerables } from 'chart.js';
import { Users, UserCheck, Clock, Radio, Activity } from 'lucide-react';

Chart.register(...registerables);

export default function AdminDashboard({
  participants,
  checkInLogs,
  gatesList = []
}) {
  const doughnutCanvasRef = useRef(null);
  const barCanvasRef = useRef(null);
  const doughnutChartRef = useRef(null);
  const barChartRef = useRef(null);

  useEffect(() => {
    // 1. Doughnut Chart Data
    const checkedInCount = participants.filter(p => p.checked_in).length;
    const remainingCount = participants.length - checkedInCount;

    if (doughnutCanvasRef.current) {
      if (doughnutChartRef.current) doughnutChartRef.current.destroy();
      doughnutChartRef.current = new Chart(doughnutCanvasRef.current, {
        type: "doughnut",
        data: {
          labels: ["Checked In", "Belum Hadir"],
          datasets: [{
            data: [checkedInCount, remainingCount],
            backgroundColor: ["#10b981", "#1e293b"],
            borderWidth: 2,
            borderColor: "#141c2f"
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: "bottom",
              labels: { color: "#94a3b8", font: { family: "Plus Jakarta Sans", size: 10, weight: "600" }, padding: 10 }
            },
            title: { display: true, text: "STATUS KEHADIRAN", color: "#f8fafc", font: { family: "Plus Jakarta Sans", size: 11, weight: "700" } }
          },
          cutout: "70%"
        }
      });
    }

    // 2. Bar Chart Data (Check-ins per gate)
    const successLogs = checkInLogs.filter(l => l.status === 'SUCCESS');
    const gateCounts = {};
    gatesList.forEach(g => {
      gateCounts[g.id] = 0;
    });
    successLogs.forEach(log => {
      if (gateCounts[log.gate] !== undefined) {
        gateCounts[log.gate]++;
      }
    });

    if (barCanvasRef.current) {
      if (barChartRef.current) barChartRef.current.destroy();
      barChartRef.current = new Chart(barCanvasRef.current, {
        type: "bar",
        data: {
          labels: gatesList.map(g => `${g.name} (${g.type === 'Laki-laki' ? 'L' : 'P'})`),
          datasets: [{
            label: "Check-ins",
            data: gatesList.map(g => gateCounts[g.id] || 0),
            backgroundColor: gatesList.map(g => g.type === 'Laki-laki' ? '#3b82f6' : '#ec4899'),
            borderRadius: 6,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            title: { display: true, text: "VOLUME TICKETS PER PINTU", color: "#f8fafc", font: { family: "Plus Jakarta Sans", size: 11, weight: "700" } }
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: "#94a3b8", font: { family: "Plus Jakarta Sans", size: 9, weight: "600" } } },
            y: { 
              grid: { color: "#1e293b" }, 
              ticks: { color: "#94a3b8", font: { family: "Plus Jakarta Sans", size: 9 }, stepSize: 1 },
              beginAtZero: true
            }
          }
        }
      });
    }

    return () => {
      if (doughnutChartRef.current) doughnutChartRef.current.destroy();
      if (barChartRef.current) barChartRef.current.destroy();
    };
  }, [participants, checkInLogs, gatesList]);

  return (
    <section className="tab-pane active" id="dashboard-tab">
      <div className="metrics-grid">
        <div className="metric-card border-accent">
          <div className="metric-icon bg-accent-glow">
            <Users size={20} className="text-accent" />
          </div>
          <div className="metric-info">
            <span className="metric-label">Total Peserta</span>
            <h3 className="metric-val">{participants.length}</h3>
            <span className="metric-subtext">Registered in database</span>
          </div>
        </div>

        <div className="metric-card border-success">
          <div className="metric-icon bg-success-glow">
            <UserCheck size={20} className="text-success" />
          </div>
          <div className="metric-info">
            <span className="metric-label">Checked In</span>
            <h3 className="metric-val">
              {participants.filter(p => p.checked_in).length}
            </h3>
            <span className="metric-subtext">
              {participants.length > 0 
                ? Math.round((participants.filter(p => p.checked_in).length / participants.length) * 100) 
                : 0
              }% success rate
            </span>
          </div>
        </div>

        <div className="metric-card border-warning">
          <div className="metric-icon bg-warning-glow">
            <Clock size={20} className="text-warning" />
          </div>
          <div className="metric-info">
            <span className="metric-label">Belum Hadir</span>
            <h3 className="metric-val">
              {participants.filter(p => !p.checked_in).length}
            </h3>
            <span className="metric-subtext">Waiting for arrival</span>
          </div>
        </div>

        <div className="metric-card border-info">
          <div className="metric-icon bg-info-glow">
            <Radio size={20} className="text-info" />
          </div>
          <div className="metric-info">
            <span className="metric-label">Active Gates</span>
            <h3 className="metric-val">{gatesList.length}</h3>
            <span className="metric-subtext">Receiving live scans</span>
          </div>
        </div>
      </div>

      <div className="dashboard-row grid-2-1">
        <div className="dashboard-card chart-container-card">
          <div className="card-header">
            <h3 className="card-title">Analisis Kehadiran Realtime</h3>
            <p className="card-subtitle">Perbandingan status check-in dan volume per gerbang.</p>
          </div>
          <div className="chart-flex-wrapper">
            <div className="chart-box">
              <canvas ref={doughnutCanvasRef}></canvas>
            </div>
            <div className="chart-box">
              <canvas ref={barCanvasRef}></canvas>
            </div>
          </div>
        </div>

        <div className="dashboard-card activity-feed-card">
          <div className="card-header">
            <div className="card-title-flex">
              <h3 className="card-title">Live Check-in Feed</h3>
              <span className="live-indicator"><span className="ping-dot"></span>LIVE</span>
            </div>
            <p className="card-subtitle">Aktivitas masuk di seluruh gerbang.</p>
          </div>
          <div className="feed-list">
            {checkInLogs.length === 0 ? (
              <div className="empty-feed-state">
                <Activity size={32} />
                <p>Belum ada aktivitas masuk. Jalankan scan untuk melihat data di sini.</p>
              </div>
            ) : (
              checkInLogs.slice(0, 10).map((log) => (
                <div key={log.id} className={`feed-item ${log.status.toLowerCase()}`}>
                  <div className="feed-status-line"></div>
                  <div className="feed-item-header">
                    <span className="feed-name">{log.name}</span>
                    <span className="feed-time">{log.time.split(" ")[1]}</span>
                  </div>
                  <div className="feed-item-detail">
                    Token: <span className="font-mono">{log.token.substring(0, 12)}</span> | Pintu: {log.gate}
                  </div>
                  <div className="feed-item-desc">{log.details}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <div className="dashboard-card helper-card">
        <div className="card-header">
          <h3 className="card-title">Cara Mensimulasikan Alur Sistem:</h3>
        </div>
        <div className="flow-steps-timeline">
          <div className="flow-step">
            <div className="step-num">1</div>
            <h4>Registrasi User</h4>
            <p>Gunakan opsi <strong>"Peserta Event"</strong> di landing page, daftar akun baru. QR Code dan token unik dihasilkan secara otomatis.</p>
          </div>
          <div className="flow-step">
            <div className="step-num">2</div>
            <h4>Buka Admin Scanner</h4>
            <p>Buka sesi <strong>"Panitia / Admin"</strong> di tab lain atau di halaman ini. Aktifkan kamera scanner atau simulator token.</p>
          </div>
          <div className="flow-step">
            <div className="step-num">3</div>
            <h4>Proses Pemindaian</h4>
            <p>Scan QR code dari layar ponsel peserta. Validasi anti-duplikasi akan memproses status check-in seketika.</p>
          </div>
          <div className="flow-step">
            <div className="step-num">4</div>
            <h4>Pantau Realtime</h4>
            <p>Status kehadiran pada HP peserta akan otomatis terupdate menjadi "Sudah Hadir" melalui sistem sinkronisasi realtime database Supabase.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
