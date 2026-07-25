import { useEffect, useRef, useState } from 'react';
import AgoraRTC from '@agora-io/agora-rtc-sdk-ng';

const APP_ID = '59b7fe9ce33b40d3a8b3aa560f1fc179';
const TOKEN_SERVER = 'http://localhost:4000/token';

export default function AgoraVoice({ token, group }) {
  const [joined, setJoined] = useState(false);
  const [members, setMembers] = useState([]);
  const clientRef = useRef();
  const localTrackRef = useRef();

  useEffect(() => {
    const init = async () => {
      const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
      clientRef.current = client;
      client.on('user-published', async (user, mediaType) => {
        await client.subscribe(user, mediaType);
        if (mediaType === 'audio') {
          const remoteAudioTrack = user.audioTrack;
          remoteAudioTrack.play();
        }
        setMembers(curr => [...curr, { id: user.uid }]);
      });
      client.on('user-unpublished', user => setMembers(curr => curr.filter(m => m.id !== user.uid)));
    };
    init();
    return () => { if (localTrackRef.current) localTrackRef.current.close(); if (clientRef.current) clientRef.current.leave(); };
  }, []);

  const join = async () => {
    const res = await fetch(`${TOKEN_SERVER}?channel=${group.name}`);
    const data = await res.json();
    const client = clientRef.current;
    await client.join(APP_ID, group.name, data.token, data.uid);
    const localAudioTrack = await AgoraRTC.createMicrophoneAudioTrack();
    localTrackRef.current = localAudioTrack;
    await client.publish([localAudioTrack]);
    setJoined(true);
  };

  const leave = async () => {
    if (!clientRef.current) return;
    if (localTrackRef.current) {
      localTrackRef.current.stop();
      localTrackRef.current.close();
    }
    await clientRef.current.leave();
    setJoined(false);
    setMembers([]);
  };

  return (
    <div className="mt-6 rounded-3xl border border-slate-800 bg-slate-950 p-6">
      <p className="text-slate-300">Group: {group.name}</p>
      <div className="mt-4 flex gap-3">
        <button className="rounded-2xl bg-sky-500 px-5 py-3" onClick={joined ? leave : join}>{joined ? 'Leave' : 'Join'}</button>
      </div>
      <div className="mt-5">
        <h3 className="text-sm uppercase tracking-wide text-slate-500">Active participants</h3>
        {members.length ? members.map(m => <div key={m.id} className="mt-2 rounded-2xl bg-slate-900 px-4 py-3">Member {m.id}</div>) : <div className="mt-2 text-slate-500">No active voices yet.</div>}
      </div>
    </div>
  );
}
