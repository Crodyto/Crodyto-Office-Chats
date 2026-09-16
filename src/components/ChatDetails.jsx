import { useState, useEffect } from "react";
import { doc, updateDoc } from "firebase/firestore";
import { db } from "../firebase";
import { 
  FiUsers, FiMoreVertical, FiUser, FiX, FiUserPlus, 
  FiTrash2, FiLogOut, FiEdit2, FiCheck 
} from "react-icons/fi";
import "../App.css";

const ChatDetails = ({ 
  roomData, usersMap, currentUserUid, 
  creatorUid, adminsArray, isAdmin, isCreator,
  usersNotInGroup, onClose,
  handleAddMember, handleRemoveMember, handleMakeAdmin, handleRemoveAdmin,
  onStartDirectChat,
  handleClearChat, handleDeleteGroup, handleLeaveGroup 
}) => {
  const [openMenuUid, setOpenMenuUid] = useState(null);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);

  // Group Description State & Logic
  const [groupDesc, setGroupDesc] = useState(roomData?.description || "");
  const [isEditingGroupDesc, setIsEditingGroupDesc] = useState(false);

  useEffect(() => {
    setGroupDesc(roomData?.description || "");
  }, [roomData]);

  const saveGroupDescription = async () => {
    const roomDocId = roomData?.id || roomData?.roomId;
    
    if (!roomDocId) {
      alert("Error: Room ID not found!");
      return;
    }

    try {
      await updateDoc(doc(db, "chatRooms", roomDocId), {
        description: groupDesc
      });
      setIsEditingGroupDesc(false);
    } catch (err) {
      console.error("Error updating group description:", err);
      alert("Failed to update: " + err.message);
    }
  };

  if (!roomData) return null;

  const toggleMenu = (uid) => {
    if (openMenuUid === uid) setOpenMenuUid(null);
    else setOpenMenuUid(uid);
  };

  return (
    <>
      <div className="modal-overlay" onClick={() => setOpenMenuUid(null)}>
        <div className="modal-box" style={{maxWidth: '400px', padding: '20px', position: 'relative'}} onClick={(e) => e.stopPropagation()}>
          
          <button onClick={onClose} style={{position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#667781'}}>
            <FiX />
          </button>

          {/* --- DIRECT CHAT DETAILS --- */}
          {roomData.type === "direct" && (() => {
            const otherUid = roomData.participants.find(uid => uid !== currentUserUid);
            const otherUser = usersMap[otherUid];
            return (
              <div style={{textAlign: 'center', padding: '20px 0'}}>
                <div className="profile-large-avatar" style={{margin: '0 auto 10px auto'}}>
                  {otherUser?.username?.charAt(0).toUpperCase() || <FiUser />}
                </div>
                <h2 style={{color: '#111b21', marginBottom: '5px'}}>{otherUser?.username || "Unknown User"}</h2>
                <p style={{color: '#00a884', fontSize: '15px', fontWeight: '500', marginBottom: '15px'}}>{otherUser?.position || "No position set"}</p>
                
                {/* USER DESCRIPTION / BIO */}
                <div style={{backgroundColor: '#f0f2f5', padding: '12px', borderRadius: '8px', textAlign: 'left', marginBottom: '15px'}}>
                  <p style={{fontSize: '12px', color: '#667781', marginBottom: '4px', fontWeight: '600'}}>About / Description</p>
                  <p style={{fontSize: '14px', color: '#111b21', margin: 0, fontStyle: otherUser?.description ? 'normal' : 'italic'}}>
                    {otherUser?.description || "No description provided."}
                  </p>
                </div>

                <div style={{backgroundColor: '#f0f2f5', padding: '12px', borderRadius: '8px', textAlign: 'left', marginBottom: '15px'}}>
                  <p style={{fontSize: '12px', color: '#667781', marginBottom: '4px', fontWeight: '600'}}>User ID</p>
                  <p style={{fontSize: '13px', color: '#111b21', margin: 0, wordBreak: 'break-all'}}>{otherUid}</p>
                </div>

                {/* CLEAR CHAT BUTTON */}
                <button className="btn-danger-large" onClick={handleClearChat} style={{marginTop: '10px'}}>
                  <FiTrash2 size={18} /> Clear Chat
                </button>
              </div>
            );
          })()}

          {/* --- GROUP CHAT DETAILS --- */}
          {roomData.type === "group" && (
            <>
              <div style={{textAlign: 'center', marginBottom: '15px'}}>
                <div className="profile-large-avatar" style={{backgroundColor: '#dfe5e7', color: '#54656f', margin: '0 auto 10px auto'}}>
                  <FiUsers />
                </div>
                <h3 style={{marginBottom: '5px', color: '#111b21'}}>{roomData.groupName}</h3>
                <p style={{fontSize: '13px', color: '#667781', margin: 0}}>{roomData.participants.length} Members</p>
              </div>

              {/* GROUP DESCRIPTION SECTION */}
              <div style={{backgroundColor: '#f0f2f5', padding: '12px', borderRadius: '8px', marginBottom: '15px'}}>
                <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px'}}>
                  <span style={{fontSize: '12px', color: '#667781', fontWeight: '600'}}>Group Description</span>
                  {isAdmin && !isEditingGroupDesc && (
                    <button 
                      onClick={() => setIsEditingGroupDesc(true)} 
                      style={{border: 'none', background: 'none', cursor: 'pointer', color: '#00a884', padding: '2px'}}
                      title="Edit Description"
                    >
                      <FiEdit2 size={14} />
                    </button>
                  )}
                </div>

                {isEditingGroupDesc ? (
                  <div style={{marginTop: '6px', display: 'flex', gap: '6px'}}>
                    <input 
                      type="text" 
                      value={groupDesc} 
                      onChange={(e) => setGroupDesc(e.target.value)} 
                      placeholder="Add group description..."
                      style={{flex: 1, padding: '6px 10px', borderRadius: '4px', border: '1px solid #ccc', fontSize: '13px'}}
                    />
                    <button 
                      onClick={saveGroupDescription} 
                      style={{border: 'none', backgroundColor: '#00a884', color: '#fff', padding: '6px 12px', borderRadius: '4px', cursor: 'pointer', display: 'flex', alignItems: 'center'}}
                    >
                      <FiCheck size={16} />
                    </button>
                  </div>
                ) : (
                  <p style={{fontSize: '13px', color: '#111b21', margin: 0, fontStyle: roomData?.description ? 'normal' : 'italic'}}>
                    {roomData?.description || "No description set yet."}
                  </p>
                )}
              </div>
              
              <div className="user-select-list" style={{maxHeight: '200px', overflowY: 'auto', border: 'none', padding: '0'}}>
                
                {isAdmin && usersNotInGroup.length > 0 && (
                  <div 
                    className="user-select-item" 
                    onClick={() => setShowAddMemberModal(true)}
                    style={{display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 5px', borderBottom: '1px solid #f0f2f5', cursor: 'pointer'}}
                  >
                    <div className="avatar" style={{width: '35px', height: '35px', minWidth: '35px', backgroundColor: '#00a884', color: 'white'}}>
                      <FiUserPlus size={18} />
                    </div>
                    <h4 style={{fontSize: '15px', margin: 0, fontWeight: '500', color: '#111b21'}}>Add members</h4>
                  </div>
                )}

                {roomData.participants.map(uid => {
                  const isUserCreator = creatorUid === uid;
                  const isUserAdmin = adminsArray.includes(uid);
                  
                  return (
                    <div key={uid} className="user-select-item" style={{cursor: 'default', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f0f2f5', padding: '10px 5px'}}>
                      <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                        <div className="avatar" style={{width: '35px', height: '35px', minWidth: '35px', fontSize: '14px'}}>
                          {usersMap[uid]?.username?.charAt(0).toUpperCase() || <FiUser />}
                        </div>
                        <div>
                          <h4 style={{fontSize: '14px', margin: 0, fontWeight: '500', color: '#111b21'}}>
                            {uid === currentUserUid ? "You" : usersMap[uid]?.username}
                            {isUserCreator ? <span className="badge badge-creator">Creator</span> : (isUserAdmin ? <span className="badge badge-admin">Admin</span> : null)}
                          </h4>
                          <p style={{fontSize: '12px', margin: 0, color: '#667781'}}>{usersMap[uid]?.position || "No position"}</p>
                        </div>
                      </div>

                      {uid !== currentUserUid && (
                        <div className="relative-box">
                          <button className="btn-3dot" onClick={() => toggleMenu(uid)}>
                            <FiMoreVertical size={18} />
                          </button>
                          
                          {openMenuUid === uid && (
                            <div className="dropdown-menu">
                              <button className="dropdown-item" onClick={() => { onStartDirectChat(uid); onClose(); }}>
                                Message {usersMap[uid]?.username}
                              </button>

                              {isAdmin && !isUserCreator && (
                                <>
                                  {isUserAdmin && isCreator && (
                                    <button className="dropdown-item" onClick={() => { handleRemoveAdmin(uid); setOpenMenuUid(null); }}>
                                      Dismiss as Admin
                                    </button>
                                  )}
                                  {!isUserAdmin && (
                                    <button className="dropdown-item" onClick={() => { handleMakeAdmin(uid); setOpenMenuUid(null); }}>
                                      Make Admin
                                    </button>
                                  )}
                                  <button className="dropdown-item danger" onClick={() => { handleRemoveMember(uid); setOpenMenuUid(null); }}>
                                    Remove {usersMap[uid]?.username}
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* DELETE / LEAVE GROUP BUTTON */}
              <div style={{marginTop: '15px'}}>
                {isCreator ? (
                  <button className="btn-danger-large" onClick={handleDeleteGroup}>
                    <FiTrash2 size={18} /> Delete Group
                  </button>
                ) : (
                  <button className="btn-danger-large" onClick={handleLeaveGroup}>
                    <FiLogOut size={18} /> Leave Group
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="modal-overlay" style={{zIndex: 1110}}>
          <div className="modal-box" style={{maxWidth: '350px'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px'}}>
              <h3 style={{margin: 0, color: '#111b21'}}>Add Members</h3>
              <button onClick={() => setShowAddMemberModal(false)} style={{background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#667781'}}><FiX /></button>
            </div>
            
            <div className="user-select-list" style={{maxHeight: '250px', overflowY: 'auto', border: '1px solid #d1d7db', padding: '5px', borderRadius: '8px'}}>
              {usersNotInGroup.length === 0 ? (
                <p style={{padding: '15px', textAlign: 'center', color: '#667781', fontSize: '14px'}}>All users are already in this group.</p>
              ) : (
                usersNotInGroup.map(u => (
                  <div key={u.uid} className="user-select-item" style={{justifyContent: 'space-between', padding: '10px', borderBottom: '1px solid #f0f2f5'}}>
                    <div style={{display: 'flex', alignItems: 'center', gap: '8px'}}>
                      <div className="avatar" style={{width: '30px', height: '30px', minWidth: '30px', fontSize: '12px'}}>{u.username?.charAt(0).toUpperCase()}</div>
                      <span style={{fontSize: '14px', fontWeight: '500'}}>{u.username}</span>
                    </div>
                    <button onClick={() => handleAddMember(u.uid)} className="btn-primary" style={{padding: '6px 12px', fontSize: '12px'}}>
                      Add
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatDetails;
