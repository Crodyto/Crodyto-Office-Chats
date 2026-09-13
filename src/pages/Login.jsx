import { useState, useEffect } from "react";
import { auth } from "../firebase";
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
  // Aage theke login thakle direct ChatDashboard-e niye jabe
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        navigate("/chat"); // Tomar route jodi alada hoy (jemon /dashboard), tahole ekhane change kore nio
      }
    });
    return () => unsubscribe();
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    
    try {
      // Permanent Login set kora hocche
      await setPersistence(auth, browserLocalPersistence);
      
      // Firebase login
      await signInWithEmailAndPassword(auth, email, password);
      
      // Login successful hole ChatDashboard-e pathabe
      navigate("/chat"); 
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
