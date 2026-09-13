import { useState, useEffect } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import ChatBox from "../components/ChatBox";
import Sidebar from "../components/Sidebar";
import Profile from "../components/Profile";
import { FiEdit3, FiLogOut, FiMessageSquare } from "react-icons/fi";
import "../App.css";

const ChatDashboard = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUser(user);
      else navigate("/");
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await signOut(auth);
    navigate("/");
  };

  if (!currentUser) return <div style={{textAlign: "center", marginTop: "20vh"}}>Loading Workspace...</div>;

  return (
    <div className="dashboard-container">
      
      {/* Sidebar: Mobile-e chat select thakle eta hide hoye jabe */}
      <div className={`sidebar-container ${activeRoomId ? "hide-on-mobile" : ""}`}>
        <div className="app-title-container">
          <h2 className="app-title"> <FiMessageSquare /> Crodyto Chat</h2>
        </div>
        <Sidebar 
          currentUserUid={currentUser.uid} 
          setActiveRoomId={setActiveRoomId} 
          activeRoomId={activeRoomId} 
        />
      </div>

      {/* Main Chat Area: Mobile-e chat select na thakle eta hide hoye jabe */}
      <div className={`main-chat-area ${!activeRoomId ? "hide-on-mobile" : ""}`}>
        <div className="top-header">
          <button className="btn-icon btn-profile" onClick={() => setIsProfileOpen(true)}>
            <FiEdit3 /> Edit Profile
          </button>
          <button className="btn-icon btn-logout" onClick={handleLogout}>
            <FiLogOut /> Logout
          </button>
        </div>
        
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

      <Profile currentUserUid={currentUser.uid} isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
};

export default ChatDashboard;