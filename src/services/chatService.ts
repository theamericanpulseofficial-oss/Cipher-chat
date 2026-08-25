import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, ChatConversation, ChatMessage, MessageType } from '../types';

// Normalize user search code
export function normalizeChatCode(code: string): string {
  return code.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
}

// Format 6-character code nicely for UI (e.g. K8X-4P2)
export function formatChatCodeDisplay(code: string): string {
  const clean = normalizeChatCode(code);
  if (clean.length === 6) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return clean;
}

// Generate deterministic Chat ID between two user IDs
export function getChatId(uid1: string, uid2: string): string {
  return uid1 < uid2 ? `chat_${uid1}_${uid2}` : `chat_${uid2}_${uid1}`;
}

// Search for user by Chat Code
export async function searchUserByCode(code: string, currentUserId: string): Promise<{ foundUser: UserProfile | null; error: string | null }> {
  const normalized = normalizeChatCode(code);
  if (!normalized || normalized.length < 4) {
    return { foundUser: null, error: 'Please enter a valid chat code (e.g. ABC-123).' };
  }

  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('chatCode', '==', normalized));
    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return { foundUser: null, error: `No user found with Chat Code "${formatChatCodeDisplay(normalized)}"` };
    }

    const userDoc = snapshot.docs[0];
    const data = userDoc.data();

    if (userDoc.id === currentUserId) {
      return { foundUser: null, error: 'You cannot connect with your own chat code.' };
    }

    return {
      foundUser: {
        uid: userDoc.id,
        name: data.name,
        chatCode: data.chatCode,
        email: data.email,
        photoURL: data.photoURL || undefined,
        avatarColor: data.avatarColor || 'bg-indigo-600',
        avatarIcon: data.avatarIcon || 'shield',
        createdAt: data.createdAt || Date.now(),
        lastSeen: data.lastSeen || Date.now(),
        bio: data.bio
      },
      error: null
    };
  } catch (err) {
    console.error('Error searching user by code:', err);
    return { foundUser: null, error: 'Failed to search for user. Please try again.' };
  }
}

// Get or create conversation between two users
export async function getOrCreateChatConversation(
  currentUser: UserProfile,
  otherUser: UserProfile
): Promise<ChatConversation> {
  const chatId = getChatId(currentUser.uid, otherUser.uid);
  const chatDocRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatDocRef);

  if (chatSnap.exists()) {
    const data = chatSnap.data();
    // Update participant details in case photos or names changed
    await updateDoc(chatDocRef, {
      [`participants.${currentUser.uid}`]: {
        name: currentUser.name,
        chatCode: currentUser.chatCode,
        photoURL: currentUser.photoURL || null,
        avatarColor: currentUser.avatarColor,
        avatarIcon: currentUser.avatarIcon
      },
      [`participants.${otherUser.uid}`]: {
        name: otherUser.name,
        chatCode: otherUser.chatCode,
        photoURL: otherUser.photoURL || null,
        avatarColor: otherUser.avatarColor,
        avatarIcon: otherUser.avatarIcon
      }
    });

    return {
      id: chatDocRef.id,
      participantIds: data.participantIds,
      participants: data.participants,
      lastMessage: data.lastMessage,
      unreadCounts: data.unreadCounts || {},
      createdAt: data.createdAt || Date.now(),
      updatedAt: data.updatedAt || Date.now()
    };
  }

  const newChat: ChatConversation = {
    id: chatId,
    participantIds: [currentUser.uid, otherUser.uid],
    participants: {
      [currentUser.uid]: {
        name: currentUser.name,
        chatCode: currentUser.chatCode,
        photoURL: currentUser.photoURL || undefined,
        avatarColor: currentUser.avatarColor,
        avatarIcon: currentUser.avatarIcon
      },
      [otherUser.uid]: {
        name: otherUser.name,
        chatCode: otherUser.chatCode,
        photoURL: otherUser.photoURL || undefined,
        avatarColor: otherUser.avatarColor,
        avatarIcon: otherUser.avatarIcon
      }
    },
    unreadCounts: {
      [currentUser.uid]: 0,
      [otherUser.uid]: 0
    },
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await setDoc(chatDocRef, {
    id: chatId,
    participantIds: [currentUser.uid, otherUser.uid],
    participants: {
      [currentUser.uid]: {
        name: currentUser.name,
        chatCode: currentUser.chatCode,
        photoURL: currentUser.photoURL || null,
        avatarColor: currentUser.avatarColor,
        avatarIcon: currentUser.avatarIcon
      },
      [otherUser.uid]: {
        name: otherUser.name,
        chatCode: otherUser.chatCode,
        photoURL: otherUser.photoURL || null,
        avatarColor: otherUser.avatarColor,
        avatarIcon: otherUser.avatarIcon
      }
    },
    unreadCounts: {
      [currentUser.uid]: 0,
      [otherUser.uid]: 0
    },
    createdAt: newChat.createdAt,
    updatedAt: newChat.updatedAt,
    createdAtTimestamp: serverTimestamp(),
    updatedAtTimestamp: serverTimestamp()
  });

  return newChat;
}

// Subscribe to real-time user conversations
export function subscribeToUserChats(
  userId: string,
  onChatsUpdate: (chats: ChatConversation[]) => void,
  onError?: (err: unknown) => void
) {
  const chatsRef = collection(db, 'chats');
  const q = query(
    chatsRef,
    where('participantIds', 'array-contains', userId)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const chats: ChatConversation[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          participantIds: data.participantIds || [],
          participants: data.participants || {},
          lastMessage: data.lastMessage,
          unreadCounts: data.unreadCounts || {},
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt || Date.now()
        };
      });

      // Sort client-side by updatedAt descending
      chats.sort((a, b) => b.updatedAt - a.updatedAt);
      onChatsUpdate(chats);
    },
    (error) => {
      console.error('Error listening to user chats:', error);
      if (onError) onError(error);
    }
  );
}

// Subscribe to messages in a conversation
export function subscribeToChatMessages(
  chatId: string,
  onMessagesUpdate: (messages: ChatMessage[]) => void,
  onError?: (err: unknown) => void
) {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const q = query(messagesRef, orderBy('timestamp', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const messages: ChatMessage[] = snapshot.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          senderId: data.senderId,
          senderName: data.senderName,
          senderPhotoURL: data.senderPhotoURL || undefined,
          text: data.text || '',
          type: (data.type as MessageType) || 'text',
          mediaUrl: data.mediaUrl || undefined,
          mediaDuration: data.mediaDuration || undefined,
          timestamp: data.timestamp || Date.now(),
          readBy: data.readBy || [],
          reactions: data.reactions || {},
          isDeleted: data.isDeleted || false
        };
      });
      onMessagesUpdate(messages);
    },
    (error) => {
      console.error('Error listening to chat messages:', error);
      if (onError) onError(error);
    }
  );
}

// Send a message (text, photo, or audio voice note)
export async function sendMessage(
  chatId: string,
  sender: UserProfile,
  receiverUid: string,
  options: {
    text?: string;
    type?: MessageType;
    mediaUrl?: string;
    mediaDuration?: number;
  }
): Promise<void> {
  const msgType = options.type || 'text';
  const trimmedText = options.text ? options.text.trim() : '';

  // Validation
  if (msgType === 'text' && !trimmedText) return;
  if ((msgType === 'image' || msgType === 'audio') && !options.mediaUrl) return;

  const messageId = 'msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const messageDocRef = doc(db, 'chats', chatId, 'messages', messageId);
  const chatDocRef = doc(db, 'chats', chatId);

  const timestamp = Date.now();

  // Create preview text for conversation list
  let previewText = trimmedText;
  if (msgType === 'image') {
    previewText = trimmedText ? `📷 ${trimmedText}` : '📷 Photo';
  } else if (msgType === 'audio') {
    const dur = options.mediaDuration ? ` (${Math.round(options.mediaDuration)}s)` : '';
    previewText = `🎤 Voice message${dur}`;
  }

  const messageData = {
    id: messageId,
    senderId: sender.uid,
    senderName: sender.name,
    senderPhotoURL: sender.photoURL || null,
    text: trimmedText,
    type: msgType,
    mediaUrl: options.mediaUrl || null,
    mediaDuration: options.mediaDuration || null,
    timestamp,
    readBy: [sender.uid],
    reactions: {},
    isDeleted: false
  };

  // 1. Add message document
  await setDoc(messageDocRef, messageData);

  // 2. Update chat conversation document with lastMessage and unread count
  const chatSnap = await getDoc(chatDocRef);
  const currentUnread = chatSnap.exists() ? chatSnap.data().unreadCounts?.[receiverUid] || 0 : 0;

  await updateDoc(chatDocRef, {
    lastMessage: {
      text: previewText,
      type: msgType,
      senderId: sender.uid,
      senderName: sender.name,
      senderPhotoURL: sender.photoURL || null,
      timestamp
    },
    updatedAt: timestamp,
    [`unreadCounts.${receiverUid}`]: currentUnread + 1,
    [`unreadCounts.${sender.uid}`]: 0
  });
}

// Send an Image Message
export async function sendImageMessage(
  chatId: string,
  sender: UserProfile,
  receiverUid: string,
  imageDataUrl: string,
  caption = ''
): Promise<void> {
  return sendMessage(chatId, sender, receiverUid, {
    type: 'image',
    mediaUrl: imageDataUrl,
    text: caption
  });
}

// Send a Voice Audio Message
export async function sendVoiceMessage(
  chatId: string,
  sender: UserProfile,
  receiverUid: string,
  audioDataUrl: string,
  duration: number
): Promise<void> {
  return sendMessage(chatId, sender, receiverUid, {
    type: 'audio',
    mediaUrl: audioDataUrl,
    mediaDuration: duration,
    text: ''
  });
}

// Delete an individual message
export async function deleteMessage(
  chatId: string,
  messageId: string,
  permanentDelete = false
): Promise<void> {
  const messageDocRef = doc(db, 'chats', chatId, 'messages', messageId);

  if (permanentDelete) {
    await deleteDoc(messageDocRef);
  } else {
    // Soft delete like WhatsApp: "This message was deleted"
    await updateDoc(messageDocRef, {
      isDeleted: true,
      text: '🚫 This message was deleted',
      mediaUrl: null,
      mediaDuration: null,
      deletedAt: Date.now()
    });
  }
}

// Clear all messages in a chat conversation
export async function clearChatMessages(chatId: string): Promise<void> {
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const snapshot = await getDocs(messagesRef);

  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.delete(d.ref);
  });

  await batch.commit();

  // Reset lastMessage in chat document
  const chatDocRef = doc(db, 'chats', chatId);
  await updateDoc(chatDocRef, {
    lastMessage: {
      text: 'Chat cleared',
      senderId: '',
      timestamp: Date.now()
    },
    updatedAt: Date.now()
  });
}

// Delete an entire chat conversation
export async function deleteConversation(chatId: string): Promise<void> {
  // 1. Delete all messages in subcollection
  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const snapshot = await getDocs(messagesRef);

  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => {
    batch.delete(d.ref);
  });
  await batch.commit();

  // 2. Delete main chat document
  const chatDocRef = doc(db, 'chats', chatId);
  await deleteDoc(chatDocRef);
}

// Mark chat as read
export async function markChatAsRead(chatId: string, userId: string): Promise<void> {
  const chatDocRef = doc(db, 'chats', chatId);
  try {
    await updateDoc(chatDocRef, {
      [`unreadCounts.${userId}`]: 0
    });
  } catch (e) {
    console.warn('Could not mark chat as read:', e);
  }
}

// Toggle emoji reaction on message
export async function toggleMessageReaction(
  chatId: string,
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> {
  const messageDocRef = doc(db, 'chats', chatId, 'messages', messageId);
  const msgSnap = await getDoc(messageDocRef);
  if (!msgSnap.exists()) return;

  const data = msgSnap.data();
  const currentReactions: Record<string, string[]> = data.reactions || {};
  const currentList = currentReactions[emoji] || [];

  let updatedList: string[];
  if (currentList.includes(userId)) {
    updatedList = currentList.filter((id) => id !== userId);
  } else {
    updatedList = [...currentList, userId];
  }

  await updateDoc(messageDocRef, {
    [`reactions.${emoji}`]: updatedList
  });
}
