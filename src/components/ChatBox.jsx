import { useState, useEffect, useRef } from "react";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, setDoc, updateDoc, arrayUnion, arrayRemove, getDocs, where, deleteDoc } from "firebase/firestore"; 
import { db } from "../firebase";
import { FiSend, FiArrowLeft, FiUsers, FiUser } from "react-icons/fi"; // FiInfo remove kora holo
import ChatDetails from "./ChatDetails"; 
import "../App.css";

const ChatBox = ({ roomId, currentUserUid, setActiveRoomId }) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState([]); 
  const [roomData, setRoomData] = useState(null);
  const [usersMap, setUsersMap] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      let map = {};
      snapshot.forEach((doc) => { map[doc.data().uid] = doc.data(); });
      setUsersMap(map);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const unsubscribe = onSnapshot(doc(db, "chatRooms", roomId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoomData(data);
        if (data.typing) {
          const activeTypers = Object.keys(data.typing).filter(
            uid => uid !== currentUserUid && data.typing[uid] === true
          );
          setTypingUsers(activeTypers);
        } else setTypingUsers([]);
      }
    });
    return () => unsubscribe();
  }, [roomId, currentUserUid]);

  useEffect(() => {
    if (roomId && roomData && roomData.unreadCounts && roomData.unreadCounts[currentUserUid] > 0) {
      updateDoc(doc(db, "chatRooms", roomId), {
        [`unreadCounts.${currentUserUid}`]: 0
      }).catch(e => console.error("Error clearing unread counts:", e));
    }
  }, [roomId, roomData?.unreadCounts?.[currentUserUid], currentUserUid]);

  useEffect(() => {
    if (!roomId) return;
    const q = query(collection(db, `chatRooms/${roomId}/messages`), orderBy("timestamp", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let currentMessages = [];
      snapshot.forEach((doc) => currentMessages.push({ id: doc.id, ...doc.data() }));
      setMessages(currentMessages);
    });
    return () => unsubscribe();
  }, [roomId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers]);

  const handleTyping = async (e) => {
    setMessage(e.target.value);
    const roomRef = doc(db, "chatRooms", roomId);
    await setDoc(roomRef, { typing: { [currentUserUid]: true } }, { merge: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(async () => {
      await setDoc(roomRef, { typing: { [currentUserUid]: false } }, { merge: true });
    }, 1500);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (message.trim() === "") return;
    const msgText = message;
    setMessage(""); 
    let newUnreadCounts = { ...(roomData.unreadCounts || {}) };
    roomData.participants.forEach(uid => {
      if (uid !== currentUserUid) newUnreadCounts[uid] = (newUnreadCounts[uid] || 0) + 1; 
    });
    const roomRef = doc(db, "chatRooms", roomId);
    await setDoc(roomRef, { 
      typing: { [currentUserUid]: false },
      unreadCounts: newUnreadCounts
    }, { merge: true });
    try {
      await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
        text: msgText, senderId: currentUserUid, timestamp: serverTimestamp(),
      });
    } catch (error) { console.error(error); }
  };

  const formatTime = (firebaseTimestamp) => {
    if (!firebaseTimestamp) return "Sending...";
    const date = firebaseTimestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDateLabel = (firebaseTimestamp) => {
    if (!firebaseTimestamp) return "Today";
    const msgDate = firebaseTimestamp.toDate();
    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);
    if (msgDate.toDateString() === today.toDateString()) return "Today";
    else if (msgDate.toDateString() === yesterday.toDateString()) return "Yesterday";
    else return msgDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const sendSystemMessage = async (text) => {
    try {
      await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
        text: text, 
        isSystemMessage: true, 
        timestamp: serverTimestamp(),
      });
    } catch (error) { console.error("Error sending system msg:", error); }
  };

  const creatorUid = roomData?.createdBy || (roomData?.participants ? roomData.participants[0] : null);
  const adminsArray = roomData?.admins || [creatorUid];
  const isCreator = currentUserUid === creatorUid;
  const isAdmin = adminsArray.includes(currentUserUid) || isCreator;

  const handleAddMember = async (targetUid) => {
    await updateDoc(doc(db, "chatRooms", roomId), { 
      participants: arrayUnion(targetUid),
      [`unreadCounts.${targetUid}`]: 0,
      [`joinedAt.${targetUid}`]: serverTimestamp()
    });
    const adderName = usersMap[currentUserUid]?.username || "Admin";
    const targetName = usersMap[targetUid]?.username || "User";
    sendSystemMessage(`${adderName} added ${targetName}`);
  };

  const handleRemoveMember = async (targetUid) => {
    const removerName = usersMap[currentUserUid]?.username || "Admin";
    const targetName = usersMap[targetUid]?.username || "User";
    await updateDoc(doc(db, "chatRooms", roomId), { participants: arrayRemove(targetUid), admins: arrayRemove(targetUid) });
    sendSystemMessage(`${removerName} removed ${targetName}`);
  };

  const handleMakeAdmin = async (targetUid) => {
    const adderName = usersMap[currentUserUid]?.username || "Admin";
    const targetName = usersMap[targetUid]?.username || "User";
    await updateDoc(doc(db, "chatRooms", roomId), { admins: arrayUnion(targetUid) });
    sendSystemMessage(`${adderName} made ${targetName} an Admin`);
  };

  const handleRemoveAdmin = async (targetUid) => {
    const removerName = usersMap[currentUserUid]?.username || "Admin";
    const targetName = usersMap[targetUid]?.username || "User";
    await updateDoc(doc(db, "chatRooms", roomId), { admins: arrayRemove(targetUid) });
    sendSystemMessage(`${removerName} dismissed ${targetName} as Admin`);
  };

  const handleLeaveGroup = async () => {
    const confirm = window.confirm("Are you sure you want to leave this group?");
    if (confirm) {
      const leaverName = usersMap[currentUserUid]?.username || "Someone";
      await updateDoc(doc(db, "chatRooms", roomId), { participants: arrayRemove(currentUserUid), admins: arrayRemove(currentUserUid) });
      await sendSystemMessage(`${leaverName} left the group`);
      setActiveRoomId(null);
      setShowDetails(false);
    }
  };

  const handleClearChat = async () => {
    const confirm = window.confirm("Are you sure you want to clear this chat for yourself?");
    if (confirm) {
      await updateDoc(doc(db, "chatRooms", roomId), { [`joinedAt.${currentUserUid}`]: serverTimestamp() });
      setShowDetails(false);
    }
  };

  const handleDeleteGroup = async () => {
    const confirm = window.confirm("Are you sure you want to delete this group completely?");
    if (confirm) {
      await deleteDoc(doc(db, "chatRooms", roomId)); 
      setActiveRoomId(null);
      setShowDetails(false);
    }
  };

  const startDirectChat = async (targetUserUid) => {
    const q = query(collection(db, "chatRooms"), where("participants", "array-contains", currentUserUid));
    const querySnapshot = await getDocs(q);
    let existingRoomId = null;
    querySnapshot.forEach((doc) => {
      const room = doc.data();
      if (room.type === "direct" && room.participants.includes(targetUserUid)) existingRoomId = doc.id;
    });

    if (existingRoomId) setActiveRoomId(existingRoomId);
    else {
      const newRoomRef = await addDoc(collection(db, "chatRooms"), {
        type: "direct", participants: [currentUserUid, targetUserUid], createdAt: serverTimestamp(),
        unreadCounts: { [currentUserUid]: 0, [targetUserUid]: 0 },
        joinedAt: { [currentUserUid]: serverTimestamp(), [targetUserUid]: serverTimestamp() }
      });
      setActiveRoomId(newRoomRef.id);
    }
  };

  let chatTitle = "Loading..."; 
  let defaultSubtitle = "";
  let isGroup = false;

  if (roomData) {
    if (roomData.type === "group") {
      chatTitle = roomData.groupName; 
      defaultSubtitle = `Group · ${roomData.participants.length} members`;
      isGroup = true;
    } else {
      const otherUserUid = roomData.participants.find(uid => uid !== currentUserUid);
      if (otherUserUid && usersMap[otherUserUid]) {
        chatTitle = usersMap[otherUserUid].username; 
        defaultSubtitle = usersMap[otherUserUid].position; 
      }
    }
  }

  let isTyping = typingUsers.length > 0;
  let displaySubtitle = defaultSubtitle;
  if (isTyping) {
    if (roomData?.type === "direct") displaySubtitle = "typing...";
    else {
      const typingNames = typingUsers.map(uid => usersMap[uid]?.username || "Someone").join(", ");
      displaySubtitle = `${typingNames} typing...`;
    }
  }

  const usersNotInGroup = Object.values(usersMap).filter(u => roomData?.participants && !roomData.participants.includes(u.uid));
  const myJoinTime = roomData?.joinedAt?.[currentUserUid]?.toMillis() || 0;
  
  const visibleMessages = messages.filter(msg => {
    const msgTime = msg.timestamp?.toMillis() || Date.now();
    return msgTime >= myJoinTime;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      
      {/* HEADER: Kono 'Details' button nei, puro Header tai clickable */}
      <div className="chat-header" onClick={() => setShowDetails(true)} style={{cursor: 'pointer'}}>
        <div style={{display: 'flex', alignItems: 'center'}}>
          <button className="btn-back" onClick={(e) => { e.stopPropagation(); setActiveRoomId(null); }}>
            <FiArrowLeft />
          </button>
          
          <div className="avatar" style={{ width: '40px', height: '40px', minWidth: '40px', fontSize: '16px', backgroundColor: isGroup ? '#00a884' : '#dfe5e7', color: isGroup ? '#fff' : '#54656f', marginRight: '12px' }}>
            {isGroup ? <FiUsers /> : (chatTitle !== "Loading..." ? chatTitle.charAt(0) : <FiUser />)}
          </div>
          
          <div className="chat-header-info">
            <h4>{chatTitle}</h4>
            {displaySubtitle && <p className={isTyping ? "typing-text-header" : ""}>{displaySubtitle}</p>}
          </div>
        </div>
      </div>

      <div className="message-list">
        
        {/* --- CHAT INTRO (WhatsApp Style First Screen) --- */}
        <div className="chat-intro">
          <div className="avatar-large" style={{ backgroundColor: isGroup ? '#00a884' : '#dfe5e7', color: isGroup ? '#fff' : '#54656f' }}>
            {isGroup ? <FiUsers /> : (chatTitle !== "Loading..." ? chatTitle.charAt(0) : <FiUser />)}
          </div>
          <h2>{chatTitle}</h2>
          <p>{defaultSubtitle || "Crodyto Secure Chat"}</p>
        </div>
        {/* ------------------------------------------------ */}

        {visibleMessages.map((msg, index) => {
          const currentLabel = getDateLabel(msg.timestamp);
          const previousLabel = index > 0 ? getDateLabel(visibleMessages[index - 1].timestamp) : null;
          const showDateDivider = currentLabel !== previousLabel; 

          return (
            <div key={msg.id}>
              {showDateDivider && (
                <div className="date-divider-wrapper">
                  <span className="date-divider">{currentLabel}</span>
                </div>
              )}
              
              {msg.isSystemMessage ? (
                <div className="system-message-wrapper">
                  <span className="system-message">{msg.text}</span>
                </div>
              ) : (
                <div className={`message-row ${msg.senderId === currentUserUid ? "my-message" : "other-message"}`}>
                  <div className="message-content">
                    {roomData?.type === "group" && msg.senderId !== currentUserUid && (
                      <span className="sender-name">{usersMap[msg.senderId]?.username || "Unknown"}</span>
                    )}
                    <div className="message-bubble">
                      <span className="message-text">{msg.text}</span>
                      <span className="message-time">{formatTime(msg.timestamp)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSendMessage} className="chat-form">
        <input type="text" placeholder="Type a message..." value={message} onChange={handleTyping} className="chat-form-input" />
        <button type="submit" className="btn-send"><FiSend /></button>
      </form>

      {showDetails && (
        <ChatDetails 
          roomData={roomData} usersMap={usersMap} currentUserUid={currentUserUid} creatorUid={creatorUid} adminsArray={adminsArray} isAdmin={isAdmin} isCreator={isCreator} usersNotInGroup={usersNotInGroup}
          onClose={() => setShowDetails(false)} handleAddMember={handleAddMember} handleRemoveMember={handleRemoveMember} handleMakeAdmin={handleMakeAdmin} handleRemoveAdmin={handleRemoveAdmin} onStartDirectChat={startDirectChat} 
          handleClearChat={handleClearChat} handleDeleteGroup={handleDeleteGroup} handleLeaveGroup={handleLeaveGroup}
        />
      )}
    </div>
  );
};

export default ChatBox;