import React, { useState } from 'react';
import {
  Copy,
  Check,
  Key,
  Plus,
  MoreHorizontal,
  Search,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  ArrowRight,
  UserCheck,
  AlertCircle,
  Loader2,
  Lock,
  Camera,
  Share2,
  Users
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, ChatConversation, NavTab } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './Toast';
import {
  formatChatCodeDisplay,
  searchUserByCode,
  getOrCreateChatConversation,
  normalizeChatCode
} from '../services/chatService';
import { playConnectSuccessSound } from '../utils/audio';
import { UserAvatar } from './UserAvatar';

interface DashboardViewProps {
  user: UserProfile;
  chats: ChatConversation[];
  onOpenChat: (chatId: string) => void;
  onNavigate: (tab: NavTab) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  user,
  chats,
  onOpenChat,
  onNavigate
}) => {
  const { theme, soundEnabled } = useTheme();
  const { showToast } = useToast();

  const [copied, setCopied] = useState(false);
  const [friendCodeInput, setFriendCodeInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [foundFriend, setFoundFriend] = useState<UserProfile | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  // Copy code to clipboard with celebratory confetti feedback
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(user.chatCode);
      setCopied(true);
      showToast('Personal chat code copied to clipboard!', 'success');

      confetti({
        particleCount: 45,
        spread: 65,
        origin: { y: 0.8 },
        colors: ['#4f46e5', '#7c3aed', '#6366f1', '#10b981']
      });

      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast(user.chatCode, 'info');
    }
  };

  // Search friend by code
  const handleSearchFriend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSearchError(null);
    setFoundFriend(null);

    const cleanInput = normalizeChatCode(friendCodeInput);
    if (!cleanInput) {
      setSearchError('Please enter a chat code (e.g. XYZ-789).');
      return;
    }

    if (cleanInput === normalizeChatCode(user.chatCode)) {
      setSearchError('You cannot connect with yourself.');
      return;
    }

    setIsSearching(true);
    try {
      const { foundUser, error } = await searchUserByCode(cleanInput, user.uid);
      if (error) {
        setSearchError(error);
      } else if (foundUser) {
        setFoundFriend(foundUser);
      }
    } catch {
      setSearchError('Error finding friend. Please check the code.');
    } finally {
      setIsSearching(false);
    }
  };

  // Start/open conversation with found friend
  const handleConnectWithFriend = async (friend: UserProfile) => {
    setIsConnecting(true);
    try {
      const chat = await getOrCreateChatConversation(user, friend);
      if (soundEnabled) playConnectSuccessSound();
      showToast(`Connected with ${friend.name}!`, 'success');
      setFriendCodeInput('');
      setFoundFriend(null);
      onOpenChat(chat.id);
    } catch (err) {
      console.error(err);
      showToast('Failed to start chat conversation.', 'error');
    } finally {
      setIsConnecting(false);
    }
  };

  // Format timestamp for display
  const formatTime = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();
    if (isYesterday) return 'Yesterday';

    return date.toLocaleDateString([], { weekday: 'short' });
  };

  // Recent chats slice (first 4)
  const recentChats = chats.slice(0, 5);

  return (
    <div className="max-w-6xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Top Greeting Header (Responsive layout) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div
            onClick={() => onNavigate('profile')}
            className="cursor-pointer group"
            title="Go to profile"
          >
            <UserAvatar
              name={user.name}
              photoURL={user.photoURL}
              avatarColor={user.avatarColor}
              avatarIcon={user.avatarIcon}
              size="lg"
              showOnlineStatus
            />
          </div>
          <div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Hello, {user.name}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 font-normal flex items-center gap-1.5 mt-0.5">
              <ShieldCheck size={14} className="text-emerald-500" />
              <span>End-to-End Real-Time Encrypted Session</span>
            </p>
          </div>
        </div>

        {/* Quick Action Profile on Desktop */}
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => onNavigate('profile')}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
          >
            <Camera size={14} />
            <span>Change Photo & Settings</span>
          </button>
        </div>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-start">
        {/* Left Column (Code + Connect) */}
        <div className="lg:col-span-6 space-y-6">
          {/* Card 1: YOUR CHAT CODE */}
          <div
            id="card-your-chat-code"
            className={`p-6 sm:p-8 rounded-2xl border ${theme.surfaceCard} flex flex-col items-center justify-center text-center transition-all`}
          >
            <div className="flex items-center justify-between w-full mb-4">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                YOUR CHAT CODE
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/70 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                Unique
              </span>
            </div>

            {/* Stylized code display */}
            <div className="my-2 py-4 px-6 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 w-full flex items-center justify-center border border-indigo-100/80 dark:border-indigo-900/40">
              <span className="text-3xl sm:text-4xl font-extrabold tracking-widest font-mono text-indigo-600 dark:text-indigo-400 select-all">
                {formatChatCodeDisplay(user.chatCode)}
              </span>
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 mb-5 max-w-sm">
              Share this code with friends so they can easily find and message you in real-time.
            </p>

            <button
              id="btn-copy-chat-code"
              onClick={handleCopyCode}
              className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs active:scale-98 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check size={16} />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy size={16} />
                  <span>Copy My Chat Code</span>
                </>
              )}
            </button>
          </div>

          {/* Card 2: CONNECT WITH A FRIEND */}
          <div
            id="card-connect-friend"
            className={`p-6 sm:p-8 rounded-2xl border ${theme.surfaceCard} transition-all`}
          >
            <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500 block mb-1">
              CONNECT WITH A FRIEND
            </span>
            <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mb-5">
              Enter a friend's 6-character code to start chatting.
            </p>

            <form onSubmit={handleSearchFriend} className="space-y-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <Key size={17} />
                  </div>
                  <input
                    id="input-friend-code"
                    type="text"
                    value={friendCodeInput}
                    onChange={(e) => {
                      setFriendCodeInput(e.target.value);
                      if (searchError) setSearchError(null);
                    }}
                    placeholder="Enter Code (e.g. K8X-4P2)"
                    className={`w-full pl-10 pr-4 py-2.5 sm:py-3 rounded-xl border ${theme.inputBg} ${theme.inputBorder} text-sm font-mono tracking-wider transition-all`}
                  />
                </div>

                <button
                  id="btn-search-connect"
                  type="submit"
                  disabled={isSearching}
                  className="inline-flex items-center justify-center gap-2 px-6 py-2.5 sm:py-3 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs active:scale-98 disabled:opacity-60 cursor-pointer shrink-0"
                >
                  {isSearching ? (
                    <Loader2 size={16} className="animate-spin" />
                  ) : (
                    <>
                      <Plus size={16} />
                      <span>Search & Connect</span>
                    </>
                  )}
                </button>
              </div>

              {/* Error display */}
              {searchError && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 text-xs border border-rose-200 dark:border-rose-900">
                  <AlertCircle size={15} className="shrink-0" />
                  <span>{searchError}</span>
                </div>
              )}

              {/* Found Friend Preview Card */}
              {foundFriend && (
                <div className="p-4 rounded-xl bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800 flex items-center justify-between gap-3 animate-in fade-in zoom-in-95 duration-200">
                  <div className="flex items-center gap-3 min-w-0">
                    <UserAvatar
                      name={foundFriend.name}
                      photoURL={foundFriend.photoURL}
                      avatarColor={foundFriend.avatarColor}
                      avatarIcon={foundFriend.avatarIcon}
                      size="md"
                    />
                    <div className="min-w-0">
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                        {foundFriend.name}
                      </h4>
                      <p className="text-xs text-indigo-600 dark:text-indigo-400 font-mono">
                        Code: {formatChatCodeDisplay(foundFriend.chatCode)}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleConnectWithFriend(foundFriend)}
                    disabled={isConnecting}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs shrink-0 cursor-pointer"
                  >
                    {isConnecting ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <>
                        <MessageSquare size={14} />
                        <span>Start Chat</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right Column: RECENT CHATS */}
        <div className="lg:col-span-6">
          <div
            id="card-recent-chats"
            className={`p-6 sm:p-8 rounded-2xl border ${theme.surfaceCard} transition-all`}
          >
            <div className="flex items-center justify-between mb-5">
              <span className="text-[11px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">
                RECENT CONVERSATIONS
              </span>
              <span className="text-xs font-semibold text-slate-400">
                {chats.length} {chats.length === 1 ? 'chat' : 'chats'}
              </span>
            </div>

            {/* Chat Items List */}
            {recentChats.length === 0 ? (
              <div className="text-center py-12 px-4 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl">
                <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                  <MessageSquare size={22} />
                </div>
                <h4 className="text-sm font-semibold text-slate-800 dark:text-slate-200">
                  No conversations yet
                </h4>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-xs mx-auto">
                  Enter a friend's chat code to connect and start chatting in real-time.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {recentChats.map((chat) => {
                  const friendUid = chat.participantIds.find((id) => id !== user.uid) || user.uid;
                  const friend = chat.participants[friendUid] || {
                    name: 'Friend',
                    chatCode: '??????'
                  };
                  const unread = chat.unreadCounts?.[user.uid] || 0;

                  return (
                    <div
                      key={chat.id}
                      onClick={() => onOpenChat(chat.id)}
                      className="group flex items-center gap-3.5 py-3.5 px-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-all"
                    >
                      <UserAvatar
                        name={friend.name}
                        photoURL={friend.photoURL}
                        avatarColor={friend.avatarColor}
                        avatarIcon={friend.avatarIcon}
                        size="md"
                        showOnlineStatus
                      />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-0.5">
                          <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                            {friend.name}
                          </h4>
                          <span className="text-[11px] text-slate-400 shrink-0 font-medium">
                            {formatTime(chat.lastMessage?.timestamp || chat.updatedAt)}
                          </span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                          {chat.lastMessage ? chat.lastMessage.text : 'Tap to start conversation'}
                        </p>
                      </div>

                      {/* Unread indicator */}
                      {unread > 0 && (
                        <div className="w-2.5 h-2.5 rounded-full bg-indigo-600 dark:bg-indigo-400 shrink-0 ring-2 ring-indigo-200 dark:ring-indigo-900/60" />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer View All Chats Link */}
            <div className="mt-6 pt-4 border-t border-slate-100 dark:border-slate-800/80 text-center">
              <button
                id="btn-view-all-chats"
                onClick={() => onNavigate('chats')}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-colors cursor-pointer"
              >
                <span>View All Conversations</span>
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
