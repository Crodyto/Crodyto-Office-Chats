import { useEffect, useRef } from "react";
import { FiPhone, FiPhoneOff } from "react-icons/fi";

const IncomingCallModal = ({ callerName, onAccept, onReject }) => {
  const audioRef = useRef(null);

  useEffect(() => {
    // 1. Audio setup and play
    audioRef.current = new Audio("/ringtone.mp3");
    audioRef.current.loop = true;

    const playAudio = async () => {
      try {
        await audioRef.current.play();
      } catch (err) {
        console.error("Audio playback blocked by browser:", err);
      }
    };

    playAudio();

    // 2. Mobile Vibration Pattern (1 sec vibrate, 0.5 sec pause)
    if ("vibrate" in navigator) {
      navigator.vibrate([1000, 500, 1000, 500, 1000, 500, 1000, 500]);
    }

    // 3. Cleanup: Sound & Vibration stop when modal unmounts
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
      if ("vibrate" in navigator) {
        navigator.vibrate(0);
      }
    };
  }, []);

  const handleAccept = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if ("vibrate" in navigator) {
      navigator.vibrate(0);
    }
    onAccept();
  };

  const handleReject = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if ("vibrate" in navigator) {
      navigator.vibrate(0);
    }
    onReject();
  };

  return (
    <div style={{
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: '#111b21',
      color: '#fff',
      padding: '16px 20px',
      borderRadius: '12px',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
      zIndex: 9999,
      display: 'flex',
      alignItems: 'center',
      gap: '15px'
    }}>
      <div>
        <h4 style={{ margin: 0, fontSize: '16px', color: '#fff' }}>{callerName || "Someone"}</h4>
        <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#00a884' }}>Incoming Call...</p>
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        <button 
          onClick={handleAccept} 
          style={{
            backgroundColor: '#25D366',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <FiPhone size={20} />
        </button>

        <button 
          onClick={handleReject} 
          style={{
            backgroundColor: '#ea4335',
            color: '#fff',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <FiPhoneOff size={20} />
        </button>
      </div>
    </div>
  );
};

export default IncomingCallModal;