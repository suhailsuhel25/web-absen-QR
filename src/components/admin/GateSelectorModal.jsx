import React, { useState } from 'react';
import { DoorOpen, User, Users } from 'lucide-react';

export default function GateSelectorModal({ currentGate, onConfirm, gatesList = [] }) {
  const [selected, setSelected] = useState(currentGate || (gatesList[0]?.id || "Gate A (Laki-laki)"));
  
  const gates = gatesList.length > 0 ? gatesList : [
    { id: "Gate A (Laki-laki)", name: "Gate A", type: "Laki-laki" },
    { id: "Gate A (Perempuan)", name: "Gate A", type: "Perempuan" },
    { id: "Gate B (Laki-laki)", name: "Gate B", type: "Laki-laki" },
    { id: "Gate B (Perempuan)", name: "Gate B", type: "Perempuan" },
    { id: "Gate C (Laki-laki)", name: "Gate C", type: "Laki-laki" },
    { id: "Gate C (Perempuan)", name: "Gate C", type: "Perempuan" }
  ];

  return (
    <div className="modal-overlay">
      <div className="gate-selector-card">
        <div className="gate-selector-header">
          <div className="gate-logo-icon">
            <DoorOpen size={28} />
          </div>
          <h3>Pilih Gerbang Tugas</h3>
          <p>Tentukan gerbang tempat Anda bertugas saat ini untuk memvalidasi gender peserta secara tepat.</p>
        </div>

        <div className="gate-options-grid">
          {gates.map((g) => {
            const isSelected = selected === g.id;
            const isMale = g.type === "Laki-laki";
            return (
              <button
                key={g.id}
                type="button"
                className={`gate-option-btn ${isMale ? 'male-gate' : 'female-gate'} ${isSelected ? 'active' : ''}`}
                onClick={() => setSelected(g.id)}
              >
                <div className="gate-info-left">
                  <span className="gate-name-label">{g.name}</span>
                  <span className="gate-gender-tag">{g.type}</span>
                </div>
                <div className="gate-icon-right">
                  {isMale ? <User size={16} /> : <Users size={16} />}
                </div>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="btn btn-primary btn-block gate-confirm-btn"
          onClick={() => onConfirm(selected)}
        >
          Konfirmasi & Mulai Bertugas
        </button>
      </div>
    </div>
  );
}
