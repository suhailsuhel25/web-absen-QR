import React from 'react';
import UserStatusBar from './user/UserStatusBar';
import UserAuth from './user/UserAuth';
import UserHome from './user/UserHome';

export default function UserApp({ 
  supabase, 
  currentUser, 
  setCurrentUser, 
  supabaseUser, 
  setSupabaseUser, 
  showToast, 
  onBackToLanding 
}) {
  // Handle Logout
  const handleLogout = async () => {
    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch (err) {
        console.error("Signout error:", err);
      }
    }
    setSupabaseUser(null);
    setCurrentUser(null);
    showToast("Keluar Selesai", "Anda telah keluar dari aplikasi.", "info");
  };

  return (
    <div id="user-app-container" className="user-app-container">
      <div className="android-device">
        <div className="android-screen">
          <UserStatusBar />
          
          {!currentUser ? (
            <UserAuth 
              supabase={supabase}
              setCurrentUser={setCurrentUser}
              setSupabaseUser={setSupabaseUser}
              showToast={showToast}
              onBackToLanding={onBackToLanding}
            />
          ) : (
            <UserHome 
              currentUser={currentUser}
              handleLogout={handleLogout}
            />
          )}
        </div>
      </div>
    </div>
  );
}
