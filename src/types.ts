export interface UserProfile {
  uid: string;
  name: string;
  chatCode: string;
  email?: string;
  photoURL?: string;
  avatarColor: string;
  avatarIcon: string;
  createdAt: number;
  lastSeen?: number;
  bio?: string;
  isOnline?: boolean;
  isVerified?: boolean; // WhatsApp style blue tick (Admin granted only)
  isNameChangeLocked?: boolean; // Admin can lock name editing for this user
  deviceId?: string; // Bound device identifier
  isBanned?: boolean;
  bannedReason?: string;
  messagingDisabled?: boolean;
  voiceDisabled?: boolean;
  photosDisabled?: boolean;
}

export interface ChatParticipant {
  name: string;
  chatCode: string;
  photoURL?: string;
  avatarColor?: string;
  avatarIcon?: string;
  isVerified?: boolean;
}

export type MessageType = 'text' | 'image' | 'audio';

export interface ChatConversation {
  id: string;
  isGroup?: boolean;
  groupName?: string;
  groupDescription?: string;
  groupAvatar?: string;
  adminUid?: string;
  participantIds: string[];
  participants: Record<string, ChatParticipant>;
  lastMessage?: {
    text: string;
    type?: MessageType;
    senderId: string;
    senderName?: string;
    senderPhotoURL?: string;
    timestamp: number;
    isDeleted?: boolean;
  };
  unreadCounts: Record<string, number>;
  createdAt: number;
  updatedAt: number;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderPhotoURL?: string;
  senderIsVerified?: boolean;
  text: string;
  type?: MessageType;
  mediaUrl?: string;
  mediaDuration?: number; // duration in seconds for audio voice messages
  isViewOnce?: boolean; // WhatsApp style 1-time photo
  viewedBy?: string[]; // userIds who opened this 1-time photo
  timestamp: number;
  readBy?: string[];
  reactions?: Record<string, string[]>; // emoji: [userIds]
  isDeleted?: boolean;
  deletedFor?: string[]; // userIds for whom message is deleted locally ("Delete for me")
}

export interface GroupRequest {
  id: string;
  requestedBy: string;
  requesterName: string;
  requesterChatCode?: string;
  groupName: string;
  description?: string;
  memberIds: string[];
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export interface PasswordResetRequest {
  id: string;
  userId: string;
  userName: string;
  userChatCode: string;
  reason?: string;
  status: 'pending' | 'completed' | 'rejected';
  createdAt: number;
}

export interface NameChangeRequest {
  id: string;
  userId: string;
  currentName: string;
  requestedName: string;
  userChatCode: string;
  reason?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdAt: number;
}

export type NavTab = 'dashboard' | 'chats' | 'world' | 'profile' | 'admin';

export type ThemeMode = 'light' | 'dark';

export interface ThemeConfig {
  id: ThemeMode;
  name: string;
  description: string;
  primary: string;
  primaryHover: string;
  primaryText: string;
  bgPage: string;
  surfaceCard: string;
  surfaceCardHover: string;
  borderSubtle: string;
  borderStrong: string;
  textHeading: string;
  textBody: string;
  textMuted: string;
  inputBg: string;
  inputBorder: string;
  chatBubbleSender: string;
  chatBubbleSenderText: string;
  chatBubbleReceiver: string;
  chatBubbleReceiverText: string;
  accentCodeColor: string;
  badgeBg: string;
  badgeText: string;
}

