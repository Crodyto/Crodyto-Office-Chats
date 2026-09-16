import { useState, useEffect } from "react";
import { doc, setDoc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { FiEdit3, FiLogOut, FiX, FiUser } from "react-icons/fi";
import "../App.css";

const Profile = ({ currentUserUid, isOpen, onClose, onLogout }) => {
  const [username, setUsername] = useState("");
  const [position, setPosition] = useState("");
  const [description, setDescription] = useState("");
  const [isSetupComplete, setIsSetupComplete] = useState(false);
  const [message, setMessage] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  // Firestore থেকে ইউজার ডাটা লোড করা
  useEffect(() => {
    if (isOpen) {
      setIsEditing(false);
      setMessage("");
      const unsub = onSnapshot(doc(db, "users", currentUserUid), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          setUsername(data.username || "");
          setPosition(data.position || "");
          setDescription(data.description || "");
          setIsSetupComplete(data.isSetupComplete || false);
        }
      });
      return () => unsub();
    }
  }, [isOpen, currentUserUid]);

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      const updatePayload = {
        description: description, // Description সব সময় আপডেট করা যাবে
        uid: currentUserUid
      };

      // যদি প্রথমবার হয়, তবেই username ও position সেভ এবং লক হবে
      if (!isSetupComplete) {
        updatePayload.username = username.toLowerCase().trim();
        updatePayload.position = position.trim();
        updatePayload.isSetupComplete = true;
      }

      await setDoc(doc(db, "users", currentUserUid), updatePayload, { merge: true });
      
      setMessage("Profile updated successfully!");
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
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 1050 }}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()} style={{ position: 'relative' }}>
        
        <button onClick={onClose} style={{ position: 'absolute', top: '15px', right: '15px', background: 'none', border: 'none', cursor: 'pointer', fontSize: '20px', color: '#667781' }}>
          <FiX />
        </button>

        {!isEditing ? (
          // --- PROFILE INFO VIEW ---
          <div className="profile-info-view" style={{ textAlign: 'center' }}>
            <div className="large-avatar" style={{ margin: '0 auto 10px auto', width: '80px', height: '80px', borderRadius: '50%', backgroundColor: '#00a884', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px' }}>
              {username ? username.charAt(0).toUpperCase() : <FiUser />}
            </div>
            <h2 style={{ margin: '5px 0' }}>{username || "Set Username"}</h2>
            <p style={{ color: '#00a884', fontWeight: '500', margin: '0 0 10px 0' }}>{position || "Set Position"}</p>
            <p style={{ color: '#667781', fontSize: '14px', fontStyle: 'italic', marginBottom: '20px' }}>
              {description ? `"${description}"` : "No description added yet."}
            </p>

            <button className="btn-outline" onClick={() => setIsEditing(true)} style={{ width: '100%', marginBottom: '10px', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <FiEdit3 /> {isSetupComplete ? "Edit Description" : "Complete Profile Setup"}
            </button>
            <button className="btn-logout-modal" onClick={onLogout} style={{ width: '100%', padding: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', backgroundColor: '#ea4335', color: '#fff', border: 'none', borderRadius: '5px' }}>
              <FiLogOut /> Logout
            </button>
          </div>
        ) : (
          // --- EDIT PROFILE FORM ---
          <>
            <h3 className="modal-title" style={{ marginBottom: '15px' }}>
              {isSetupComplete ? "Edit Profile Description" : "Complete Initial Setup"}
            </h3>
            <form onSubmit={handleSaveProfile} className="profile-form">
              <label style={{ fontSize: '12px', color: '#667781', display: 'block', marginBottom: '2px' }}>Username (One-time setup)</label>
              <input 
                type="text" 
                placeholder="Username" 
                value={username} 
                onChange={(e) => setUsername(e.target.value)} 
                required 
                disabled={isSetupComplete} 
                className="form-input"
                style={{ width: '100%', padding: '10px', marginBottom: '12px', backgroundColor: isSetupComplete ? '#e9ecef' : '#fff', cursor: isSetupComplete ? 'not-allowed' : 'text' }}
              />

              <label style={{ fontSize: '12px', color: '#667781', display: 'block', marginBottom: '2px' }}>Position (One-time setup)</label>
              <input 
                type="text" 
                placeholder="Position (e.g. Developer, Admin)" 
                value={position} 
                onChange={(e) => setPosition(e.target.value)} 
                required 
                disabled={isSetupComplete} 
                className="form-input"
                style={{ width: '100%', padding: '10px', marginBottom: '12px', backgroundColor: isSetupComplete ? '#e9ecef' : '#fff', cursor: isSetupComplete ? 'not-allowed' : 'text' }}
              />

              <label style={{ fontSize: '12px', color: '#667781', display: 'block', marginBottom: '2px' }}>Description (Can be edited anytime)</label>
              <textarea 
                placeholder="Add a bio or description..." 
                value={description} 
                onChange={(e) => setDescription(e.target.value)} 
                className="form-input"
                rows={3}
                style={{ width: '100%', padding: '10px', marginBottom: '15px', borderRadius: '5px', border: '1px solid #ccc', resize: 'vertical' }}
              />

              {isSetupComplete && (
                <p style={{ fontSize: '11px', color: '#e53935', margin: '-5px 0 10px 0' }}>
                  * Username and Position cannot be changed once saved.
                </p>
              )}

              <div className="modal-actions" style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setIsEditing(false)} className="btn-cancel" style={{ padding: '8px 16px', cursor: 'pointer' }}>Cancel</button>
                <button type="submit" className="btn-primary" style={{ padding: '8px 20px', backgroundColor: '#00a884', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Save</button>
              </div>
            </form>
            {message && <p className={message.includes("Error") ? "error-msg" : "success-msg"} style={{ marginTop: '10px', fontSize: '13px' }}>{message}</p>}
          </>
        )}
      </div>
    </div>
  );
};

export default Profile;
