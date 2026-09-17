import { useState, useEffect, useRef } from "react";
import { auth, db } from "../firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import { doc, onSnapshot, collectionGroup, query, orderBy } from "firebase/firestore";
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
  const [roomData, setRoomData] = useState(null);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [currentUsername, setCurrentUsername] = useState("");
  const [activeCallType, setActiveCallType] = useState(null); 
  const [incomingCallData, setIncomingCallData] = useState(null);
  const navigate = useNavigate();

  const notificationAudio = useRef(new Audio("https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3"));
  const lastMessageTimes = useRef({});

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

  useEffect(() => {
    if (!activeRoomId) {
      setRoomData(null);
      return;
    }

    const unsubRoom = onSnapshot(doc(db, "chatRooms", activeRoomId), (docSnap) => {
      if (docSnap.exists()) {
        setRoomData({ id: docSnap.id, ...docSnap.data() });
      }
    });

    return () => unsubRoom();
  }, [activeRoomId]);

  // Global Message Listener
  useEffect(() => {
    if (!currentUser) return;

    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    const q = query(collectionGroup(db, "messages"), orderBy("timestamp", "asc"));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const msgData = change.doc.data();
          const msgTime = msgData.timestamp?.toMillis() || Date.now();
          
          if (
            msgData.senderId !== currentUser.uid &&
            !msgData.isSystemMessage &&
            msgTime > (lastMessageTimes.current[change.doc.id] || 0)
          ) {
            lastMessageTimes.current[change.doc.id] = msgTime;
            notificationAudio.current.play().catch(e => console.log("Audio autoplay restricted:", e));

            if (Notification.permission === "granted") {
              new Notification("Crodyto Chat", {
                body: msgData.text || "New message received",
                icon: "/favicon.ico"
              });
            }
          }
        }
      });
    });

    return () => unsubscribeMessages();
  }, [currentUser]);

  // Global Incoming Call Listener
  useEffect(() => {
    if (!currentUser) return;

    const callsQuery = query(collectionGroup(db, "calls"));

    const unsubscribeCalls = onSnapshot(callsQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" || change.type === "modified") {
          const callData = change.doc.data();
          
          if (callData.callerId !== currentUser.uid && callData.status === "calling") {
            const pathSegments = change.doc.ref.path.split("/");
            const foundRoomId = pathSegments.length >= 2 ? pathSegments[1] : null;

            if (foundRoomId) {
              setActiveRoomId(foundRoomId);
            }

            setIncomingCallData(callData);
            setActiveCallType(callData.callType);

            notificationAudio.current.loop = true;
            notificationAudio.current.play().catch(e => console.log("Call audio blocked:", e));

            if (Notification.permission === "granted") {
              new Notification("Incoming Call...", {
                body: `${callData.callerName || "Someone"} is calling you (${callData.callType})`,
                icon: "/favicon.ico"
              });
            }
          } else if (callData.status === "ended" || callData.status === "answered") {
            notificationAudio.current.pause();
            notificationAudio.current.currentTime = 0;
            notificationAudio.current.loop = false;
            
            if (callData.status === "ended") {
              setActiveCallType(null);
              setIncomingCallData(null);
            }
          }
        }
      });
    });

    return () => {
      unsubscribeCalls();
      notificationAudio.current.pause();
    };
  }, [currentUser]);

  const handleStartCall = (type) => {
    setIncomingCallData(null);
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
              roomData={roomData} 
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
            notificationAudio.current.pause();
            notificationAudio.current.currentTime = 0;
            notificationAudio.current.loop = false;
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
