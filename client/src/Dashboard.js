import { useEffect, useMemo, useState } from 'react';
import AgoraVoice from './AgoraVoice';

export default function Dashboard({ token, user }) {
  const [friends, setFriends] = useState([]);
  const [groups, setGroups] = useState([]);
  const [friendCode, setFriendCode] = useState('');
  const [selectGroup, setSelectGroup] = useState(null);
  const [newGroupName, setNewGroupName] = useState('');

  const load = async () => {
    const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
    const [friendsRes, groupsRes] = await Promise.all([
      fetch('http://localhost:4000/friends', { headers }),
      fetch('http://localhost:4000/groups', { headers })
    ]);
    setFriends(await friendsRes.json());
    setGroups(await groupsRes.json());
  };

  useEffect(() => { load(); }, []);

  const addFriend = async () => {
    await fetch('http://localhost:4000/friends', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ friendCode })
    });
    setFriendCode(''); load();
  };

  const createGroup = async () => {
    await fetch('http://localhost:4000/groups', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ name: newGroupName })
    });
    setNewGroupName(''); load();
  };

  const openGroup = group => setSelectGroup(group);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl p-6">
        <div className="flex flex-col gap-6 lg:flex-row">
          <section className="w-full lg:w-1/3 space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <div>
              <h2 className="text-xl font-semibold">Welcome, {user.email}</h2>
              <p className="text-slate-400">Your code: <span className="font-medium text-sky-400">{user.userCode}</span></p>
            </div>
            <div className="space-y-3">
              <label className="block text-sm text-slate-300">Add friend by code</label>
              <div className="flex gap-2">
                <input value={friendCode} onChange={e => setFriendCode(e.target.value)} className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none" placeholder="friend code" />
                <button className="rounded-2xl bg-sky-500 px-4 py-2" onClick={addFriend}>Add</button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-300">Create voice group</label>
              <div className="flex gap-2">
                <input value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="flex-1 rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 outline-none" placeholder="group name" />
                <button className="rounded-2xl bg-emerald-500 px-4 py-2" onClick={createGroup}>Create</button>
              </div>
            </div>
            <div className="space-y-3">
              <h3 className="text-sm uppercase tracking-wide text-slate-500">Friends</h3>
              {friends.length ? friends.map(f => (
                <div key={f.id} className="rounded-2xl border border-slate-800 bg-slate-950 p-3">{f.email} <span className="text-slate-500">({f.userCode})</span></div>
              )) : <div className="text-slate-500">No friends yet.</div>}
            </div>
            <div className="space-y-3">
              <h3 className="text-sm uppercase tracking-wide text-slate-500">Voice Groups</h3>
              {groups.length ? groups.map(g => (
                <button key={g.id} className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-left hover:bg-slate-800" onClick={() => openGroup(g)}>{g.name}</button>
              )) : <div className="text-slate-500">No groups yet.</div>}
            </div>
          </section>
          <section className="w-full lg:w-2/3 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
            <h2 className="text-xl font-semibold">Voice chat</h2>
            {!selectGroup && <p className="mt-3 text-slate-400">Select a group to start voice chat.</p>}
            {selectGroup && <AgoraVoice token={token} group={selectGroup} />}
          </section>
        </div>
      </div>
    </div>
  );
}
