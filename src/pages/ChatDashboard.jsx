import { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import ChatBox from "../components/ChatBox";
import Sidebar from "../components/Sidebar";
import Profile from "../components/Profile";
import CallModal from "../components/CallModal";
import { FiMessageSquare, FiUser, FiPhone, FiVideo } from "react-icons/fi";
import "../App.css";

const ChatDashboard = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentUsername, setCurrentUsername] = useState("");
  const [activeCallType, setActiveCallType] = useState(null); // 'audio' or 'video'
  const [incomingCallData, setIncomingCallData] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUser(user);
      else navigate("/");
    });
    return () => unsubscribe();
  }, [navigate]);

  useEffect(() => {
    if (currentUser) {
      const unsub = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) setCurrentUsername(docSnap.data().username || "");
      });
      return () => unsub();
    }
  }, [currentUser]);

  // Incoming Call Listener (Fixed Bug)
  useEffect(() => {
    if (!currentUser || !activeRoomId) return;

    const callDocRef = doc(db, "rooms", activeRoomId, "calls", "currentCall");
    const unsubscribeCall = onSnapshot(callDocRef, (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Caller হলেDashboard Listener কোনো হস্তক্ষেপ করবে না (Modal নিজের স্টেট সামলাবে)
        if (data.callerId === currentUser.uid) {
          return;
        }

        // Receiver এর জন্য চেক করা হচ্ছে
        if (data.status === "calling") {
          setIncomingCallData(data);
          setActiveCallType(data.callType);
        } else if (data.status === "ended") {
          setActiveCallType(null);
          setIncomingCallData(null);
        }
      }
    });

    return () => unsubscribeCall();
  }, [currentUser, activeRoomId]);

  const handleStartCall = (type) => {
    setIncomingCallData(null); // Fresh call initialization
    setActiveCallType(type);
  };

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (!currentUser) return <div style={{textAlign: "center", marginTop: "20vh"}}>Loading Workspace...</div>;

  return (
    <div className="dashboard-container">
      
      {/* --- Sidebar Container --- */}
      <div className={`sidebar-container ${activeRoomId ? "hide-on-mobile" : ""}`}>
        <div className="app-title-container" style={{display: 'flex', alignItems: 'center'}}>
          <h2 className="app-title"> <FiMessageSquare /> Crodyto Chat</h2>
          <div className="header-profile-avatar" onClick={() => setIsProfileOpen(true)}>
            {currentUsername ? currentUsername.charAt(0) : <FiUser />}
          </div>
        </div>
        
        <Sidebar 
          currentUserUid={currentUser.uid} 
          setActiveRoomId={(id) => {
            setActiveRoomId(id);
            setActiveCallType(null);
            setIncomingCallData(null);
          }} 
          activeRoomId={activeRoomId} 
        />
      </div>

      {/* --- Main Chat Area --- */}
      <div className={`main-chat-area ${!activeRoomId ? "hide-on-mobile" : ""}`}>
        {activeRoomId && (
          <div className="chat-header">
            <div className="chat-header-info"></div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px', marginLeft: 'auto' }}>
              <button 
                onClick={() => handleStartCall("audio")} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#54656f', fontSize: '20px', display: 'flex', alignItems: 'center', padding: '5px' }}
                title="Start Audio Call"
              >
                <FiPhone />
              </button>
              <button 
                onClick={() => handleStartCall("video")} 
                style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#54656f', fontSize: '22px', display: 'flex', alignItems: 'center', padding: '5px' }}
                title="Start Video Call"
              >
                <FiVideo />
              </button>
            </div>
          </div>
        )}

        <div className="chatbox-wrapper">
          {activeRoomId ? (
            <ChatBox 
              roomId={activeRoomId} 
              currentUserUid={currentUser.uid} 
              setActiveRoomId={setActiveRoomId} 
            />
          ) : (
            <div style={{display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', color: '#6b7280'}}>
              <div style={{textAlign: 'center'}}>
                <FiMessageSquare size={48} style={{opacity: 0.2, marginBottom: '10px'}}/>
                <p>Select a conversation to start chatting</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Call Modal Popup */}
      {activeCallType && activeRoomId && (
        <CallModal 
          roomId={activeRoomId} 
          currentUserUid={currentUser.uid} 
          callType={activeCallType} 
          incomingCallData={incomingCallData}
          onClose={() => {
            setActiveCallType(null);
            setIncomingCallData(null);
          }} 
        />
      )}

      {/* Profile Component */}
      <Profile 
        currentUserUid={currentUser.uid} 
        isOpen={isProfileOpen} 
        onClose={() => setIsProfileOpen(false)} 
        onLogout={handleLogout}
      />
    </div>
  );
};

export default ChatDashboard;
