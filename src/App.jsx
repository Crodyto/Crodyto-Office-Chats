import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import ChatDashboard from './pages/ChatDashboard';

function App() {
  return (
    <Router>
      <Routes>
        {/* Default route hobe Login page */}
        <Route path="/" element={<Login />} />
        
        {/* Login korar por ai route-e jabe */}
        <Route path="/chat" element={<ChatDashboard />} />
      </Routes>
    </Router>
  );
}

export default App;