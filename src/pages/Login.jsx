import { useState } from "react";
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../firebase";
import { useNavigate } from "react-router-dom";
import { FiLock, FiMail } from "react-icons/fi";
import "../App.css";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      await signInWithEmailAndPassword(auth, email, password);
      navigate("/chat"); 
    } catch (err) {
      setError("Invalid email or password.");
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <h2 className="login-title">Crodyto Workspace</h2>
        <p className="login-subtitle">Sign in to collaborate with your team</p>
        
        <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          <input 
            type="email" 
            placeholder="Work Email" 
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
          {error && <p style={{ color: "red", fontSize: "13px" }}>{error}</p>}
          <button type="submit" className="btn-primary">
            <FiLock /> Sign In
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;