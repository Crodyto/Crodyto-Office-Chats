import { useState, useEffect } from "react";
import { doc, setDoc, getDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { FiEdit3, FiLogOut, FiX, FiUser } from "react-icons/fi";
import "../App.css";

const Profile = ({ currentUserUid, isOpen, onClose, onLogout }) => {
  const [username, setUsername] = useState("");
  const [position, setPosition] = useState("");
  const [message, setMessage] = useState("");
  
  // Notun State: Edit mode e ache naki normal mode e ache
  const [isEditing, setIsEditing] = useState(false);

  // Live profile data fetch kora
  useEffect(() => {
    if (isOpen) {
      setIsEditing(false); // Modal khulle by default info view dekhabe
      setMessage("");
      const unsub = onSnapshot(doc(db, "users", currentUserUid), (docSnap) => {
        if (docSnap.exists()) {
          setUsername(docSnap.data().username || "");
          setPosition(docSnap.data().position || "");
        }
      });
      return () => unsub();
    }
  }, [isOpen, currentUserUid]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      await setDoc(doc(db, "users", currentUserUid), {
        username: username.toLowerCase(),
        position: position,
        uid: currentUserUid
      }, { merge: true });
      
      setMessage("Profile updated!");
      setTimeout(() => {
        setIsEditing(false);
        setMessage("");
      }, 1000);
    } catch (error) {
      setMessage("Error updating profile: " + error.message);
    }
  };

  if (!isOpen) return null; 

  return (
    <div className="modal-overlay" onClick={onClose} style={{zIndex: 1050}}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{position: 'relative'}}>
        
        <button onClick={onClose} style={{position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#667781'}}>
          <FiX />
        </button>

        {!isEditing ? (
          // --- PROFILE INFO VIEW ---
          <div className="profile-info-view">
            <div className="large-avatar">
              {username ? username.charAt(0) : <FiUser />}
            </div>
            <h2>{username || "Set Username"}</h2>
            <p>{position || "Set Position"}</p>

            <button className="btn-outline" onClick={() => setIsEditing(true)}>
              <FiEdit3 /> Edit Profile
            </button>
            <button className="btn-logout-modal" onClick={onLogout}>
              <FiLogOut /> Logout
            </button>
          </div>
        ) : (
          // --- EDIT PROFILE FORM ---
          <>
            <h3 className="modal-title" style={{marginBottom: '20px'}}>Edit Profile</h3>
            <form onSubmit={handleSaveProfile} className="profile-form">
              <input 
                type="text" placeholder="Username" 
                value={username} onChange={(e) => setUsername(e.target.value)} 
                required className="form-input"
              />
              <input 
                type="text" placeholder="Position" 
                value={position} onChange={(e) => setPosition(e.target.value)} 
                required className="form-input"
              />
              <div className="modal-actions" style={{marginTop: '15px'}}>
                <button type="button" onClick={() => setIsEditing(false)} className="btn-cancel">Cancel</button>
                <button type="submit" className="btn-primary" style={{padding: '8px 20px'}}>Save</button>
              </div>
            </form>
            {message && <p className={message.includes("Error") ? "error-msg" : "success-msg"}>{message}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;