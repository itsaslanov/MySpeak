import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { AlertCircle } from "lucide-react";
import { request, SOCKET_URL, hasRoomAccess, grantRoomAccess, revokeRoomAccess, getRoomPasscode } from "../lib/api.js";
import CallRoom from "./CallRoom.jsx";

export default function RoomPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [group, setGroup] = useState(null);
  const [passcode, setPasscode] = useState("");
  const [config, setConfig] = useState({ agoraAppId: "", tokenEnabled: false });
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem("myspeak:display-name") || ""
  );
  const [userAvatar] = useState(
    () => localStorage.getItem("myspeak:avatar") || "😀"
  );
  const [socket, setSocket] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!displayName) {
      navigate("/", { replace: true });
      return;
    }

    const socketConn = io(SOCKET_URL, { transports: ["websocket", "polling"] });
    setSocket(socketConn);

    async function load() {
      try {
        const [configData, groupsData] = await Promise.all([
          request("/api/config"),
          request("/api/groups")
        ]);
        setConfig(configData);

        const found = (groupsData.groups || []).find((g) => g.id === id);
        if (!found) {
          setError("Room not found.");
          return;
        }

        if (!hasRoomAccess(id) && found.hasPasscode) {
          setError("You need to join this room from the home page.");
          return;
        }

        grantRoomAccess(id);
        setGroup((prev) => prev || found);
        setPasscode(window.history.state?.usr?.passcode || getRoomPasscode(id));
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    load();

    return () => {
      socketConn.disconnect();
    };
  }, [id, displayName, navigate]);

  useEffect(() => {
    if (!socket || !group) return;
    function onUpdate(next) {
      if (next?.id === group.id) {
        setGroup(next);
      }
    }
    socket.on("groups:update", onUpdate);
    return () => socket.off("groups:update", onUpdate);
  }, [socket, group?.id]);

  function handleLeave() {
    revokeRoomAccess(id);
    navigate("/", { replace: true });
  }

  if (!displayName) return null;

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-3">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="glass-card max-w-sm p-6 text-center">
          <AlertCircle className="mx-auto text-red-400" size={24} />
          <h2 className="mt-3 text-sm font-semibold text-zinc-200">{error}</h2>
          <button
            type="button"
            onClick={() => { revokeRoomAccess(id); navigate("/"); }}
            className="btn-primary mt-4 flex h-9 mx-auto items-center gap-1.5 px-4 text-xs"
          >
            Back to rooms
          </button>
        </div>
      </div>
    );
  }

  if (!group) return null;

  return (
    <CallRoom
      config={config}
      displayName={displayName}
      avatar={userAvatar}
      group={group}
      passcode={passcode}
      socket={socket}
      onLeave={handleLeave}
    />
  );
}
