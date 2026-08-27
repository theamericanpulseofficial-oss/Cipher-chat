import {
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import {
  doc,
  setDoc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  serverTimestamp,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { UserProfile } from '../types';
import { hashPassword } from '../utils/crypto';
import { normalizeChatCode } from './chatService';

const SESSION_STORAGE_KEY = 'up1chatbox_active_uid';
const DEVICE_ID_KEY = 'up1chatbox_device_id';
const DEVICE_BOUND_ACCOUNT_KEY = 'up1chatbox_bound_user';
const SAVED_ACCOUNTS_KEY = 'up1chatbox_saved_accounts';
const MASTER_PHONE_KEY = 'up1chatbox_is_master_phone';

// Check if this device is Kailash's Master Phone
export function isMasterPhone(): boolean {
  try {
    return localStorage.getItem(MASTER_PHONE_KEY) === 'true';
  } catch {
    return false;
  }
}

// Mark device as master phone
export function setMasterPhoneFlag(isMaster: boolean): void {
  try {
    if (isMaster) {
      localStorage.setItem(MASTER_PHONE_KEY, 'true');
    } else {
      localStorage.removeItem(MASTER_PHONE_KEY);
    }
  } catch (e) {
    console.warn(e);
  }
}

// Get list of accounts saved on this device (for quick switching)
export function getSavedAccounts(): UserProfile[] {
  try {
    const raw = localStorage.getItem(SAVED_ACCOUNTS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

// Save or update an account in this device's saved accounts list
export function saveAccountToDevice(profile: UserProfile): void {
  try {
    const current = getSavedAccounts();
    const filtered = current.filter((a) => a.uid !== profile.uid);
    const updated = [profile, ...filtered];
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));

    // If this account is Kailash, automatically designate this device as master phone
    if ((profile.name || '').trim().toLowerCase() === 'kailash') {
      setMasterPhoneFlag(true);
    }
  } catch (e) {
    console.warn(e);
  }
}

// Remove an account from saved accounts list
export function removeSavedAccountFromDevice(uid: string): void {
  try {
    const current = getSavedAccounts();
    const updated = current.filter((a) => a.uid !== uid);
    localStorage.setItem(SAVED_ACCOUNTS_KEY, JSON.stringify(updated));
  } catch (e) {
    console.warn(e);
  }
}

// Switch active account on device
export async function switchActiveAccount(uid: string): Promise<UserProfile | null> {
  const profile = await getUserProfile(uid);
  if (profile) {
    localStorage.setItem(SESSION_STORAGE_KEY, uid);
    saveAccountToDevice(profile);
    return profile;
  }
  return null;
}

// Get or initialize persistent unique device ID
export function getOrCreateDeviceId(): string {
  try {
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    if (!deviceId) {
      deviceId = 'dev_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    return deviceId;
  } catch {
    return 'dev_fallback_' + Date.now();
  }
}

// Get device-bound account info if any
export function getDeviceBoundAccount(): { uid: string; name: string } | null {
  try {
    const raw = localStorage.getItem(DEVICE_BOUND_ACCOUNT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Get custom chat code for special designated usernames
export function getCustomChatCodeForName(name: string): string | null {
  const norm = (name || '').trim().toLowerCase();
  if (norm === 'naveen') {
    return 'NAVEEN'; // Formats as NAV-EEN in UI
  }
  if (norm === 'kailash') {
    return 'KKKKKK'; // Formats as KKK-KKK in UI
  }
  return null;
}

// Generate unique 6-character chat code (e.g., K8X-4P2)
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateRandomCode(length = 6): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
  }
  return result;
}

// Generate unique UID for direct profile accounts
export function generateUniqueUserId(): string {
  return 'usr_' + Date.now().toString(36) + '_' + Math.random().toString(36).substring(2, 9);
}

// Ensure chat code is truly unique in Firestore
export async function generateUniqueChatCode(name?: string): Promise<string> {
  if (name) {
    const custom = getCustomChatCodeForName(name);
    if (custom) return custom;
  }
  let attempts = 0;
  while (attempts < 10) {
    const candidate = generateRandomCode(6);
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('chatCode', '==', candidate));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      return candidate;
    }
    attempts++;
  }
  return generateRandomCode(4) + Math.floor(Math.random() * 90 + 10);
}

// Aesthetic avatar colors & icons
const AVATAR_COLORS = [
  'bg-indigo-600',
  'bg-violet-600',
  'bg-purple-600',
  'bg-emerald-600',
  'bg-teal-600',
  'bg-blue-600',
  'bg-rose-600',
  'bg-amber-600'
];

const AVATAR_ICONS = ['shield', 'zap', 'cpu', 'lock', 'code', 'terminal', 'orbit', 'compass'];

// Google Sign-In
export async function signInWithGoogle(): Promise<UserProfile> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const result = await signInWithPopup(auth, provider);
  const user = result.user;

  const userDocRef = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userDocRef);

  if (userSnap.exists()) {
    const data = userSnap.data();
    const profile: UserProfile = {
      uid: user.uid,
      name: data.name || user.displayName || 'User',
      chatCode: data.chatCode,
      email: user.email || data.email,
      photoURL: data.photoURL || user.photoURL || undefined,
      avatarColor: data.avatarColor || 'bg-indigo-600',
      avatarIcon: data.avatarIcon || 'shield',
      createdAt: data.createdAt || Date.now(),
      lastSeen: Date.now(),
      bio: data.bio || 'Ready to securely connect on UP1CHATBOX.',
      isVerified: data.isVerified || false,
      isNameChangeLocked: data.isNameChangeLocked || false,
      deviceId: data.deviceId || getOrCreateDeviceId(),
      isBanned: data.isBanned || false,
      bannedReason: data.bannedReason || '',
      messagingDisabled: data.messagingDisabled || false,
      voiceDisabled: data.voiceDisabled || false,
      photosDisabled: data.photosDisabled || false
    };
    await updateDoc(userDocRef, {
      lastSeen: Date.now(),
      photoURL: profile.photoURL || null
    });
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, user.uid);
      localStorage.setItem(DEVICE_BOUND_ACCOUNT_KEY, JSON.stringify({ uid: profile.uid, name: profile.name }));
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    return profile;
  }

  // Create new profile for Google user
  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const customChatCode = getCustomChatCodeForName(displayName);
  const chatCode = customChatCode || await generateUniqueChatCode(displayName);
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const avatarIcon = AVATAR_ICONS[Math.floor(Math.random() * AVATAR_ICONS.length)];

  const profile: UserProfile = {
    uid: user.uid,
    name: displayName,
    chatCode,
    email: user.email || `${displayName.toLowerCase().replace(/[^a-z0-9]/g, '')}@up1chatbox.internal`,
    photoURL: user.photoURL || undefined,
    avatarColor,
    avatarIcon,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    bio: 'Ready to securely connect on UP1CHATBOX.'
  };

  await setDoc(userDocRef, {
    uid: profile.uid,
    name: profile.name,
    chatCode: profile.chatCode,
    email: profile.email,
    photoURL: user.photoURL || null,
    avatarColor: profile.avatarColor,
    avatarIcon: profile.avatarIcon,
    createdAt: profile.createdAt,
    lastSeen: profile.lastSeen,
    bio: profile.bio,
    normalizedName: displayName.toLowerCase(),
    createdAtTimestamp: serverTimestamp()
  });

  try {
    localStorage.setItem(SESSION_STORAGE_KEY, user.uid);
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }

  return profile;
}

// Register a new user with Name & Password
export async function registerUser(name: string, password: string, photoURL?: string): Promise<UserProfile> {
  const trimmedName = name.trim();
  if (trimmedName.length < 2) {
    throw new Error('Name must be at least 2 characters long.');
  }
  if (password.length < 6) {
    throw new Error('Password must be at least 6 characters.');
  }

  const normalizedName = trimmedName.toLowerCase();
  const isMasterUser = normalizedName === 'kailash' || isMasterPhone();

  // 1 Device per Account restriction (Strict for other users, bypassed for Master phone)
  if (!isMasterUser) {
    const boundAccount = getDeviceBoundAccount();
    if (boundAccount && boundAccount.name) {
      throw new Error(`This device has already created account "${boundAccount.name}". Only 1 account per device is permitted.`);
    }
  }

  // Check if username is already registered in Firestore (case-insensitive check)
  const usersRef = collection(db, 'users');
  const nameQuery = query(usersRef, where('normalizedName', '==', normalizedName));
  const nameSnapshot = await getDocs(nameQuery);

  const directQuery = query(usersRef, where('name', '==', trimmedName));
  const directSnapshot = await getDocs(directQuery);

  if (!nameSnapshot.empty || !directSnapshot.empty) {
    throw new Error(`Username "${trimmedName}" is already taken. Please choose a unique name.`);
  }

  const passwordHash = await hashPassword(password);
  const customChatCode = getCustomChatCodeForName(trimmedName);
  const chatCode = customChatCode || await generateUniqueChatCode(trimmedName);
  const uid = generateUniqueUserId();

  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const avatarIcon = AVATAR_ICONS[Math.floor(Math.random() * AVATAR_ICONS.length)];

  const deviceId = getOrCreateDeviceId();

  const profile: UserProfile = {
    uid,
    name: trimmedName,
    chatCode,
    email: `${normalizedName.replace(/[^a-z0-9]/g, '_')}@up1chatbox.internal`,
    photoURL: photoURL || undefined,
    avatarColor,
    avatarIcon,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    bio: 'Ready to securely connect on UP1CHATBOX.',
    isVerified: false,
    isNameChangeLocked: false,
    deviceId
  };

  // Ensure no undefined values are passed to Firestore setDoc
  await setDoc(doc(db, 'users', uid), {
    uid: profile.uid,
    name: profile.name,
    chatCode: profile.chatCode,
    email: profile.email,
    photoURL: photoURL || null,
    avatarColor: profile.avatarColor,
    avatarIcon: profile.avatarIcon,
    createdAt: profile.createdAt,
    lastSeen: profile.lastSeen,
    bio: profile.bio,
    normalizedName,
    passwordHash,
    isVerified: false,
    isNameChangeLocked: false,
    deviceId,
    createdAtTimestamp: serverTimestamp()
  });

  try {
    localStorage.setItem(SESSION_STORAGE_KEY, uid);
    if (!isMasterUser) {
      localStorage.setItem(DEVICE_BOUND_ACCOUNT_KEY, JSON.stringify({ uid: profile.uid, name: profile.name }));
    }
    saveAccountToDevice(profile);
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }

  return profile;
}

// Create an extra account on Master Phone without losing previous sessions
export async function createExtraAccountOnDevice(
  name: string,
  password: string,
  photoURL?: string
): Promise<UserProfile> {
  const profile = await registerUser(name, password, photoURL);
  saveAccountToDevice(profile);
  return profile;
}

// Login existing user
export async function loginUser(identifier: string, password: string): Promise<UserProfile> {
  const trimmedInput = identifier.trim();
  if (!trimmedInput) {
    throw new Error('Please enter your name or personal chat code.');
  }
  if (!password) {
    throw new Error('Please enter your password.');
  }

  const normalizedInput = trimmedInput.toLowerCase();
  const normalizedCode = normalizeChatCode(trimmedInput);
  const enteredHash = await hashPassword(password);

  const usersRef = collection(db, 'users');

  let q = query(usersRef, where('normalizedName', '==', normalizedInput));
  let snapshot = await getDocs(q);

  if (snapshot.empty && normalizedCode.length >= 4) {
    q = query(usersRef, where('chatCode', '==', normalizedCode));
    snapshot = await getDocs(q);
  }

  if (snapshot.empty) {
    throw new Error(`Account "${trimmedInput}" not found. Please verify your details or create an account.`);
  }

  const userDoc = snapshot.docs[0];
  const userData = userDoc.data();

  if (userData.passwordHash && userData.passwordHash !== enteredHash) {
    throw new Error('Incorrect password. Please try again.');
  }

  const isMasterUser = normalizedInput === 'kailash' || (userData.name || '').trim().toLowerCase() === 'kailash' || isMasterPhone();

  // 1 Device per Account restriction check (Bypassed on Master Phone)
  if (!isMasterUser) {
    const boundAccount = getDeviceBoundAccount();
    if (boundAccount && boundAccount.uid && boundAccount.uid !== userDoc.id) {
      throw new Error(`This device is already locked to account "${boundAccount.name}". 1 account per device policy is active.`);
    }
  }

  const currentDeviceId = getOrCreateDeviceId();
  const customChatCode = getCustomChatCodeForName(userData.name || trimmedInput);
  const effectiveChatCode = customChatCode || userData.chatCode;

  try {
    const loginUpdates: Record<string, unknown> = {
      lastSeen: Date.now(),
      deviceId: userData.deviceId || currentDeviceId
    };
    if (customChatCode && userData.chatCode !== customChatCode) {
      loginUpdates.chatCode = customChatCode;
    }
    await updateDoc(doc(db, 'users', userDoc.id), loginUpdates);
  } catch (e) {
    console.warn('Could not update login info:', e);
  }

  const profile: UserProfile = {
    uid: userDoc.id,
    name: userData.name || trimmedInput,
    chatCode: effectiveChatCode,
    email: userData.email,
    photoURL: userData.photoURL || undefined,
    avatarColor: userData.avatarColor || 'bg-indigo-600',
    avatarIcon: userData.avatarIcon || 'shield',
    createdAt: userData.createdAt || Date.now(),
    lastSeen: Date.now(),
    bio: userData.bio || 'Ready to securely connect on UP1CHATBOX.',
    isVerified: userData.isVerified || false,
    isNameChangeLocked: userData.isNameChangeLocked || false,
    deviceId: userData.deviceId || currentDeviceId,
    isBanned: userData.isBanned || false,
    bannedReason: userData.bannedReason || '',
    messagingDisabled: userData.messagingDisabled || false,
    voiceDisabled: userData.voiceDisabled || false,
    photosDisabled: userData.photosDisabled || false
  };

  try {
    localStorage.setItem(SESSION_STORAGE_KEY, userDoc.id);
    if (!isMasterUser) {
      localStorage.setItem(DEVICE_BOUND_ACCOUNT_KEY, JSON.stringify({ uid: profile.uid, name: profile.name }));
    }
    saveAccountToDevice(profile);
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }

  return profile;
}

// Add an existing account to device list
export async function addExistingAccountToDevice(identifier: string, password: string): Promise<UserProfile> {
  const profile = await loginUser(identifier, password);
  saveAccountToDevice(profile);
  return profile;
}

// Fetch user profile by UID
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      const customChatCode = getCustomChatCodeForName(data.name || '');
      const effectiveChatCode = customChatCode || data.chatCode;

      // Auto-migrate chat code to custom one if missing or outdated
      if (customChatCode && data.chatCode !== customChatCode) {
        updateDoc(doc(db, 'users', uid), { chatCode: customChatCode }).catch((e) =>
          console.warn('Auto-sync chatCode error:', e)
        );
      }

      return {
        uid: userDoc.id,
        name: data.name,
        chatCode: effectiveChatCode,
        email: data.email,
        photoURL: data.photoURL || undefined,
        avatarColor: data.avatarColor || 'bg-indigo-600',
        avatarIcon: data.avatarIcon || 'shield',
        createdAt: data.createdAt || Date.now(),
        lastSeen: data.lastSeen || Date.now(),
        bio: data.bio,
        isVerified: data.isVerified || false,
        isNameChangeLocked: data.isNameChangeLocked || false,
        deviceId: data.deviceId || undefined,
        isBanned: data.isBanned || false,
        bannedReason: data.bannedReason || '',
        messagingDisabled: data.messagingDisabled || false,
        voiceDisabled: data.voiceDisabled || false,
        photosDisabled: data.photosDisabled || false
      };
    }
    return null;
  } catch (err) {
    console.error('Error fetching user profile:', err);
    return null;
  }
}

// Update user profile (including photoURL)
export async function updateUserProfile(
  uid: string,
  updates: Partial<Pick<UserProfile, 'name' | 'bio' | 'photoURL' | 'avatarColor' | 'avatarIcon'>>
): Promise<void> {
  const sanitizedUpdates: Record<string, unknown> = {
    updatedAt: Date.now()
  };

  if (updates.name !== undefined) {
    const userSnap = await getDoc(doc(db, 'users', uid));
    if (userSnap.exists() && userSnap.data()?.isNameChangeLocked) {
      throw new Error('Name change is locked by the administrator. Please contact Admin.');
    }

    const trimmedName = updates.name.trim();
    if (trimmedName.length < 2) {
      throw new Error('Name must be at least 2 characters long.');
    }
    const normalizedName = trimmedName.toLowerCase();

    // Check if another user already has this username
    const usersRef = collection(db, 'users');
    const nameQuery = query(usersRef, where('normalizedName', '==', normalizedName));
    const nameSnapshot = await getDocs(nameQuery);

    const isTakenByOther = nameSnapshot.docs.some((d) => d.id !== uid);
    if (isTakenByOther) {
      throw new Error(`The username "${trimmedName}" is already taken. Please choose a different name.`);
    }

    sanitizedUpdates.name = trimmedName;
    sanitizedUpdates.normalizedName = normalizedName;

    const customCode = getCustomChatCodeForName(trimmedName);
    if (customCode) {
      sanitizedUpdates.chatCode = customCode;
    }
  }

  if (updates.bio !== undefined) {
    sanitizedUpdates.bio = updates.bio.trim();
  }
  if (updates.avatarColor !== undefined) {
    sanitizedUpdates.avatarColor = updates.avatarColor;
  }
  if (updates.avatarIcon !== undefined) {
    sanitizedUpdates.avatarIcon = updates.avatarIcon;
  }
  if (updates.photoURL !== undefined) {
    sanitizedUpdates.photoURL = updates.photoURL || null;
  }

  await updateDoc(doc(db, 'users', uid), sanitizedUpdates);
}

// Logout user
export async function logoutUser(): Promise<void> {
  try {
    localStorage.removeItem(SESSION_STORAGE_KEY);
  } catch (e) {
    console.warn(e);
  }
  try {
    await signOut(auth);
  } catch (e) {
    console.warn('Firebase signOut error:', e);
  }
}

// Auth state observer
export function subscribeToAuthState(callback: (user: User | null, profile: UserProfile | null) => void) {
  let isMounted = true;

  const checkLocalSession = async () => {
    try {
      const savedUid = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedUid) {
        const profile = await getUserProfile(savedUid);
        if (isMounted && profile) {
          callback(auth.currentUser, profile);
          return;
        }
      }
      if (isMounted && !auth.currentUser) {
        callback(null, null);
      }
    } catch (err) {
      console.warn('Session check error:', err);
      if (isMounted) {
        callback(null, null);
      }
    }
  };

  checkLocalSession();

  const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
    if (!isMounted) return;
    if (firebaseUser) {
      const profile = await getUserProfile(firebaseUser.uid);
      callback(firebaseUser, profile);
    } else {
      const savedUid = localStorage.getItem(SESSION_STORAGE_KEY);
      if (savedUid) {
        const profile = await getUserProfile(savedUid);
        callback(null, profile);
      } else {
        callback(null, null);
      }
    }
  });

  return () => {
    isMounted = false;
    unsubscribe();
  };
}
