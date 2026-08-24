import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  Smile,
  Copy,
  Check,
  Lock,
  Sparkles,
  Info
} from 'lucide-react';
import { UserProfile, ChatConversation, ChatMessage } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './Toast';
import {
  subscribeToChatMessages,
  sendMessage,
  markChatAsRead,
  toggleMessageReaction,
  formatChatCodeDisplay
} from '../services/chatService';
import { playMessageSentSound, playMessageReceivedSound } from '../utils/audio';
import { UserAvatar } from './UserAvatar';

interface ChatRoomViewProps {
  chatId: string;
  currentUser: UserProfile;
  chats: ChatConversation[];
  onBack?: () => void;
  isEmbedded?: boolean;
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '🔒'];

export const ChatRoomView: React.FC<ChatRoomViewProps> = ({
  chatId,
  currentUser,
  chats,
  onBack,
  isEmbedded = false
}) => {
  const { theme, soundEnabled } = useTheme();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesCount = useRef(0);

  // Find active chat metadata
  const activeChat = chats.find((c) => c.id === chatId);
  const friendUid = activeChat?.participantIds.find((id) => id !== currentUser.uid) || '';
  const friend = activeChat?.participants[friendUid] || {
    name: 'Connected Friend',
    chatCode: '??????'
  };

  // Subscribe to real-time messages
  useEffect(() => {
    if (!chatId) return;

    markChatAsRead(chatId, currentUser.uid);

    const unsubscribe = subscribeToChatMessages(
      chatId,
      (newMessages) => {
        if (
          newMessages.length > prevMessagesCount.current &&
          prevMessagesCount.current > 0
        ) {
          const lastMsg = newMessages[newMessages.length - 1];
          if (lastMsg.senderId !== currentUser.uid && soundEnabled) {
            playMessageReceivedSound();
          }
        }
        prevMessagesCount.current = newMessages.length;
        setMessages(newMessages);
      },
      (err) => {
        console.error(err);
        showToast('Error loading real-time messages', 'error');
      }
    );

    return () => {
      unsubscribe();
    };
  }, [chatId, currentUser.uid, soundEnabled, showToast]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Send message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    setInputText('');
    setIsSending(true);

    try {
      if (soundEnabled) playMessageSentSound();
      await sendMessage(chatId, currentUser, friendUid, trimmed);
    } catch (err) {
      console.error(err);
      showToast('Failed to send message.', 'error');
      setInputText(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  // Handle enter key in input
  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Copy message text
  const handleCopyMessage = (msg: ChatMessage) => {
    navigator.clipboard.writeText(msg.text);
    setCopiedMsgId(msg.id);
    showToast('Message copied to clipboard', 'info');
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Format message time
  const formatMsgTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div
      className={`flex flex-col h-full bg-white dark:bg-[#121622] ${
        isEmbedded ? 'rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden' : 'h-[calc(100vh-4rem)] md:h-screen'
      }`}
    >
      {/* Chat Room Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#151b28]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          {/* Show back button only if onBack is provided (on mobile view) */}
          {onBack && (
            <button
              onClick={onBack}
              className="p-1.5 -ml-1 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition-colors cursor-pointer"
              aria-label="Back to conversations"
            >
              <ArrowLeft size={20} />
            </button>
          )}

          <UserAvatar
            name={friend.name}
            photoURL={friend.photoURL}
            avatarColor={friend.avatarColor}
            avatarIcon={friend.avatarIcon}
            size="md"
            showOnlineStatus
          />

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate">
                {friend.name}
              </h3>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                {formatChatCodeDisplay(friend.chatCode)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
              <ShieldCheck size={12} className="text-emerald-500" />
              <span>Real-Time Encrypted</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
            <Lock size={11} />
            Encrypted
          </span>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/60 dark:bg-[#0b0f19]/70">
        {/* Encryption notice */}
        <div className="flex justify-center my-1">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 text-[11px]">
            <Lock size={11} className="text-indigo-600 dark:text-indigo-400" />
            <span>Messages are encrypted & synced in real-time.</span>
          </div>
        </div>

        {messages.length === 0 ? (
          <div className="text-center py-16 sm:py-24">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <Smile size={28} />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Beginning of your conversation with {friend.name}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Send a secure message to say hello!
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.senderId === currentUser.uid;

            return (
              <div
                key={msg.id}
                className={`group flex flex-col ${isMe ? 'items-end' : 'items-start'} relative`}
              >
                <div
                  className={`flex items-end gap-2 max-w-[85%] sm:max-w-[75%] ${
                    isMe ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Small Sender Avatar on Laptop/Desktop */}
                  {!isMe && (
                    <div className="hidden sm:block shrink-0 mb-1">
                      <UserAvatar
                        name={friend.name}
                        photoURL={friend.photoURL}
                        avatarColor={friend.avatarColor}
                        avatarIcon={friend.avatarIcon}
                        size="sm"
                      />
                    </div>
                  )}

                  {/* Bubble */}
                  <div
                    className={`relative px-4 py-2.5 rounded-2xl text-sm leading-relaxed shadow-2xs transition-all ${
                      isMe
                        ? `${theme.chatBubbleSender} rounded-br-xs`
                        : `${theme.chatBubbleReceiver} rounded-bl-xs`
                    }`}
                  >
                    <p className="whitespace-pre-wrap break-words">{msg.text}</p>

                    <div
                      className={`flex items-center justify-end gap-1.5 mt-1 text-[10px] ${
                        isMe ? 'text-white/80' : 'text-slate-400 dark:text-slate-400'
                      }`}
                    >
                      <span>{formatMsgTime(msg.timestamp)}</span>
                      {isMe && <Check size={12} className="text-white/80" />}
                    </div>
                  </div>

                  {/* Actions hover */}
                  <div
                    className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 self-center ${
                      isMe ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => handleCopyMessage(msg)}
                      className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 shadow-2xs border border-slate-200 dark:border-slate-700 cursor-pointer"
                      title="Copy text"
                    >
                      {copiedMsgId === msg.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    </button>

                    <button
                      type="button"
                      onClick={() => toggleMessageReaction(chatId, msg.id, '❤️', currentUser.uid)}
                      className="p-1 rounded-md text-slate-400 hover:text-rose-500 bg-white dark:bg-slate-800 shadow-2xs border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                      title="React with heart"
                    >
                      ❤️
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleMessageReaction(chatId, msg.id, '👍', currentUser.uid)}
                      className="p-1 rounded-md text-slate-400 hover:text-indigo-500 bg-white dark:bg-slate-800 shadow-2xs border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                      title="React with thumbs up"
                    >
                      👍
                    </button>
                  </div>
                </div>

                {/* Display reactions */}
                {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                  <div className={`flex flex-wrap gap-1 mt-1 ${isMe ? 'justify-end' : 'justify-start'}`}>
                    {Object.entries(msg.reactions).map(([emoji, ids]) => {
                      const userIds = ids as string[];
                      if (!Array.isArray(userIds) || userIds.length === 0) return null;
                      const hasReacted = userIds.includes(currentUser.uid);

                      return (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => toggleMessageReaction(chatId, msg.id, emoji, currentUser.uid)}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border cursor-pointer transition-all ${
                            hasReacted
                              ? 'bg-indigo-50 dark:bg-indigo-950/60 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
                              : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="text-[10px] font-bold">{userIds.length}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Message Input */}
      <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b28] relative shrink-0">
        {/* Quick Emoji Bar */}
        {showEmojiPicker && (
          <div className="absolute bottom-full left-4 mb-2 p-2 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
            {QUICK_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={() => {
                  setInputText((prev) => prev + emoji);
                  setShowEmojiPicker(false);
                }}
                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl text-lg transition-transform active:scale-125 cursor-pointer"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSendMessage} className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
            aria-label="Add emoji"
          >
            <Smile size={20} />
          </button>

          <input
            id="chat-message-input"
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a secure message... (Press Enter to send)"
            className={`flex-1 py-2.5 px-4 rounded-xl border ${theme.inputBg} ${theme.inputBorder} text-sm focus:outline-hidden transition-all`}
          />

          <button
            id="chat-send-btn"
            type="submit"
            disabled={!inputText.trim() || isSending}
            className="inline-flex items-center justify-center p-2.5 sm:px-5 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-xs active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 cursor-pointer"
          >
            <Send size={17} />
            <span className="hidden sm:inline ml-2">Send</span>
          </button>
        </form>
      </div>
    </div>
  );
};
