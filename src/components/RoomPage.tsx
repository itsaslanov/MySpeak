import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { io } from "socket.io-client";
import { AlertCircle } from "lucide-react";
import { request, SOCKET_URL, hasRoomAccess, grantRoomAccess, revokeRoomAccess, getRoomPasscode } from "../lib/api";
import type { Group, Config } from "../types";
import { coerceAvatar } from "../lib/avatar";
import CallRoom from "./CallRoom";

export default function RoomPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [group, setGroup] = useState<Group | null>(null);
  const [passcode, setPasscode] = useState("");
  const [config, setConfig] = useState<Config>({ agoraAppId: "", tokenEnabled: false });
  const [displayName, setDisplayName] = useState(
    () => localStorage.getItem("myspeak:display-name") || ""
  );
  const [userAvatar] = useState(
    () => coerceAvatar(localStorage.getItem("myspeak:avatar"))
  );
  const [socket, setSocket] = useState<ReturnType<typeof io> | null>(null);
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
          request<Config>("/api/config"),
          request<{ groups: Group[] }>("/api/groups")
        ]);
        setConfig(configData);

        const found = (groupsData.groups || []).find((g) => g.id === id);
        if (!found) {
          setError("Room not found.");
          return;
        }

        if (!hasRoomAccess(id!) && found.hasPasscode) {
          setError("You need to join this room from the home page.");
          return;
        }

        grantRoomAccess(id!);
        setGroup((prev) => prev || found);
        setPasscode((window.history.state as { usr?: { passcode?: string } })?.usr?.passcode || getRoomPasscode(id!));
      } catch (err) {
        setError((err as Error).message);
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
    function onUpdate(next: Group) {
      if (next?.id === group!.id) {
        setGroup(next);
      }
    }
    socket.on("groups:update", onUpdate);
    return () => { socket.off("groups:update", onUpdate); };
  }, [socket, group?.id]);

  function handleLeave() {
    revokeRoomAccess(id!);
    navigate("/", { replace: true });
  }

  if (!displayName) return null;

  if (loading) {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-3">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-zinc-300" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-dvh items-center justify-center p-4">
        <div className="glass-card max-w-sm p-6 text-center">
          <AlertCircle className="mx-auto text-red-400" size={24} />
          <h2 className="mt-3 text-[15px] sm:text-sm font-semibold text-zinc-200">{error}</h2>
          <button
            type="button"
            onClick={() => { revokeRoomAccess(id!); navigate("/"); }}
            className="btn-primary mt-4 flex h-10 mx-auto items-center gap-1.5 px-4 text-[13px] sm:text-xs"
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
