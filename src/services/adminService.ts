import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, ChatConversation, ChatMessage, GroupRequest, PasswordResetRequest, NameChangeRequest } from '../types';
import { hashPassword } from '../utils/crypto';

// Fetch all registered users in system
export async function getAllUsers(): Promise<UserProfile[]> {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(usersRef);
    const users: UserProfile[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        uid: d.id,
        name: data.name || 'User',
        chatCode: data.chatCode || '------',
        email: data.email,
        photoURL: data.photoURL || undefined,
        avatarColor: data.avatarColor || 'bg-indigo-600',
        avatarIcon: data.avatarIcon || 'shield',
        createdAt: data.createdAt || Date.now(),
        lastSeen: data.lastSeen || Date.now(),
        bio: data.bio || '',
        isVerified: data.isVerified || false,
        isNameChangeLocked: data.isNameChangeLocked || false,
        deviceId: data.deviceId || undefined,
        isBanned: data.isBanned || false,
        bannedReason: data.bannedReason || '',
        messagingDisabled: data.messagingDisabled || false,
        voiceDisabled: data.voiceDisabled || false,
        photosDisabled: data.photosDisabled || false
      };
    });
    return users.sort((a, b) => b.createdAt - a.createdAt);
  } catch (err) {
    console.error('Failed to fetch all users:', err);
    return [];
  }
}

// Toggle or Set User Verified Status (WhatsApp Blue Tick Badge)
export async function setUserVerifiedStatus(uid: string, isVerified: boolean): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    isVerified,
    updatedAt: Date.now()
  });
}

// Toggle or Set Name Change Lock for a user
export async function setNameChangeLock(uid: string, isLocked: boolean): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    isNameChangeLocked: isLocked,
    updatedAt: Date.now()
  });
}

// Admin directly changes any user's display name
export async function adminUpdateUserName(uid: string, newName: string): Promise<void> {
  const trimmed = newName.trim();
  if (!trimmed) throw new Error('Name cannot be empty');
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    name: trimmed,
    updatedAt: Date.now()
  });
}

// Admin deletes a user account permanently
export async function deleteUserAccount(uid: string): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  await deleteDoc(userDocRef);
}

// Fetch all conversations across the entire platform
export async function getAllConversations(): Promise<ChatConversation[]> {
  try {
    const chatsRef = collection(db, 'chats');
    const snapshot = await getDocs(chatsRef);
    const chats: ChatConversation[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        isGroup: data.isGroup || false,
        groupName: data.groupName || undefined,
        groupDescription: data.groupDescription || undefined,
        groupAvatar: data.groupAvatar || undefined,
        adminUid: data.adminUid || undefined,
        participantIds: data.participantIds || [],
        participants: data.participants || {},
        lastMessage: data.lastMessage,
        unreadCounts: data.unreadCounts || {},
        createdAt: data.createdAt || Date.now(),
        updatedAt: data.updatedAt || Date.now()
      };
    });
    return chats.sort((a, b) => b.updatedAt - a.updatedAt);
  } catch (err) {
    console.error('Failed to fetch all conversations:', err);
    return [];
  }
}

// Update User moderation controls (Ban, message off, voice off, photos off)
export async function setUserModerationStatus(
  uid: string,
  updates: {
    isBanned?: boolean;
    bannedReason?: string;
    messagingDisabled?: boolean;
    voiceDisabled?: boolean;
    photosDisabled?: boolean;
  }
): Promise<void> {
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    ...updates,
    updatedAt: Date.now()
  });
}

// Admin directly sets or resets password for any user or admin
export async function adminChangeUserPassword(uid: string, newPlainPassword: string): Promise<void> {
  if (newPlainPassword.length < 4) {
    throw new Error('Password must be at least 4 characters.');
  }
  const passwordHash = await hashPassword(newPlainPassword);
  const userDocRef = doc(db, 'users', uid);
  await updateDoc(userDocRef, {
    passwordHash,
    updatedAt: Date.now()
  });
}

// Admin creates a Group Chat
export async function createAdminGroupChat(
  groupName: string,
  description: string,
  members: UserProfile[],
  adminUser: UserProfile
): Promise<ChatConversation> {
  const trimmedName = groupName.trim();
  if (!trimmedName) throw new Error('Group name cannot be empty');

  const groupId = 'grp_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 7);
  const allMembers = [adminUser, ...members.filter((m) => m.uid !== adminUser.uid)];
  const participantIds = allMembers.map((m) => m.uid);

  const participants: Record<string, { name: string; chatCode: string; photoURL?: string; avatarColor?: string; avatarIcon?: string }> = {};
  const unreadCounts: Record<string, number> = {};

  allMembers.forEach((m) => {
    participants[m.uid] = {
      name: m.name,
      chatCode: m.chatCode,
      photoURL: m.photoURL || undefined,
      avatarColor: m.avatarColor || 'bg-indigo-600',
      avatarIcon: m.avatarIcon || 'shield'
    };
    unreadCounts[m.uid] = 0;
  });

  const timestamp = Date.now();
  const groupDocRef = doc(db, 'chats', groupId);

  const newGroupData = {
    id: groupId,
    isGroup: true,
    groupName: trimmedName,
    groupDescription: description.trim(),
    groupAvatar: adminUser.photoURL || null,
    adminUid: adminUser.uid,
    participantIds,
    participants,
    unreadCounts,
    lastMessage: {
      text: `Group "${trimmedName}" created by Admin`,
      senderId: adminUser.uid,
      senderName: adminUser.name,
      timestamp
    },
    createdAt: timestamp,
    updatedAt: timestamp,
    createdAtTimestamp: serverTimestamp(),
    updatedAtTimestamp: serverTimestamp()
  };

  await setDoc(groupDocRef, newGroupData);

  // Add initial system message
  const msgDocRef = doc(db, 'chats', groupId, 'messages', 'msg_init_' + Date.now());
  await setDoc(msgDocRef, {
    id: msgDocRef.id,
    senderId: adminUser.uid,
    senderName: adminUser.name,
    text: `🛡️ Welcome to ${trimmedName}! Group created by Admin.`,
    type: 'text',
    timestamp,
    readBy: [adminUser.uid],
    reactions: {},
    isDeleted: false
  });

  return {
    id: groupId,
    isGroup: true,
    groupName: trimmedName,
    groupDescription: description.trim(),
    adminUid: adminUser.uid,
    participantIds,
    participants,
    unreadCounts,
    createdAt: timestamp,
    updatedAt: timestamp
  };
}

// Add user to Group
export async function addMemberToGroup(groupId: string, newMember: UserProfile): Promise<void> {
  const groupDocRef = doc(db, 'chats', groupId);
  const groupSnap = await getDoc(groupDocRef);
  if (!groupSnap.exists()) throw new Error('Group not found');

  const data = groupSnap.data();
  const participantIds: string[] = data.participantIds || [];

  if (participantIds.includes(newMember.uid)) {
    throw new Error('User is already a member of this group.');
  }

  participantIds.push(newMember.uid);

  await updateDoc(groupDocRef, {
    participantIds,
    [`participants.${newMember.uid}`]: {
      name: newMember.name,
      chatCode: newMember.chatCode,
      photoURL: newMember.photoURL || null,
      avatarColor: newMember.avatarColor,
      avatarIcon: newMember.avatarIcon
    },
    [`unreadCounts.${newMember.uid}`]: 0,
    updatedAt: Date.now()
  });

  // Post system notice
  const msgRef = doc(db, 'chats', groupId, 'messages', 'msg_join_' + Date.now());
  await setDoc(msgRef, {
    id: msgRef.id,
    senderId: 'system',
    senderName: 'System',
    text: `👋 ${newMember.name} was added to the group.`,
    type: 'text',
    timestamp: Date.now(),
    readBy: [],
    reactions: {},
    isDeleted: false
  });
}

// Remove user from Group
export async function removeMemberFromGroup(groupId: string, memberUid: string, memberName: string): Promise<void> {
  const groupDocRef = doc(db, 'chats', groupId);
  const groupSnap = await getDoc(groupDocRef);
  if (!groupSnap.exists()) throw new Error('Group not found');

  const data = groupSnap.data();
  const participantIds: string[] = (data.participantIds || []).filter((id: string) => id !== memberUid);

  await updateDoc(groupDocRef, {
    participantIds,
    updatedAt: Date.now()
  });

  // Post system notice
  const msgRef = doc(db, 'chats', groupId, 'messages', 'msg_leave_' + Date.now());
  await setDoc(msgRef, {
    id: msgRef.id,
    senderId: 'system',
    senderName: 'System',
    text: `🚪 ${memberName} was removed from the group.`,
    type: 'text',
    timestamp: Date.now(),
    readBy: [],
    reactions: {},
    isDeleted: false
  });
}

// Delete Group completely
export async function deleteAdminGroup(groupId: string): Promise<void> {
  const messagesRef = collection(db, 'chats', groupId, 'messages');
  const snapshot = await getDocs(messagesRef);
  const batch = writeBatch(db);
  snapshot.docs.forEach((d) => batch.delete(d.ref));
  await batch.commit();

  await deleteDoc(doc(db, 'chats', groupId));
}

// User submits Group Creation Request
export async function submitGroupRequest(
  requester: UserProfile,
  groupName: string,
  description: string,
  memberIds: string[]
): Promise<void> {
  const reqId = 'req_grp_' + Date.now();
  const reqDocRef = doc(db, 'groupRequests', reqId);

  const reqData: GroupRequest = {
    id: reqId,
    requestedBy: requester.uid,
    requesterName: requester.name,
    requesterChatCode: requester.chatCode,
    groupName: groupName.trim(),
    description: description.trim(),
    memberIds,
    status: 'pending',
    createdAt: Date.now()
  };

  await setDoc(reqDocRef, reqData);
}

// Listen to Group Requests (Admin)
export function subscribeToGroupRequests(
  onUpdate: (requests: GroupRequest[]) => void
) {
  const reqRef = collection(db, 'groupRequests');
  const q = query(reqRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const list: GroupRequest[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        requestedBy: data.requestedBy,
        requesterName: data.requesterName,
        requesterChatCode: data.requesterChatCode,
        groupName: data.groupName,
        description: data.description || '',
        memberIds: data.memberIds || [],
        status: data.status || 'pending',
        createdAt: data.createdAt || Date.now()
      };
    });
    onUpdate(list);
  });
}

// Admin approves Group Request & builds the group
export async function approveGroupRequest(
  request: GroupRequest,
  allUsersMap: Record<string, UserProfile>,
  adminUser: UserProfile
): Promise<void> {
  const members: UserProfile[] = [];
  const requester = allUsersMap[request.requestedBy];
  if (requester) members.push(requester);

  request.memberIds.forEach((uid) => {
    if (allUsersMap[uid] && !members.some((m) => m.uid === uid)) {
      members.push(allUsersMap[uid]);
    }
  });

  await createAdminGroupChat(request.groupName, request.description || '', members, adminUser);
  await updateDoc(doc(db, 'groupRequests', request.id), {
    status: 'approved'
  });
}

// Admin rejects Group Request
export async function rejectGroupRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, 'groupRequests', requestId), {
    status: 'rejected'
  });
}

// User submits Password Reset Request
export async function submitPasswordResetRequest(user: UserProfile, reason = ''): Promise<void> {
  const reqId = 'req_pwd_' + Date.now();
  const reqDocRef = doc(db, 'passwordRequests', reqId);

  const reqData: PasswordResetRequest = {
    id: reqId,
    userId: user.uid,
    userName: user.name,
    userChatCode: user.chatCode,
    reason: reason.trim(),
    status: 'pending',
    createdAt: Date.now()
  };

  await setDoc(reqDocRef, reqData);
}

// Listen to Password Reset Requests (Admin)
export function subscribeToPasswordRequests(
  onUpdate: (requests: PasswordResetRequest[]) => void
) {
  const reqRef = collection(db, 'passwordRequests');
  const q = query(reqRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const list: PasswordResetRequest[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        userName: data.userName,
        userChatCode: data.userChatCode,
        reason: data.reason || '',
        status: data.status || 'pending',
        createdAt: data.createdAt || Date.now()
      };
    });
    onUpdate(list);
  });
}

// Admin resolves Password Request by setting new password
export async function resolvePasswordRequest(
  requestId: string,
  userId: string,
  newPlainPassword: string
): Promise<void> {
  await adminChangeUserPassword(userId, newPlainPassword);
  await updateDoc(doc(db, 'passwordRequests', requestId), {
    status: 'completed'
  });
}

// Admin deletes a Password Request permanently to clear backlog
export async function deletePasswordRequest(requestId: string): Promise<void> {
  const reqDocRef = doc(db, 'passwordRequests', requestId);
  await deleteDoc(reqDocRef);
}

// User submits Name Change Request (Since name change is restricted to Admin review)
export async function submitNameChangeRequest(
  user: UserProfile,
  requestedName: string,
  reason = ''
): Promise<void> {
  const trimmedName = requestedName.trim();
  if (!trimmedName) throw new Error('Please enter a valid desired name.');

  const reqId = 'req_name_' + Date.now();
  const reqDocRef = doc(db, 'nameChangeRequests', reqId);

  const reqData: NameChangeRequest = {
    id: reqId,
    userId: user.uid,
    currentName: user.name,
    requestedName: trimmedName,
    userChatCode: user.chatCode,
    reason: reason.trim(),
    status: 'pending',
    createdAt: Date.now()
  };

  await setDoc(reqDocRef, reqData);
}

// Listen to Name Change Requests (Admin)
export function subscribeToNameChangeRequests(
  onUpdate: (requests: NameChangeRequest[]) => void
) {
  const reqRef = collection(db, 'nameChangeRequests');
  const q = query(reqRef, orderBy('createdAt', 'desc'));

  return onSnapshot(q, (snapshot) => {
    const list: NameChangeRequest[] = snapshot.docs.map((d) => {
      const data = d.data();
      return {
        id: d.id,
        userId: data.userId,
        currentName: data.currentName || 'Unknown',
        requestedName: data.requestedName || 'Unknown',
        userChatCode: data.userChatCode || '------',
        reason: data.reason || '',
        status: data.status || 'pending',
        createdAt: data.createdAt || Date.now()
      };
    });
    onUpdate(list);
  });
}

// Admin approves Name Change Request and updates user's profile name
export async function approveNameChangeRequest(
  requestId: string,
  userId: string,
  newName: string
): Promise<void> {
  await adminUpdateUserName(userId, newName);
  await updateDoc(doc(db, 'nameChangeRequests', requestId), {
    status: 'approved'
  });
}

// Admin rejects Name Change Request
export async function rejectNameChangeRequest(requestId: string): Promise<void> {
  await updateDoc(doc(db, 'nameChangeRequests', requestId), {
    status: 'rejected'
  });
}

// Admin deletes Name Change Request
export async function deleteNameChangeRequest(requestId: string): Promise<void> {
  const reqDocRef = doc(db, 'nameChangeRequests', requestId);
  await deleteDoc(reqDocRef);
}

// Admin deletes a Group Request permanently to clear backlog
export async function deleteGroupRequest(requestId: string): Promise<void> {
  const reqDocRef = doc(db, 'groupRequests', requestId);
  await deleteDoc(reqDocRef);
}

// Emergency Lockdown Mode (Sole Kailash Control)
export async function setEmergencyLockdownMode(enabled: boolean): Promise<void> {
  const settingsRef = doc(db, 'systemSettings', 'global');
  await setDoc(
    settingsRef,
    {
      emergencyLockdown: enabled,
      updatedAt: Date.now()
    },
    { merge: true }
  );
}

// Subscribe to Emergency Mode
export function subscribeToEmergencyMode(onUpdate: (enabled: boolean) => void) {
  const settingsRef = doc(db, 'systemSettings', 'global');
  return onSnapshot(settingsRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(Boolean(snapshot.data()?.emergencyLockdown));
    } else {
      onUpdate(false);
    }
  });
}
