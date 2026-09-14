import { useState, useEffect, useRef } from "react";
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

  const activeRoomIdRef = useRef(activeRoomId);
  const prevUnreadRef = useRef({});
  const initialLoadRef = useRef(true);
  const usersMapRef = useRef(usersMap);

  useEffect(() => {
    activeRoomIdRef.current = activeRoomId;
  }, [activeRoomId]);

  useEffect(() => {
    usersMapRef.current = usersMap;
  }, [usersMap]);

  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "users"), (snapshot) => {
      let map = {};
      snapshot.forEach((doc) => { 
        const data = doc.data();
        map[data.uid || doc.id] = { uid: doc.id, ...data }; 
      });
      setUsersMap(map);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!currentUserUid) return;

    const q = query(collection(db, "chatRooms"), where("participants", "array-contains", currentUserUid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (initialLoadRef.current) {
        snapshot.forEach((doc) => {
          prevUnreadRef.current[doc.id] = doc.data().unreadCounts?.[currentUserUid] || 0;
        });
        initialLoadRef.current = false;
      } else {
        snapshot.docChanges().forEach((change) => {
          if (change.type === "added" || change.type === "modified") {
            const data = change.doc.data();
            const roomId = change.doc.id;
            const newUnreadCount = data.unreadCounts?.[currentUserUid] || 0;
            const oldUnreadCount = prevUnreadRef.current[roomId] || 0;

            if (newUnreadCount > oldUnreadCount && activeRoomIdRef.current !== roomId) {
              if ("Notification" in window && Notification.permission === "granted") {
                let senderName = "New Message";
                if (data.type === "group") {
                  senderName = data.groupName || "Group Chat";
                } else {
                  const otherUserUid = data.participants?.find(uid => uid !== currentUserUid);
                  senderName = usersMapRef.current[otherUserUid]?.username || "Crodyto Chat";
                }

                if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                  navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(senderName, {
                      body: "You have received a new message",
                      icon: "/icon-192x192.png",
                      badge: "/icon-192x192.png",
                      vibrate: [200, 100, 200]
                    });
                  });
                } else {
                  new Notification(senderName, {
                    body: "You have received a new message",
                    icon: "/icon-192x192.png",
                    badge: "/icon-192x192.png",
                    vibrate: [200, 100, 200]
                  });
                }
              }
            }
            prevUnreadRef.current[roomId] = newUnreadCount;
          }
        });
      }

      let rooms = [];
      snapshot.forEach((doc) => { rooms.push({ id: doc.id, ...doc.data() }); });
      setChatRooms(rooms);
    });

    return () => unsubscribe();
  }, [currentUserUid]);

  const handleSearch = async (e) => {
    e.preventDefault();
    const cleanedSearch = searchTerm.trim().toLowerCase();
    if (cleanedSearch === "") return;
    
    try {
      const q = query(collection(db, "users"), where("username", "==", cleanedSearch));
      const querySnapshot = await getDocs(q);
      if (!querySnapshot.empty) {
        const doc = querySnapshot.docs[0];
        setSearchedUser({ uid: doc.id, ...doc.data() });
      } else {
        setSearchedUser(null);
        alert("No user found!");
      }
    } catch (error) {
      console.error("Error searching user:", error);
    }
  };

  const startDirectChat = async (targetUserUid) => {
    const existingRoom = chatRooms.find(room => room.type === "direct" && room.participants?.includes(targetUserUid));
    if (existingRoom) {
      setActiveRoomId(existingRoom.id);
    } else {
      try {
        const docRef = await addDoc(collection(db, "chatRooms"), {
          type: "direct", 
          participants: [currentUserUid, targetUserUid], 
          createdAt: serverTimestamp(),
          unreadCounts: { [currentUserUid]: 0, [targetUserUid]: 0 },
          joinedAt: { [currentUserUid]: serverTimestamp(), [targetUserUid]: serverTimestamp() }
        });
        setActiveRoomId(docRef.id);
      } catch (error) {
        console.error("Error starting direct chat:", error);
      }
    }
    setSearchTerm("");
    setSearchedUser(null);
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
        groupName: groupName.trim(), 
        participants: participants,
        createdBy: currentUserUid, 
        admins: [currentUserUid], 
        createdAt: serverTimestamp(),
        unreadCounts: initialUnreadCounts,
        joinedAt: initialJoinedAt 
      });
      setActiveRoomId(newRoomRef.id);
      setShowGroupModal(false); 
      setGroupName(""); 
      setSelectedUsers([]);
    } catch (error) { 
      console.error("Error creating group:", error); 
    }
  };

  const toggleUserSelection = (uid) => {
    if (selectedUsers.includes(uid)) {
      setSelectedUsers(selectedUsers.filter(id => id !== uid));
    } else {
      setSelectedUsers([...selectedUsers, uid]);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="search-section">
        <form onSubmit={handleSearch} className="search-group">
          <input 
            type="text" 
            placeholder="Search username..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
            className="form-input" 
            style={{flex: 1}} 
          />
          <button type="submit" className="btn-primary" style={{width: 'auto'}}><FiSearch /></button>
        </form>

        {searchedUser && searchedUser.uid !== currentUserUid && (
          <div onClick={() => startDirectChat(searchedUser.uid)} className="chat-room-item" style={{marginTop: '10px', borderRadius: '8px', backgroundColor: '#e0e7ff', cursor: 'pointer'}}>
            <div className="avatar">{(searchedUser.username || "U").charAt(0).toUpperCase()}</div>
            <div className="chat-info">
              <h4>{searchedUser.username}</h4>
            </div>
          </div>
        )}

        <button onClick={() => setShowGroupModal(true)} className="btn-group"><FiPlus /> New Group</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {chatRooms.map((room) => {
          let title = "User"; 
          let subtitle = ""; 
          let isGroup = false;

          if (room.type === "group") {
            title = room.groupName || "Group"; 
            subtitle = `${room.participants?.length || 0} members`; 
            isGroup = true;
          } else if (room.type === "direct") {
            const otherUserUid = room.participants?.find(uid => uid !== currentUserUid);
            if (otherUserUid && usersMap[otherUserUid]) {
              title = usersMap[otherUserUid].username || "User"; 
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
                {isGroup ? <FiUsers /> : (title || "U").charAt(0).toUpperCase()}
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
                      <span>{user.username} <small style={{color: '#888'}}>({user.position || "Member"})</small></span>
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
