import React from 'react';
import { Wifi, Battery } from 'lucide-react';

export default function UserStatusBar() {
  return (
    <div className="android-status-bar">
      <span className="android-time">13:45</span>
      <div className="android-icons">
        <Wifi size={14} style={{ marginRight: '4px' }} />
        <Battery size={14} />
      </div>
    </div>
  );
}
