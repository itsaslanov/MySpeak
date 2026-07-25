import { useEffect, useState } from 'react';
import Login from './Login';
import Dashboard from './Dashboard';

function App() {
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetch('http://localhost:4000/me', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : Promise.reject())
      .then(data => setUser(data.user))
      .catch(() => { setToken(null); localStorage.removeItem('token'); });
  }, [token]);

  if (!token) return <Login onLogin={t => { setToken(t); localStorage.setItem('token', t); }} />;
  if (!user) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  return <Dashboard token={token} user={user} />;
}

export default App;
