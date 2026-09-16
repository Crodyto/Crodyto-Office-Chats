import { useState, useEffect, useRef } from "react";
import { 
  collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, 
  doc, setDoc, updateDoc, arrayUnion, arrayRemove, getDocs, where, deleteDoc 
} from "firebase/firestore"; 
import { db } from "../firebase";
import { FiSend, FiArrowLeft, FiUsers, FiUser } from "react-icons/fi";
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
      snapshot.forEach((doc) => { map[doc.data().uid || doc.id] = doc.data(); });
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
    if (!roomId || !currentUserUid || messages.length === 0) return;

    messages.forEach((msg) => {
      if (!msg.isSystemMessage && msg.senderId !== currentUserUid && (!msg.seenBy || !msg.seenBy.includes(currentUserUid))) {
        const msgRef = doc(db, `chatRooms/${roomId}/messages`, msg.id);
        updateDoc(msgRef, {
          seenBy: arrayUnion(currentUserUid)
        }).catch(e => console.error("Error updating seen status:", e));
      }
    });
  }, [roomId, messages, currentUserUid]);

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

    let newUnreadCounts = { ...(roomData?.unreadCounts || {}) };
    roomData?.participants?.forEach(uid => {
      if (uid !== currentUserUid) newUnreadCounts[uid] = (newUnreadCounts[uid] || 0) + 1; 
    });

    const roomRef = doc(db, "chatRooms", roomId);
    await setDoc(roomRef, { 
      typing: { [currentUserUid]: false },
      unreadCounts: newUnreadCounts
    }, { merge: true });

    try {
      await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
        text: msgText, 
        senderId: currentUserUid, 
        timestamp: serverTimestamp(),
        seenBy: [currentUserUid]
      });
    } catch (error) { 
      console.error(error); 
    }
  };

  const formatTime = (firebaseTimestamp) => {
    if (!firebaseTimestamp) return "";
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

  const renderTickStatus = (msg) => {
    if (!msg.timestamp) return <span style={{ color: '#8696a0', fontSize: '11px', marginLeft: '4px' }}>🕒</span>;
    
    const seenBy = msg.seenBy || [msg.senderId];
    const otherParticipants = roomData?.participants?.filter(uid => uid !== currentUserUid) || [];
    const isSeenByAll = otherParticipants.length > 0 && otherParticipants.every(uid => seenBy.includes(uid));

    if (isSeenByAll) {
      return <span style={{ color: '#53bdeb', fontWeight: 'bold', marginLeft: '4px', fontSize: '13px' }}>✓✓</span>;
    } else if (seenBy.length > 1) {
      return <span style={{ color: '#8696a0', marginLeft: '4px', fontSize: '13px' }}>✓✓</span>;
    } else {
      return <span style={{ color: '#8696a0', marginLeft: '4px', fontSize: '13px' }}>✓</span>;
    }
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
  let isUserOnline = false;

  if (roomData) {
    if (roomData.type === "group") {
      chatTitle = roomData.groupName || "Group"; 
      defaultSubtitle = `${roomData.participants?.length || 0} members`;
      isGroup = true;
    } else {
      const otherUserUid = roomData.participants?.find(uid => uid !== currentUserUid);
      if (otherUserUid && usersMap[otherUserUid]) {
        chatTitle = usersMap[otherUserUid].username || "User"; 
        isUserOnline = usersMap[otherUserUid].isOnline || false;
        defaultSubtitle = isUserOnline ? "Online" : "Offline"; 
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', backgroundColor: '#efeae2' }}>
      
      {/* HEADER */}
      <div className="chat-header" onClick={() => setShowDetails(true)} style={{ cursor: 'pointer', backgroundColor: '#f0f2f5', borderBottom: '1px solid #d1d7db' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <button className="btn-back" onClick={(e) => { e.stopPropagation(); setActiveRoomId(null); }}>
            <FiArrowLeft />
          </button>
          
          <div style={{ position: 'relative', marginRight: '12px' }}>
            <div className="avatar" style={{ width: '40px', height: '40px', minWidth: '40px', fontSize: '16px', backgroundColor: isGroup ? '#00a884' : '#dfe5e7', color: isGroup ? '#fff' : '#54656f' }}>
              {isGroup ? <FiUsers /> : (chatTitle !== "Loading..." ? chatTitle.charAt(0).toUpperCase() : <FiUser />)}
            </div>
            {!isGroup && isUserOnline && (
              <span style={{ position: 'absolute', bottom: '2px', right: '2px', width: '10px', height: '10px', backgroundColor: '#25D366', borderRadius: '50%', border: '2px solid #fff' }}></span>
            )}
          </div>
          
          <div className="chat-header-info">
            <h4 style={{ margin: 0, fontSize: '16px', color: '#111b21' }}>{chatTitle}</h4>
            {displaySubtitle && (
              <p style={{ margin: 0, fontSize: '13px', color: isTyping || displaySubtitle === "Online" ? '#00a884' : '#667781' }}>
                {displaySubtitle}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* MESSAGES LIST */}
      <div className="message-list" style={{ flex: 1, padding: '15px', overflowY: 'auto' }}>
        
        {/* CHAT INTRO */}
        <div className="chat-intro" style={{ textAlign: 'center', margin: '20px 0', opacity: 0.8 }}>
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <div className="avatar-large" style={{ margin: '0 auto 10px auto', width: '65px', height: '65px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: isGroup ? '#00a884' : '#dfe5e7', color: isGroup ? '#fff' : '#54656f', fontSize: '28px' }}>
              {isGroup ? <FiUsers /> : (chatTitle !== "Loading..." ? chatTitle.charAt(0).toUpperCase() : <FiUser />)}
            </div>
            {!isGroup && isUserOnline && (
              <span style={{ position: 'absolute', bottom: '12px', right: '4px', width: '14px', height: '14px', backgroundColor: '#25D366', borderRadius: '50%', border: '2px solid #fff' }}></span>
            )}
          </div>
          <h2 style={{ fontSize: '18px', margin: '5px 0', color: '#111b21' }}>{chatTitle}</h2>
          <p style={{ fontSize: '13px', color: '#667781' }}>{defaultSubtitle || "Crodyto Encrypted Chat"}</p>
        </div>

        {visibleMessages.map((msg, index) => {
          const currentLabel = getDateLabel(msg.timestamp);
          const previousLabel = index > 0 ? getDateLabel(visibleMessages[index - 1].timestamp) : null;
          const showDateDivider = currentLabel !== previousLabel; 
          const isMe = msg.senderId === currentUserUid;

          return (
            <div key={msg.id}>
              {showDateDivider && (
                <div className="date-divider-wrapper" style={{ textAlign: 'center', margin: '15px 0' }}>
                  <span className="date-divider" style={{ backgroundColor: '#ffffff', color: '#54656f', fontSize: '12px', padding: '5px 12px', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.1)' }}>{currentLabel}</span>
                </div>
              )}
              
              {msg.isSystemMessage ? (
                <div className="system-message-wrapper" style={{ textAlign: 'center', margin: '8px 0' }}>
                  <span className="system-message" style={{ backgroundColor: '#ffeebd', color: '#54656f', fontSize: '12px', padding: '4px 10px', borderRadius: '6px' }}>{msg.text}</span>
                </div>
              ) : (
                <div className={`message-row ${isMe ? "my-message" : "other-message"}`} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start', marginBottom: '6px' }}>
                  <div className="message-content" style={{ maxWidth: '75%' }}>
                    {roomData?.type === "group" && !isMe && (
                      <span className="sender-name" style={{ fontSize: '12px', fontWeight: 'bold', color: '#53bdeb', display: 'block', marginBottom: '2px', marginLeft: '4px' }}>
                        {usersMap[msg.senderId]?.username || "Unknown"}
                      </span>
                    )}
                    <div className="message-bubble" style={{ 
                      backgroundColor: isMe ? '#d9fdd3' : '#ffffff', 
                      padding: '8px 12px', 
                      borderRadius: isMe ? '8px 8px 0px 8px' : '8px 8px 8px 0px', 
                      boxShadow: '0 1px 1px rgba(0,0,0,0.1)',
                      position: 'relative',
                      display: 'inline-block',
                      minWidth: '70px'
                    }}>
                      <span className="message-text" style={{ fontSize: '14px', color: '#111b21', wordBreak: 'break-word', paddingRight: '10px' }}>{msg.text}</span>
                      
                      <span className="message-meta" style={{ float: 'right', display: 'inline-flex', alignItems: 'center', marginTop: '4px', fontSize: '11px', color: '#667781' }}>
                        {formatTime(msg.timestamp)}
                        {isMe && renderTickStatus(msg)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT FORM */}
      <form onSubmit={handleSendMessage} className="chat-form" style={{ display: 'flex', alignItems: 'center', padding: '10px 15px', backgroundColor: '#f0f2f5', gap: '10px' }}>
        <input 
          type="text" 
          placeholder="Type a message..." 
          value={message} 
          onChange={handleTyping} 
          className="chat-form-input" 
          style={{ flex: 1, border: 'none', borderRadius: '8px', padding: '10px 15px', outline: 'none', fontSize: '15px', backgroundColor: '#ffffff' }} 
        />
        <button type="submit" className="btn-send" style={{ border: 'none', backgroundColor: '#00a884', color: '#fff', padding: '10px 14px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <FiSend size={18} />
        </button>
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
