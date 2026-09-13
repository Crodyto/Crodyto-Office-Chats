import { useState, useEffect } from "react";
import { auth, db } from "../firebase"; // db import kora holo
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import ChatBox from "../components/ChatBox";
import Sidebar from "../components/Sidebar";
import Profile from "../components/Profile";
import { FiMessageSquare, FiUser } from "react-icons/fi";
import "../App.css";

const ChatDashboard = () => {
  const [currentUser, setCurrentUser] = useState(null);
  const [activeRoomId, setActiveRoomId] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentUsername, setCurrentUsername] = useState(""); // Username dhore rakhar state
  const navigate = useNavigate();

  // Auth check kora
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) setCurrentUser(user);
      else navigate("/");
    });
    return () => unsubscribe();
  }, [navigate]);

  // Login kora user er nam fetch kora jate Avatar toiri kora jay
  useEffect(() => {
    if (currentUser) {
      const unsub = onSnapshot(doc(db, "users", currentUser.uid), (docSnap) => {
        if (docSnap.exists()) setCurrentUsername(docSnap.data().username || "");
      });
      return () => unsub();
    }
  }, [currentUser]);

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
          
          {/* Ekhane chole aslo Profile Logo! */}
          <div className="header-profile-avatar" onClick={() => setIsProfileOpen(true)}>
            {currentUsername ? currentUsername.charAt(0) : <FiUser />}
          </div>
        </div>
        
        <Sidebar 
          currentUserUid={currentUser.uid} 
          setActiveRoomId={setActiveRoomId} 
          activeRoomId={activeRoomId} 
        />
      </div>

      {/* --- Main Chat Area --- */}
      <div className={`main-chat-area ${!activeRoomId ? "hide-on-mobile" : ""}`}>
        
        {/* Ekhane aage .top-header (Logout button) chilo, ota ekdum DELETE kore dewa holo */}
        
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

      {/* Profile Component e onLogout pass kora holo */}
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