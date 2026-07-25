import { useState } from 'react';

export default function Login({ onLogin }) {
  const [email, setEmail] = useState('');
  const [userCode, setUserCode] = useState('');
  const [mode, setMode] = useState('login');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async e => {
    e.preventDefault();
    setError('');
    const path = mode === 'login' ? 'login' : 'signup';
    const body = { email, password, userCode: mode === 'signup' ? userCode : undefined };
    const res = await fetch(`http://localhost:4000/${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const data = await res.json();
    if (!res.ok) return setError(data.message || 'Failed');
    onLogin(data.token);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-slate-800 p-8 shadow-lg">
        <h1 className="text-3xl font-semibold mb-6">MySpeak</h1>
        <div className="flex gap-2 mb-6">
          <button className={`flex-1 rounded-xl py-2 ${mode === 'login' ? 'bg-sky-500' : 'bg-slate-700'}`} onClick={() => setMode('login')}>Login</button>
          <button className={`flex-1 rounded-xl py-2 ${mode === 'signup' ? 'bg-sky-500' : 'bg-slate-700'}`} onClick={() => setMode('signup')}>Sign Up</button>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <label className="block">
            <span>Email</span>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 outline-none" required />
          </label>
          <label className="block">
            <span>Password</span>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 outline-none" required />
          </label>
          {mode === 'signup' && (
            <label className="block">
              <span>Choose user code</span>
              <input value={userCode} onChange={e => setUserCode(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-600 bg-slate-900 px-3 py-2 outline-none" required />
            </label>
          )}
          {error && <div className="text-red-400">{error}</div>}
          <button type="submit" className="w-full rounded-xl bg-sky-500 py-3 font-semibold">{mode === 'login' ? 'Login' : 'Create account'}</button>
        </form>
      </div>
    </div>
  );
}
