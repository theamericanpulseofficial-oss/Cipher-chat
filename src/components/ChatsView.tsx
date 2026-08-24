import React, { useState } from 'react';
import {
  Search,
  MessageSquare,
  ShieldCheck,
  UserPlus,
  Lock,
  Sparkles,
  ArrowRight,
  MessageCircle
} from 'lucide-react';
import { UserProfile, ChatConversation } from '../types';
import { useTheme } from '../context/ThemeContext';
import { formatChatCodeDisplay } from '../services/chatService';
import { UserAvatar } from './UserAvatar';
import { ChatRoomView } from './ChatRoomView';

interface ChatsViewProps {
  user: UserProfile;
  chats: ChatConversation[];
  activeChatId?: string | null;
  onOpenChat: (chatId: string) => void;
  onOpenNewChatModal: () => void;
}

export const ChatsView: React.FC<ChatsViewProps> = ({
  user,
  chats,
  activeChatId,
  onOpenChat,
  onOpenNewChatModal
}) => {
  const { theme } = useTheme();
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'unread'>('all');

  const filteredChats = chats.filter((chat) => {
    const friendUid = chat.participantIds.find((id) => id !== user.uid) || user.uid;
    const friend = chat.participants[friendUid] || { name: '', chatCode: '' };

    const matchesSearch =
      friend.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      friend.chatCode.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (chat.lastMessage?.text || '').toLowerCase().includes(searchQuery.toLowerCase());

    const unread = chat.unreadCounts?.[user.uid] || 0;
    if (activeFilter === 'unread') {
      return matchesSearch && unread > 0;
    }
    return matchesSearch;
  });

  const formatTime = (ts?: number) => {
    if (!ts) return '';
    const date = new Date(ts);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  // Selected chat for desktop split view (default to activeChatId or first chat if available on desktop)
  const selectedChatId = activeChatId || (chats.length > 0 ? chats[0].id : null);

  return (
    <div className="h-full max-w-7xl mx-auto p-3 sm:p-5 lg:p-6">
      {/* DESKTOP / LAPTOP SPLIT VIEW (md: and above) */}
      <div className="hidden md:grid md:grid-cols-12 gap-5 h-[calc(100vh-3rem)]">
        {/* Left Column: Conversations List */}
        <div className="md:col-span-5 lg:col-span-4 flex flex-col h-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#151b28] overflow-hidden">
          {/* Header */}
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                Conversations
              </h2>
              <button
                type="button"
                id="btn-desktop-new-chat-list"
                onClick={onOpenNewChatModal}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs cursor-pointer"
              >
                <UserPlus size={14} />
                <span>New</span>
              </button>
            </div>

            {/* Search Input */}
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search conversations..."
                className={`w-full pl-9 pr-3 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} text-xs transition-all`}
              />
            </div>

            {/* Filter Tabs */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveFilter('all')}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeFilter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                All ({chats.length})
              </button>
              <button
                type="button"
                onClick={() => setActiveFilter('unread')}
                className={`flex-1 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  activeFilter === 'unread'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-2xs'
                    : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                }`}
              >
                Unread
              </button>
            </div>
          </div>

          {/* List items */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/70 p-2 space-y-1">
            {filteredChats.length === 0 ? (
              <div className="text-center py-12 px-4">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {searchQuery ? 'No matching chats' : 'No conversations yet'}
                </p>
              </div>
            ) : (
              filteredChats.map((chat) => {
                const friendUid = chat.participantIds.find((id) => id !== user.uid) || user.uid;
                const friend = chat.participants[friendUid] || {
                  name: 'Friend',
                  chatCode: '??????'
                };
                const unread = chat.unreadCounts?.[user.uid] || 0;
                const isSelected = selectedChatId === chat.id;

                return (
                  <div
                    key={chat.id}
                    onClick={() => onOpenChat(chat.id)}
                    className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-200 dark:border-indigo-800/60'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
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
                      <div className="flex items-center justify-between gap-1 mb-0.5">
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white truncate">
                          {friend.name}
                        </h4>
                        <span className="text-[10px] text-slate-400 font-mono shrink-0">
                          {formatTime(chat.lastMessage?.timestamp || chat.updatedAt)}
                        </span>
                      </div>
                      <p className={`text-xs truncate ${unread > 0 ? 'font-bold text-indigo-600 dark:text-indigo-400' : 'text-slate-500 dark:text-slate-400'}`}>
                        {chat.lastMessage ? chat.lastMessage.text : 'Start conversation'}
                      </p>
                    </div>

                    {unread > 0 && (
                      <span className="px-1.5 py-0.5 rounded-full text-[10px] font-black bg-indigo-600 text-white shrink-0">
                        {unread}
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column: Desktop Active Chat Panel */}
        <div className="md:col-span-7 lg:col-span-8 h-full">
          {selectedChatId ? (
            <ChatRoomView
              chatId={selectedChatId}
              currentUser={user}
              chats={chats}
              isEmbedded
            />
          ) : (
            <div className="h-full rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#151b28] flex flex-col items-center justify-center p-8 text-center">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-4">
                <MessageCircle size={32} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                Select a Conversation
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mt-1 mb-6">
                Choose a chat from the left list or connect with a friend using their unique Chat Code.
              </p>
              <button
                type="button"
                onClick={onOpenNewChatModal}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
              >
                <UserPlus size={16} />
                <span>Connect With Code</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* MOBILE CONVERSATIONS LIST (< md screens) */}
      <div className="md:hidden space-y-4">
        {/* Mobile Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 dark:text-white">
              Chats
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Encrypted real-time messaging
            </p>
          </div>

          <button
            type="button"
            onClick={onOpenNewChatModal}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs cursor-pointer"
          >
            <UserPlus size={14} />
            <span>Connect</span>
          </button>
        </div>

        {/* Mobile Search */}
        <div className="relative">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by name or code..."
            className={`w-full pl-10 pr-4 py-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} text-sm transition-all`}
          />
        </div>

        {/* Mobile Chats List */}
        <div className={`rounded-2xl border ${theme.surfaceCard} overflow-hidden divide-y divide-slate-100 dark:divide-slate-800`}>
          {filteredChats.length === 0 ? (
            <div className="py-16 px-4 text-center">
              <div className="w-14 h-14 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
                <MessageSquare size={26} />
              </div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {searchQuery ? 'No matching chats found' : 'No chats yet'}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mx-auto mt-1 mb-5">
                Start a connection by entering your friend's 6-character chat code.
              </p>
              {!searchQuery && (
                <button
                  type="button"
                  onClick={onOpenNewChatModal}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 shadow-xs cursor-pointer"
                >
                  <UserPlus size={15} />
                  <span>Enter Friend Code</span>
                </button>
              )}
            </div>
          ) : (
            filteredChats.map((chat) => {
              const friendUid = chat.participantIds.find((id) => id !== user.uid) || user.uid;
              const friend = chat.participants[friendUid] || {
                name: 'Unknown User',
                chatCode: '??????'
              };
              const unread = chat.unreadCounts?.[user.uid] || 0;

              return (
                <div
                  key={chat.id}
                  onClick={() => onOpenChat(chat.id)}
                  className="flex items-center gap-3.5 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/60 active:bg-slate-100 cursor-pointer transition-colors"
                >
                  <UserAvatar
                    name={friend.name}
                    photoURL={friend.photoURL}
                    avatarColor={friend.avatarColor}
                    avatarIcon={friend.avatarIcon}
                    size="lg"
                    showOnlineStatus
                  />

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <h4 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                          {friend.name}
                        </h4>
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700">
                          {formatChatCodeDisplay(friend.chatCode)}
                        </span>
                      </div>

                      <span className="text-[11px] text-slate-400 font-medium shrink-0">
                        {formatTime(chat.lastMessage?.timestamp || chat.updatedAt)}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs truncate ${unread > 0 ? 'font-bold text-slate-900 dark:text-slate-100' : 'text-slate-500 dark:text-slate-400'}`}>
                        {chat.lastMessage
                          ? `${chat.lastMessage.senderId === user.uid ? 'You: ' : ''}${chat.lastMessage.text}`
                          : 'No messages yet. Tap to say hello!'}
                      </p>

                      {unread > 0 && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-indigo-600 text-white shrink-0">
                          {unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
