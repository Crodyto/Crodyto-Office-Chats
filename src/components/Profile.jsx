import { useState, useEffect } from "react";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import "../App.css";

const Profile = ({ currentUserUid, isOpen, onClose }) => {
  const [username, setUsername] = useState("");
  const [position, setPosition] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (isOpen) {
      const fetchProfile = async () => {
        const docRef = doc(db, "users", currentUserUid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUsername(docSnap.data().username || "");
          setPosition(docSnap.data().position || "");
        }
      };
      fetchProfile();
      setMessage(""); 
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
      
      setMessage("Profile updated successfully!");
      setTimeout(() => onClose(), 1500);
    } catch (error) {
      setMessage("Error updating profile: " + error.message);
    }
  };

  if (!isOpen) return null; 

  return (
    <div className="modal-overlay">
      <div className="modal-box">
        <h3 className="modal-title">Edit Profile</h3>
        <form onSubmit={handleSaveProfile} className="profile-form">
          <input 
            type="text" 
            placeholder="Username (e.g. dipam12)" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            required 
            className="form-input"
          />
          <input 
            type="text" 
            placeholder="Position (e.g. Frontend Developer)" 
            value={position} 
            onChange={(e) => setPosition(e.target.value)} 
            required 
            className="form-input"
          />
          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn-cancel">Cancel</button>
            <button type="submit" className="btn-save">Save</button>
          </div>
        </form>
        {message && (
          <p className={message.includes("Error") ? "error-msg" : "success-msg"}>{message}</p>
        )}
      </div>
    </div>
  );
};

export default Profile;