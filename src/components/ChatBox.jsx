import { useState, useEffect, useRef } from "react";
import { collection, addDoc, serverTimestamp, query, orderBy, onSnapshot, doc, setDoc, updateDoc, arrayUnion, arrayRemove } from "firebase/firestore"; 
import { db } from "../firebase";
import { FiSend, FiInfo, FiUsers } from "react-icons/fi";
import "../App.css";

const ChatBox = ({ roomId, currentUserUid }) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const [isOtherUserTyping, setIsOtherUserTyping] = useState(false);
  const [roomData, setRoomData] = useState(null);
  const [usersMap, setUsersMap] = useState({});
  const [showDetails, setShowDetails] = useState(false);
  
  const messagesEndRef = useRef(null);
  const typingTimeoutRef = useRef(null);

  // Users data load kora
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      let map = {};
      snapshot.forEach((doc) => { map[doc.data().uid] = doc.data(); });
      setUsersMap(map);
    });
    return () => unsubscribe();
  }, []);

  // Room data load kora
  useEffect(() => {
    if (!roomId) return;
    const unsubscribe = onSnapshot(doc(db, "chatRooms", roomId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRoomData(data);
        if (data.typing) {
          const someoneElseTyping = Object.keys(data.typing).some(
            uid => uid !== currentUserUid && data.typing[uid] === true
          );
          setIsOtherUserTyping(someoneElseTyping);
        } else setIsOtherUserTyping(false);
      }
    });
    return () => unsubscribe();
  }, [roomId, currentUserUid]);

  // Messages load kora
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
  }, [messages, isOtherUserTyping]);

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
    const roomRef = doc(db, "chatRooms", roomId);
    await setDoc(roomRef, { typing: { [currentUserUid]: false } }, { merge: true });
    try {
      await addDoc(collection(db, `chatRooms/${roomId}/messages`), {
        text: msgText, senderId: currentUserUid, timestamp: serverTimestamp(),
      });
    } catch (error) { console.error(error); }
  };

  // --- TIME FORMATTING LOGIC ---
  const formatTime = (firebaseTimestamp) => {
    if (!firebaseTimestamp) return "Sending..."; // Message server e jete deri hole eta dekhabe
    const date = firebaseTimestamp.toDate();
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const creatorUid = roomData?.createdBy || (roomData?.participants ? roomData.participants[0] : null);
  const adminsArray = roomData?.admins || [creatorUid];
  const isCreator = currentUserUid === creatorUid;
  const isAdmin = adminsArray.includes(currentUserUid) || isCreator;

  const handleAddMember = async (targetUid) => {
    await updateDoc(doc(db, "chatRooms", roomId), { participants: arrayUnion(targetUid) });
  };
  const handleRemoveMember = async (targetUid) => {
    await updateDoc(doc(db, "chatRooms", roomId), { 
      participants: arrayRemove(targetUid),
      admins: arrayRemove(targetUid)
    });
  };
  const handleMakeAdmin = async (targetUid) => {
    await updateDoc(doc(db, "chatRooms", roomId), { admins: arrayUnion(targetUid) });
  };
  const handleRemoveAdmin = async (targetUid) => {
    await updateDoc(doc(db, "chatRooms", roomId), { admins: arrayRemove(targetUid) });
  };

  let chatTitle = "Loading..."; let chatSubtitle = "";
  if (roomData) {
    if (roomData.type === "group") {
      chatTitle = roomData.groupName; chatSubtitle = `${roomData.participants.length} members`;
    } else {
      const otherUserUid = roomData.participants.find(uid => uid !== currentUserUid);
      if (otherUserUid && usersMap[otherUserUid]) {
        chatTitle = usersMap[otherUserUid].username; chatSubtitle = usersMap[otherUserUid].position;
      }
    }
  }

  const usersNotInGroup = Object.values(usersMap).filter(u => roomData?.participants && !roomData.participants.includes(u.uid));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="chat-header">
        <div className="chat-header-info">
          <h4>{chatTitle}</h4>
          <p>{chatSubtitle}</p>
        </div>
        {roomData?.type === "group" && (
          <button onClick={() => setShowDetails(true)} className="btn-icon" style={{backgroundColor: '#e6f2ff', color: '#005cbf'}}>
            <FiInfo size={18} /> Details
          </button>
        )}
      </div>

      <div className="message-list">
        {messages.map((msg) => (
          <div key={msg.id} className={`message-row ${msg.senderId === currentUserUid ? "my-message" : "other-message"}`}>
            <div className="message-content">
              {/* Group chat e onno user der nam dekhabe */}
              {roomData?.type === "group" && msg.senderId !== currentUserUid && (
                <span className="sender-name">{usersMap[msg.senderId]?.username || "Unknown"}</span>
              )}
              
              <div className="message-bubble">
                <span className="message-text">{msg.text}</span>
                {/* Message Send er Time */}
                <span className="message-time">{formatTime(msg.timestamp)}</span>
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {isOtherUserTyping && <div className="typing-indicator">Typing...</div>}

      <form onSubmit={handleSendMessage} className="chat-form">
        <input type="text" placeholder="Type a message..." value={message} onChange={handleTyping} className="chat-form-input" />
        <button type="submit" className="btn-send"><FiSend /></button>
      </form>

      {/* Details Modal */}
      {showDetails && roomData?.type === "group" && (
        <div className="modal-overlay">
          <div className="modal-box" style={{maxWidth: '400px'}}>
            <h3 style={{marginBottom: '5px', color: '#111b21'}}>{roomData.groupName}</h3>
            <p style={{fontSize: '13px', color: '#667781', marginBottom: '20px'}}>{roomData.participants.length} Members</p>
            
            <div className="user-select-list" style={{maxHeight: '200px', overflowY: 'auto'}}>
              {roomData.participants.map(uid => {
                const isUserCreator = creatorUid === uid;
                const isUserAdmin = adminsArray.includes(uid);
                
                return (
                  <div key={uid} className="user-select-item" style={{cursor: 'default', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #eee', paddingBottom: '10px'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '10px'}}>
                      <div className="avatar" style={{width: '35px', height: '35px', minWidth: '35px', fontSize: '14px'}}>
                        {usersMap[uid]?.username?.charAt(0) || <FiUsers />}
                      </div>
                      <div>
                        <h4 style={{fontSize: '14px', margin: 0, fontWeight: '500', color: '#111b21'}}>
                          {uid === currentUserUid ? "You" : usersMap[uid]?.username}
                          {isUserCreator ? <span className="badge badge-creator">Admin (Creator)</span> : (isUserAdmin ? <span className="badge badge-admin">Admin</span> : null)}
                        </h4>
                        <p style={{fontSize: '12px', margin: 0, color: '#667781'}}>{usersMap[uid]?.position}</p>
                      </div>
                    </div>

                    {isAdmin && uid !== currentUserUid && !isUserCreator && (
                      <div className="action-buttons" style={{display: 'flex', flexDirection: 'column', gap: '5px'}}>
                        {isUserAdmin && isCreator && <button onClick={() => handleRemoveAdmin(uid)} className="btn-small btn-admin">Dismiss Admin</button>}
                        {!isUserAdmin && <button onClick={() => handleMakeAdmin(uid)} className="btn-small btn-admin">Make Admin</button>}
                        <button onClick={() => handleRemoveMember(uid)} className="btn-small btn-remove">Remove Member</button>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {isAdmin && usersNotInGroup.length > 0 && (
              <div className="add-member-section">
                <h4 style={{fontSize: '14px', marginBottom: '10px', color: '#111b21'}}>Add New Members</h4>
                <div className="user-select-list" style={{maxHeight: '120px', border: '1px solid #eee', padding: '5px'}}>
                  {usersNotInGroup.map(u => (
                    <div key={u.uid} className="user-select-item" style={{justifyContent: 'space-between', padding: '5px 8px'}}>
                      <span style={{fontSize: '14px'}}>{u.username}</span>
                      <button onClick={() => handleAddMember(u.uid)} className="btn-small btn-add">Add</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '15px' }}>
              <button onClick={() => setShowDetails(false)} className="btn-primary" style={{width: '100%'}}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBox;