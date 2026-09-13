import { useState, useEffect } from "react";
import { auth } from "../firebase";
// Ekhane setPersistence ar browserLocalPersistence import kora holo
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence, onAuthStateChanged } from "firebase/auth";
import { useNavigate } from "react-router-dom";
import { FiMessageSquare } from "react-icons/fi";
import "../App.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  // --- AUTO LOGIN LOGIC ---
  // Page load holei check korbe aage theke login ache kina. 
  // Jodi thake, tahole direct Dashboard e pathiye debe, password chaibe na!
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // NOTE: Tomar dashboard er link jodi onno kichu hoy (jemon "/chat"), tahole ota ekhane likhbe
        navigate("/dashboard"); 
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    
    try {
      // --- PERMANENT LOGIN SET KORA HOCCHE ---
      await setPersistence(auth, browserLocalPersistence);
      
      // Tarpor normal login
      await signInWithEmailAndPassword(auth, email, password);
      
      // Login success hole chat page e chole jabe
      navigate("/dashboard"); 
    } catch (err) {
      console.error(err);
      setError("Wrong Email or Password! Please try again.");
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', justifyContent: 'center', alignItems: 'center', backgroundColor: '#f0f2f5' }}>
      
      <div className="modal-box" style={{ maxWidth: '400px', width: '90%', padding: '40px 30px', textAlign: 'center' }}>
        
        <FiMessageSquare size={50} color="#00a884" style={{ marginBottom: '10px' }} />
        <h2 style={{ color: '#111b21', marginBottom: '5px' }}>Crodyto Chat</h2>
        <p style={{ color: '#667781', fontSize: '14px', marginBottom: '30px' }}>Sign in to continue</p>
        
        <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
          
          <input 
            type="email" 
            placeholder="Email Address" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            required 
            className="form-input"
          />
          
          <input 
            type="password" 
            placeholder="Password" 
            value={password} 
            onChange={(e) => setPassword(e.target.value)} 
            required 
            className="form-input"
          />
          
          {error && <p style={{ color: '#dc3545', fontSize: '13.5px', margin: 0, fontWeight: '500' }}>{error}</p>}
          
          <button type="submit" className="btn-primary" style={{ marginTop: '10px', fontSize: '16px', padding: '12px' }}>
            Login
          </button>
          
        </form>
      </div>
    </div>
  );
};

export default Login;
