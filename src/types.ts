export interface Participant {
  socketId: string;
  uid: number;
  displayName: string;
  avatar: string;
  admin: boolean;
  micMuted?: boolean;
  joinedAt: string;
}

export interface Group {
  id: string;
  name: string;
  channelName: string;
  maxUsers: number;
  hasPasscode: boolean;
  createdAt: string;
  order: number;
  count: number;
  isFull: boolean;
  participants: Participant[];
}

export interface Config {
  agoraAppId: string;
  tokenEnabled: boolean;
}

export interface ChatMessage {
  id: string;
  displayName: string;
  text: string;
  timestamp: string;
  system?: boolean;
  type?: "join" | "leave";
  admin?: boolean;
}

export interface AgoraTokenResponse {
  appId: string;
  channelName: string;
  uid: number;
  token: string | null;
  expiresIn: number | null;
  tokenRequired: boolean;
}

export interface RequestOptions {
  method?: string;
  body?: Record<string, unknown>;
  token?: string;
  headers?: Record<string, string>;
}

export interface RoomAccessRecord {
  groupId: string;
  passcode: string;
  grantedAt: number;
}
