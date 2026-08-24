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
}

export interface ChatParticipant {
  name: string;
  chatCode: string;
  photoURL?: string;
  avatarColor?: string;
  avatarIcon?: string;
}

export interface ChatConversation {
  id: string;
  participantIds: string[];
  participants: Record<string, ChatParticipant>;
  lastMessage?: {
    text: string;
    senderId: string;
    senderName?: string;
    senderPhotoURL?: string;
    timestamp: number;
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
  text: string;
  timestamp: number;
  readBy?: string[];
  reactions?: Record<string, string[]>; // emoji: [userIds]
}

export type NavTab = 'dashboard' | 'chats' | 'profile';

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
