import {
  collection,
  doc,
  setDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  getDocs,
  where,
  updateDoc
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, ChatMessage, MessageType } from '../types';

const ONE_HOUR_MS = 60 * 60 * 1000; // 1 hour TTL for all world chat messages

/**
 * Clean up messages older than 1 hour from Firestore
 */
export async function pruneExpiredWorldMessages(): Promise<void> {
  try {
    const cutoff = Date.now() - ONE_HOUR_MS;
    const worldRef = collection(db, 'world_messages');
    const oldQuery = query(worldRef, where('timestamp', '<', cutoff));
    const snapshot = await getDocs(oldQuery);

    const deletePromises = snapshot.docs.map((d) => deleteDoc(d.ref));
    await Promise.all(deletePromises);
  } catch (err) {
    // Non-critical background cleanup
    console.debug('Prune world messages notice:', err);
  }
}

/**
 * Subscribe to World Chat messages (real-time, ephemeral 1 hour)
 */
export function subscribeToWorldMessages(
  onUpdate: (messages: ChatMessage[]) => void,
  onError?: (err: unknown) => void
) {
  // Trigger cleanup on connection
  pruneExpiredWorldMessages();

  const worldRef = collection(db, 'world_messages');
  const q = query(worldRef, orderBy('timestamp', 'asc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const now = Date.now();
      const cutoff = now - ONE_HOUR_MS;

      const validMessages: ChatMessage[] = [];
      const expiredDocIds: string[] = [];

      snapshot.docs.forEach((d) => {
        const data = d.data();
        const ts = data.timestamp || 0;

        if (ts >= cutoff) {
          validMessages.push({
            id: d.id,
            senderId: data.senderId,
            senderName: data.senderName || 'Anonymous',
            senderPhotoURL: data.senderPhotoURL,
            senderIsVerified: data.senderIsVerified || false,
            text: data.text || '',
            type: (data.type as MessageType) || 'text',
            mediaUrl: data.mediaUrl,
            mediaDuration: data.mediaDuration,
            timestamp: ts,
            reactions: data.reactions || {},
            isDeleted: data.isDeleted || false,
            deletedFor: data.deletedFor || []
          });
        } else {
          expiredDocIds.push(d.id);
        }
      });

      onUpdate(validMessages);

      // Async background deletion of expired docs
      if (expiredDocIds.length > 0) {
        expiredDocIds.forEach((id) => {
          deleteDoc(doc(db, 'world_messages', id)).catch(() => {});
        });
      }
    },
    (err) => {
      console.error('Error listening to world messages:', err);
      onError?.(err);
    }
  );
}

/**
 * Send a message to World Chat
 */
export async function sendWorldMessage(
  currentUser: UserProfile,
  messageData: {
    type?: MessageType;
    text: string;
    mediaUrl?: string;
    mediaDuration?: number;
  }
): Promise<string> {
  if (currentUser.messagingDisabled) {
    throw new Error('Your messaging capability has been restricted by an administrator.');
  }
  if (messageData.type === 'audio' && currentUser.voiceDisabled) {
    throw new Error('Your voice messaging capability has been restricted.');
  }
  if (messageData.type === 'image' && currentUser.photosDisabled) {
    throw new Error('Your photo sharing capability has been restricted.');
  }

  const messageId = 'world_msg_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7);
  const msgDocRef = doc(db, 'world_messages', messageId);

  const payload = {
    id: messageId,
    senderId: currentUser.uid,
    senderName: currentUser.name,
    senderPhotoURL: currentUser.photoURL || '',
    senderIsVerified: currentUser.isVerified || false,
    text: messageData.text.trim(),
    type: messageData.type || 'text',
    mediaUrl: messageData.mediaUrl || '',
    mediaDuration: messageData.mediaDuration || 0,
    timestamp: Date.now(),
    reactions: {}
  };

  await setDoc(msgDocRef, payload);
  return messageId;
}

/**
 * Toggle Reaction in World Chat
 */
export async function toggleWorldMessageReaction(
  messageId: string,
  emoji: string,
  userId: string
): Promise<void> {
  const msgRef = doc(db, 'world_messages', messageId);
  const snap = await getDocs(query(collection(db, 'world_messages')));
  const targetDoc = snap.docs.find((d) => d.id === messageId);

  if (!targetDoc) return;
  const currentReactions: Record<string, string[]> = targetDoc.data().reactions || {};
  const currentUsers = currentReactions[emoji] || [];

  let nextUsers: string[];
  if (currentUsers.includes(userId)) {
    nextUsers = currentUsers.filter((id) => id !== userId);
  } else {
    nextUsers = [...currentUsers, userId];
  }

  const updatedReactions = { ...currentReactions, [emoji]: nextUsers };
  if (nextUsers.length === 0) {
    delete updatedReactions[emoji];
  }

  await updateDoc(msgRef, { reactions: updatedReactions });
}

/**
 * Delete a message from World Chat (sender or admin)
 */
export async function deleteWorldMessage(messageId: string): Promise<void> {
  const msgRef = doc(db, 'world_messages', messageId);
  await deleteDoc(msgRef);
}
