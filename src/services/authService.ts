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

const SESSION_STORAGE_KEY = 'cipherchat_active_uid';

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
async function generateUniqueChatCode(): Promise<string> {
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
      bio: data.bio || 'Ready to securely connect on CipherChat.'
    };
    await updateDoc(userDocRef, {
      lastSeen: Date.now(),
      photoURL: profile.photoURL || null
    });
    try {
      localStorage.setItem(SESSION_STORAGE_KEY, user.uid);
    } catch (e) {
      console.warn('LocalStorage error:', e);
    }
    return profile;
  }

  // Create new profile for Google user
  const chatCode = await generateUniqueChatCode();
  const displayName = user.displayName || user.email?.split('@')[0] || 'User';
  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const avatarIcon = AVATAR_ICONS[Math.floor(Math.random() * AVATAR_ICONS.length)];

  const profile: UserProfile = {
    uid: user.uid,
    name: displayName,
    chatCode,
    email: user.email || `${displayName.toLowerCase().replace(/[^a-z0-9]/g, '')}@cipherchat.internal`,
    photoURL: user.photoURL || undefined,
    avatarColor,
    avatarIcon,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    bio: 'Ready to securely connect on CipherChat.'
  };

  await setDoc(userDocRef, {
    ...profile,
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

  // Check if username is already registered in Firestore
  const usersRef = collection(db, 'users');
  const nameQuery = query(usersRef, where('normalizedName', '==', normalizedName));
  const nameSnapshot = await getDocs(nameQuery);

  if (!nameSnapshot.empty) {
    throw new Error(`Username "${trimmedName}" is already registered. Please sign in or choose a different name.`);
  }

  const passwordHash = await hashPassword(password);
  const chatCode = await generateUniqueChatCode();
  const uid = generateUniqueUserId();

  const avatarColor = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const avatarIcon = AVATAR_ICONS[Math.floor(Math.random() * AVATAR_ICONS.length)];

  const profile: UserProfile = {
    uid,
    name: trimmedName,
    chatCode,
    email: `${normalizedName.replace(/[^a-z0-9]/g, '_')}@cipherchat.internal`,
    photoURL: photoURL || undefined,
    avatarColor,
    avatarIcon,
    createdAt: Date.now(),
    lastSeen: Date.now(),
    bio: 'Ready to securely connect on CipherChat.'
  };

  await setDoc(doc(db, 'users', uid), {
    ...profile,
    normalizedName,
    passwordHash,
    createdAtTimestamp: serverTimestamp()
  });

  try {
    localStorage.setItem(SESSION_STORAGE_KEY, uid);
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }

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

  try {
    await updateDoc(doc(db, 'users', userDoc.id), {
      lastSeen: Date.now()
    });
  } catch (e) {
    console.warn('Could not update last seen:', e);
  }

  const profile: UserProfile = {
    uid: userDoc.id,
    name: userData.name || trimmedInput,
    chatCode: userData.chatCode,
    email: userData.email,
    photoURL: userData.photoURL || undefined,
    avatarColor: userData.avatarColor || 'bg-indigo-600',
    avatarIcon: userData.avatarIcon || 'shield',
    createdAt: userData.createdAt || Date.now(),
    lastSeen: Date.now(),
    bio: userData.bio || 'Ready to securely connect on CipherChat.'
  };

  try {
    localStorage.setItem(SESSION_STORAGE_KEY, userDoc.id);
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }

  return profile;
}

// Fetch user profile by UID
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      const data = userDoc.data();
      return {
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
    ...updates,
    updatedAt: Date.now()
  };
  if (updates.name) {
    sanitizedUpdates.normalizedName = updates.name.trim().toLowerCase();
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
