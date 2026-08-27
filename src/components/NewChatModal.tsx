import React, { useState } from 'react';
import {
  X,
  Key,
  Plus,
  Loader2,
  AlertCircle,
  MessageSquare
} from 'lucide-react';
import { UserProfile, ChatConversation } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './Toast';
import {
  searchUserByCode,
  getOrCreateChatConversation,
  formatChatCodeDisplay,
  normalizeChatCode
} from '../services/chatService';
import { playConnectSuccessSound } from '../utils/audio';
import { UserAvatar, VerifiedBadge } from './UserAvatar';

interface NewChatModalProps {
  currentUser: UserProfile;
  isOpen: boolean;
  onClose: () => void;
  onChatCreated: (chatId: string) => void;
}

export const NewChatModal: React.FC<NewChatModalProps> = ({
  currentUser,
  isOpen,
  onClose,
  onChatCreated
}) => {
  const { theme, soundEnabled } = useTheme();
  const { showToast } = useToast();

  const [code, setCode] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundUser, setFoundUser] = useState<UserProfile | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSearchError(null);
    setFoundUser(null);

    const clean = normalizeChatCode(code);
    if (!clean) {
      setSearchError('Please enter a 6-character chat code.');
      return;
    }

    if (clean === normalizeChatCode(currentUser.chatCode)) {
      setSearchError('You cannot connect with yourself.');
      return;
    }

    setIsSearching(true);
    try {
      const { foundUser: user, error } = await searchUserByCode(clean, currentUser.uid);
      if (error) {
        setSearchError(error);
      } else if (user) {
        setFoundUser(user);
      }
    } catch {
      setSearchError('Error searching for friend.');
    } finally {
      setIsSearching(false);
    }
  };

  const handleConnect = async () => {
    if (!foundUser) return;
    setIsConnecting(true);

    try {
      const chat = await getOrCreateChatConversation(currentUser, foundUser);
      if (soundEnabled) playConnectSuccessSound();
      showToast(`Connected with ${foundUser.name}!`, 'success');
      onChatCreated(chat.id);
      onClose();
    } catch (err) {
      console.error(err);
      showToast('Failed to create chat connection', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white dark:bg-[#181b24] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Connect With Friend
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Enter your friend's 6-character personal chat code.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSearch} className="space-y-4">
          <div className="relative">
            <Key size={17} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                if (searchError) setSearchError(null);
              }}
              placeholder="Enter Friend's Code (e.g. K8X-4P2)"
              className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} text-sm font-mono tracking-wider`}
            />
          </div>

          {searchError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle size={15} className="shrink-0" />
              <span>{searchError}</span>
            </div>
          )}

          {!foundUser && (
            <button
              type="submit"
              disabled={isSearching || !code.trim()}
              className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 cursor-pointer"
            >
              {isSearching ? (
                <Loader2 size={17} className="animate-spin" />
              ) : (
                <>
                  <Plus size={17} />
                  <span>Search User</span>
                </>
              )}
            </button>
          )}
        </form>

        {/* Found User Preview */}
        {foundUser && (
          <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <UserAvatar
                name={foundUser.name}
                photoURL={foundUser.photoURL}
                avatarColor={foundUser.avatarColor}
                avatarIcon={foundUser.avatarIcon}
                isVerified={foundUser.isVerified}
                size="md"
              />
              <div className="min-w-0">
                <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                  <span>{foundUser.name}</span>
                  {foundUser.isVerified && <VerifiedBadge size={14} />}
                </h4>
                <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                  {formatChatCodeDisplay(foundUser.chatCode)}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleConnect}
              disabled={isConnecting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs shrink-0 cursor-pointer"
            >
              {isConnecting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <>
                  <MessageSquare size={14} />
                  <span>Open Chat</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
