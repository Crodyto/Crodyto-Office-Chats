import { useState, useEffect, useRef } from "react"; // useRef add kora holo
import { collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { FiSearch, FiUsers, FiPlus } from "react-icons/fi";
import "../App.css";

const Sidebar = ({ currentUserUid, setActiveRoomId, activeRoomId }) => {
  const [chatRooms, setChatRooms] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchedUser, setSearchedUser] = useState(null);
  const [usersMap, setUsersMap] = useState({});
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selectedUsers, setSelectedUsers] = useState([]);

  // --- NOTIFICATION ER JONNYE REF GULO ---
  const activeRoomIdRef = useRef(activeRoomId);
  const prevUnreadRef = useRef({});
  const initialLoadRef = useRef(true); // Prothom bar load hole jate eksathe sob notification na ashe

  // Active chat track korchi jate jei chat khola ache tar notification na ashe
  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  // 1. App khullei Notification er permission chaibe
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      let map = {};
      snapshot.forEach((doc) => { map[doc.data().uid] = doc.data(); });
      setUsersMap(map);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "chatRooms"), where("participants", "array-contains", currentUserUid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      
      // --- NOTIFICATION LOGIC ---
      if (initialLoadRef.current) {
        // App prothom load hole shudhu purono message er count save korbo, notification pathabo na
        snapshot.forEach((doc) => {
          prevUnreadRef.current[doc.id] = doc.data().unreadCounts?.[currentUserUid] || 0;
        });
        initialLoadRef.current = false;
      } else {
        // Ebar theke kono notun change hole check korbo
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" || change.type === "modified") {
            const data = change.doc.data();
            const roomId = change.doc.id;
            const newUnreadCount = data.unreadCounts?.[currentUserUid] || 0;
            const oldUnreadCount = prevUnreadRef.current[roomId] || 0;

            // Jodi unread count aager theke bare (mane notun message ashe) ar oi chat-ta jodi khola na thake
            if (newUnreadCount > oldUnreadCount && activeRoomIdRef.current !== roomId) {
              
              // Browser e notification allow kora thakle pathabo
              if ("Notification" in window && Notification.permission === "granted") {
                let senderName = "Someone";
                if (data.type === "group") {
                  senderName = data.groupName; // Group er nam dekhabe
                } else {
                  const otherUserUid = data.participants.find(uid => uid !== currentUserUid);
                  senderName = usersMap[otherUserUid]?.username || "New Message"; // User er nam dekhabe
                }

                // Notification toiri kora hocche
                new Notification(senderName, {
                  body: "You have a new message",
                  icon: "/icon-192x192.png", // Tomar public folder er PWA logo ta dekhabe
                  badge: "/icon-192x192.png",
                  vibrate: [200, 100, 200] // Mobile vibrate korbe
                });
              }
            }
            // Update old count
            prevUnreadRef.current[roomId] = newUnreadCount;
          }
        });
      }

      let rooms = [];
      snapshot.forEach((doc) => { rooms.push({ id: doc.id, ...doc.data() }); });
      setChatRooms(rooms);
    });
    return () => unsubscribe();
  }, [currentUserUid, usersMap]); // usersMap dependency add kora holo jate nam theek ashe

  const handleSearch = async (e) => {
    e.preventDefault();
    if (searchTerm.trim() === "") return;
    const q = query(collection(db, "users"), where("username", "==", searchTerm.toLowerCase()));
    const querySnapshot = await getDocs(q);
    if (!querySnapshot.empty) setSearchedUser(querySnapshot.docs[0].data());
    else { setSearchedUser(null); alert("No user found!"); }
  };

  const startDirectChat = async (targetUserUid) => {
    const existingRoom = chatRooms.find(room => room.type === "direct" && room.participants.includes(targetUserUid));
    if (existingRoom) setActiveRoomId(existingRoom.id);
    else {
      await addDoc(collection(db, "chatRooms"), {
        type: "direct", 
        participants: [currentUserUid, targetUserUid], 
        createdAt: serverTimestamp(),
        unreadCounts: { [currentUserUid]: 0, [targetUserUid]: 0 },
        joinedAt: { [currentUserUid]: serverTimestamp(), [targetUserUid]: serverTimestamp() }
      }).then(docRef => setActiveRoomId(docRef.id));
    }
    setSearchTerm(""); setSearchedUser(null);
  };

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    if (groupName.trim() === "" || selectedUsers.length === 0) return;
    try {
      const participants = [...selectedUsers, currentUserUid];
      let initialUnreadCounts = {};
      let initialJoinedAt = {}; 
      
      participants.forEach(uid => {
        initialUnreadCounts[uid] = 0;
        initialJoinedAt[uid] = serverTimestamp();
      });

      const newRoomRef = await addDoc(collection(db, "chatRooms"), {
        type: "group", 
        groupName: groupName, 
        participants: participants,
        createdBy: currentUserUid, 
        admins: [currentUserUid], 
        createdAt: serverTimestamp(),
        unreadCounts: initialUnreadCounts,
        joinedAt: initialJoinedAt 
      });
      setActiveRoomId(newRoomRef.id);
      setShowGroupModal(false); setGroupName(""); setSelectedUsers([]);
    } catch (error) { console.error(error); }
  };

  const toggleUserSelection = (uid) => {
    if (selectedUsers.includes(uid)) setSelectedUsers(selectedUsers.filter(id => id !== uid));
    else setSelectedUsers([...selectedUsers, uid]);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="search-section">
        <form onSubmit={handleSearch} className="search-group">
          <input type="text" placeholder="Search username..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="form-input" style={{flex: 1}} />
          <button type="submit" className="btn-primary" style={{width: 'auto'}}><FiSearch /></button>
        </form>

        {searchedUser && searchedUser.uid !== currentUserUid && (
          <div onClick={() => startDirectChat(searchedUser.uid)} className="chat-room-item" style={{marginTop: '10px', borderRadius: '8px', backgroundColor: '#e0e7ff'}}>
            <div className="avatar">{searchedUser.username.charAt(0)}</div>
            <div className="chat-info">
              <h4>{searchedUser.username}</h4>
            </div>
          </div>
        )}

        <button onClick={() => setShowGroupModal(true)} className="btn-group"><FiPlus /> New Group</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {chatRooms.map((room) => {
          let title = "User"; let subtitle = ""; let isGroup = false;
          if (room.type === "group") {
            title = room.groupName; subtitle = `${room.participants.length} members`; isGroup = true;
          } else if (room.type === "direct") {
            const otherUserUid = room.participants.find(uid => uid !== currentUserUid);
            if (otherUserUid && usersMap[otherUserUid]) {
              title = usersMap[otherUserUid].username; 
              subtitle = ""; 
            }
          }

          let isTyping = false;
          if (room.typing) {
            const activeTypers = Object.keys(room.typing).filter(uid => uid !== currentUserUid && room.typing[uid] === true);
            if (activeTypers.length > 0) {
              isTyping = true;
              if (room.type === "direct") {
                subtitle = "typing...";
              } else {
                const names = activeTypers.map(uid => usersMap[uid]?.username || "Someone").join(", ");
                subtitle = `${names} typing...`;
              }
            }
          }

          const unreadCount = room.unreadCounts?.[currentUserUid] || 0;

          return (
            <div key={room.id} onClick={() => setActiveRoomId(room.id)} className={`chat-room-item ${activeRoomId === room.id ? "active" : ""}`}>
              <div className="avatar" style={{ backgroundColor: isGroup ? '#00a884' : '#dfe5e7', color: isGroup ? '#fff' : '#54656f' }}>
                {isGroup ? <FiUsers /> : title.charAt(0)}
              </div>
              <div className="chat-info" style={{ flex: 1 }}>
                <h4>{title}</h4>
                {subtitle && <p className={isTyping ? "typing-text-sidebar" : ""}>{subtitle}</p>}
              </div>
              {unreadCount > 0 && activeRoomId !== room.id && !isTyping && (
                <div className="unread-badge">{unreadCount}</div>
              )}
            </div>
          );
        })}
      </div>

      {showGroupModal && (
        <div className="modal-overlay">
          <div className="modal-box">
            <h3 style={{marginBottom: '15px', color: '#111b21'}}>Create New Group</h3>
            <form onSubmit={handleCreateGroup}>
              <input type="text" placeholder="Group Name" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="form-input" style={{marginBottom: '15px'}} required />
              <p style={{fontSize: '14px', marginBottom: '8px', color: '#667781'}}>Select Members:</p>
              <div className="user-select-list">
                {Object.values(usersMap).map(user => {
                  if (user.uid === currentUserUid) return null;
                  return (
                    <div key={user.uid} className="user-select-item" onClick={() => toggleUserSelection(user.uid)}>
                      <input type="checkbox" checked={selectedUsers.includes(user.uid)} readOnly />
                      <span>{user.username} <small style={{color: '#888'}}>({user.position})</small></span>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowGroupModal(false)} className="btn-icon" style={{backgroundColor: '#f1f1f1'}}>Cancel</button>
                <button type="submit" className="btn-primary" style={{padding: '8px 15px'}}>Create</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
export default Sidebar;
