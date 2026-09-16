import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db } from './firebase';
import Login from './pages/Login';
import ChatDashboard from './pages/ChatDashboard';

function App() {
  const [currentUserUid, setCurrentUserUid] = useState(null);

  useEffect(() => {
    // Firebase Auth State Listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setCurrentUserUid(user.uid);

        const userRef = doc(db, "users", user.uid);

        // ১. ইউজার অ্যাপে ঢুকলে/লগইন করলে Online আপডেট
        updateDoc(userRef, {
          isOnline: true,
          lastSeen: serverTimestamp()
        }).catch((err) => console.error("Online status error:", err));

        // ২. ব্রাউজার ট্যাব বা উইন্ডো বন্ধ করলে Offline করা
        const handleUnload = () => {
          updateDoc(userRef, {
            isOnline: false,
            lastSeen: serverTimestamp()
          });
        };

        window.addEventListener("beforeunload", handleUnload);

        return () => {
          window.removeEventListener("beforeunload", handleUnload);
        };
      } else {
        // ৩. ইউজার লগআউট করলে Offline করা
        if (currentUserUid) {
          const userRef = doc(db, "users", currentUserUid);
          updateDoc(userRef, {
            isOnline: false,
            lastSeen: serverTimestamp()
          }).catch((err) => console.error("Offline status error:", err));
        }
        setCurrentUserUid(null);
      }
    });

    return () => unsubscribe();
  }, [currentUserUid]);

  return (
    <Router>
      <Routes>
        {/* Default route: Login page */}
        <Route path="/" element={<Login />} />
        
        {/* Chat Dashboard route-এ currentUserUid পাস করা হচ্ছে */}
        <Route path="/chat" element={<ChatDashboard currentUserUid={currentUserUid} />} />
      </Routes>
    </Router>
  );
}

export default App;
