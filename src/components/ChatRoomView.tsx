import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowLeft,
  Send,
  ShieldCheck,
  Smile,
  Copy,
  Check,
  CheckCheck,
  Lock,
  Image as ImageIcon,
  Mic,
  Trash2,
  MoreVertical,
  X,
  Radio,
  Download,
  AlertTriangle,
  RotateCcw,
  CheckSquare,
  Eye,
  EyeOff
} from 'lucide-react';
import { UserProfile, ChatConversation, ChatMessage } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './Toast';
import {
  subscribeToChatMessages,
  sendMessage,
  sendImageMessage,
  sendVoiceMessage,
  deleteMessagesForEveryone,
  deleteMessagesForMe,
  deleteMessage,
  clearChatMessages,
  deleteConversation,
  markChatAsRead,
  toggleMessageReaction,
  formatChatCodeDisplay,
  markViewOnceAsViewed
} from '../services/chatService';
import { playMessageSentSound, playMessageReceivedSound } from '../utils/audio';
import { UserAvatar, GroupAvatar, VerifiedBadge } from './UserAvatar';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { ImageLightboxModal } from './ImageLightboxModal';
import { compressImageFile, startVoiceRecording, VoiceRecorderSession } from '../utils/media';

interface ChatRoomViewProps {
  chatId: string;
  currentUser: UserProfile;
  chats: ChatConversation[];
  onBack?: () => void;
  isEmbedded?: boolean;
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '🔒', '🙌', '💯'];

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
  const [showMenuDropdown, setShowMenuDropdown] = useState(false);

  // Multi-select & Long Press (WhatsApp style)
  const [selectedMessageIds, setSelectedMessageIds] = useState<Set<string>>(new Set());
  const longPressTimerRef = useRef<number | null>(null);
  const isLongPressActiveRef = useRef(false);
  const touchStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Photo sending, Lightbox & 1-Time Photo state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [isViewOnce, setIsViewOnce] = useState(false);
  const [viewOnceModal, setViewOnceModal] = useState<{
    messageId: string;
    url: string;
    senderName?: string;
    timestamp?: number;
  } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<{
    url: string;
    senderName?: string;
    timestamp?: number;
    caption?: string;
  } | null>(null);

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const voiceSessionRef = useRef<VoiceRecorderSession | null>(null);
  const recordingTimerRef = useRef<number | null>(null);

  // Delete modals state
  const [confirmClearModal, setConfirmClearModal] = useState(false);
  const [clearChatDeleteMyForEveryone, setClearChatDeleteMyForEveryone] = useState(true);
  const [confirmDeleteChatModal, setConfirmDeleteChatModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTargetMessages, setDeleteTargetMessages] = useState<ChatMessage[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesCount = useRef(0);

  // Find active chat metadata
  const activeChat = chats.find((c) => c.id === chatId);
  const isGroup = Boolean(activeChat?.isGroup);
  const groupName = activeChat?.groupName || 'Group';
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
      // Cleanup voice recorder if recording was ongoing
      if (voiceSessionRef.current) {
        voiceSessionRef.current.cancel();
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
    };
  }, [chatId, currentUser.uid, soundEnabled, showToast]);

  // Auto scroll to bottom on message change (only when not in selection mode)
  useEffect(() => {
    if (selectedMessageIds.size === 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isRecording, previewImage, selectedMessageIds.size]);

  // Send plain text message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    setInputText('');
    setIsSending(true);

    try {
      if (soundEnabled) playMessageSentSound();
      await sendMessage(chatId, currentUser, friendUid, {
        type: 'text',
        text: trimmed
      });
    } catch (err) {
      console.error(err);
      showToast('Failed to send message.', 'error');
      setInputText(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  // Handle image selection -> Direct compression & Preview
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    try {
      const compressed = await compressImageFile(file, 1280, 1280, 0.85);
      setPreviewImage(compressed);
      setImageCaption('');
      setIsViewOnce(false);
    } catch (err) {
      console.error(err);
      showToast('Could not load image. Please select a valid photo.', 'error');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Send photo message (supports 1-Time Photo / View Once)
  const handleConfirmSendImage = async () => {
    if (!previewImage || isSending) return;
    setIsSending(true);

    try {
      if (soundEnabled) playMessageSentSound();
      await sendImageMessage(
        chatId,
        currentUser,
        friendUid,
        previewImage,
        imageCaption.trim(),
        isViewOnce
      );
      const viewOnceFlag = isViewOnce;
      setPreviewImage(null);
      setImageCaption('');
      setIsViewOnce(false);
      showToast(viewOnceFlag ? '1-Time Photo sent!' : 'Photo sent!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to send photo.', 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Voice recording: Start
  const handleStartVoiceRecord = async () => {
    try {
      const session = await startVoiceRecording();
      voiceSessionRef.current = session;
      setIsRecording(true);
      setRecordingDuration(0);

      const startTime = Date.now();
      recordingTimerRef.current = window.setInterval(() => {
        setRecordingDuration(Math.round((Date.now() - startTime) / 1000));
      }, 500);
    } catch (err) {
      console.error('Microphone error:', err);
      showToast('Microphone access required for voice message.', 'error');
    }
  };

  // Voice recording: Cancel
  const handleCancelVoiceRecord = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    if (voiceSessionRef.current) {
      voiceSessionRef.current.cancel();
      voiceSessionRef.current = null;
    }
    setIsRecording(false);
    setRecordingDuration(0);
    showToast('Voice recording discarded', 'info');
  };

  // Voice recording: Stop & Send
  const handleSendVoiceRecord = async () => {
    if (!voiceSessionRef.current) return;
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsSending(true);
    setIsRecording(false);

    try {
      const { audioDataUrl, duration } = await voiceSessionRef.current.stop();
      voiceSessionRef.current = null;

      if (duration < 1) {
        showToast('Voice note too short.', 'info');
        return;
      }

      if (soundEnabled) playMessageSentSound();
      await sendVoiceMessage(chatId, currentUser, friendUid, audioDataUrl, duration);
      showToast('Voice message sent!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to send voice message.', 'error');
    } finally {
      setIsSending(false);
      setRecordingDuration(0);
    }
  };

  // --- WHATSAPP-STYLE HOLD & SELECT LOGIC ---
  const handleMessageTouchStart = (msg: ChatMessage, e?: React.TouchEvent | React.MouseEvent) => {
    isLongPressActiveRef.current = false;
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    if (e && 'touches' in e && e.touches.length > 0) {
      touchStartPosRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    } else {
      touchStartPosRef.current = null;
    }

    // Increased hold timer to 850ms so fast taps/scrolls never trigger accidental deletion/selection
    longPressTimerRef.current = window.setTimeout(() => {
      isLongPressActiveRef.current = true;
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        try {
          navigator.vibrate(50);
        } catch {
          // ignore
        }
      }
      setSelectedMessageIds((prev) => {
        const next = new Set(prev);
        next.add(msg.id);
        return next;
      });
    }, 850);
  };

  const handleMessageTouchMove = (e: React.TouchEvent) => {
    if (!touchStartPosRef.current || !longPressTimerRef.current) return;
    const touch = e.touches[0];
    const dx = Math.abs(touch.clientX - touchStartPosRef.current.x);
    const dy = Math.abs(touch.clientY - touchStartPosRef.current.y);

    // If moved more than 8 pixels, user is scrolling: cancel long press immediately
    if (dx > 8 || dy > 8) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const handleMessageTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    touchStartPosRef.current = null;
  };

  const handleMessageClick = (msg: ChatMessage) => {
    // If long press was just triggered, skip click
    if (isLongPressActiveRef.current) {
      isLongPressActiveRef.current = false;
      return;
    }

    // If we are currently in selection mode, clicking a message toggles its selection
    if (selectedMessageIds.size > 0) {
      setSelectedMessageIds((prev) => {
        const next = new Set(prev);
        if (next.has(msg.id)) {
          next.delete(msg.id);
        } else {
          next.add(msg.id);
        }
        return next;
      });
    }
  };

  const handleClearSelection = () => {
    setSelectedMessageIds(new Set());
  };

  // Copy selected messages
  const handleCopySelected = () => {
    const selectedMsgs = messages.filter(
      (m) => selectedMessageIds.has(m.id) && m.text && !m.isDeleted
    );
    if (selectedMsgs.length === 0) {
      showToast('No text to copy in selected message(s)', 'info');
      return;
    }
    const combined = selectedMsgs.map((m) => m.text).join('\n');
    navigator.clipboard.writeText(combined);
    showToast(
      selectedMsgs.length > 1
        ? `${selectedMsgs.length} messages copied to clipboard`
        : 'Message copied to clipboard',
      'info'
    );
    setSelectedMessageIds(new Set());
  };

  // Open delete modal for selected messages
  const handleOpenDeleteSelected = () => {
    const targets = messages.filter((m) => selectedMessageIds.has(m.id));
    if (targets.length === 0) return;
    setDeleteTargetMessages(targets);
    setShowDeleteModal(true);
  };

  // Open delete modal for a single hovered message
  const handleOpenDeleteSingle = (msg: ChatMessage) => {
    setDeleteTargetMessages([msg]);
    setShowDeleteModal(true);
  };

  // Check if all messages in delete targets were sent by currentUser
  const allSelectedFromMe =
    deleteTargetMessages.length > 0 &&
    deleteTargetMessages.every((m) => m.senderId === currentUser.uid);

  // Execute WhatsApp Delete Action
  const handleExecuteDelete = async (action: 'everyone' | 'forMe') => {
    if (deleteTargetMessages.length === 0) return;
    const ids = deleteTargetMessages.map((m) => m.id);

    try {
      if (action === 'everyone') {
        // Can only delete for everyone if sent by user
        if (!allSelectedFromMe) {
          showToast('You can only delete your own messages for everyone.', 'error');
          return;
        }
        await deleteMessagesForEveryone(chatId, ids);
        showToast(
          ids.length > 1
            ? `${ids.length} messages deleted for everyone`
            : 'Message deleted for everyone',
          'success'
        );
      } else {
        await deleteMessagesForMe(chatId, ids, currentUser.uid);
        showToast(
          ids.length > 1
            ? `${ids.length} messages deleted for you`
            : 'Message deleted for you',
          'success'
        );
      }
      setSelectedMessageIds(new Set());
    } catch (err) {
      console.error(err);
      showToast('Failed to delete message(s)', 'error');
    } finally {
      setShowDeleteModal(false);
      setDeleteTargetMessages([]);
    }
  };

  // Clear Chat History handler (WhatsApp style)
  const handleConfirmClearChat = async () => {
    try {
      await clearChatMessages(chatId, currentUser.uid, clearChatDeleteMyForEveryone);
      showToast('Chat history cleared', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to clear chat', 'error');
    } finally {
      setConfirmClearModal(false);
      setShowMenuDropdown(false);
      setSelectedMessageIds(new Set());
    }
  };

  // Delete Conversation handler
  const handleConfirmDeleteConversation = async () => {
    try {
      await deleteConversation(chatId);
      showToast('Conversation deleted', 'success');
      setConfirmDeleteChatModal(false);
      setShowMenuDropdown(false);
      if (onBack) onBack();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete conversation', 'error');
    }
  };

  // Copy single message text
  const handleCopyMessage = (msg: ChatMessage) => {
    if (!msg.text) return;
    navigator.clipboard.writeText(msg.text);
    setCopiedMsgId(msg.id);
    showToast('Message copied to clipboard', 'info');
    setTimeout(() => setCopiedMsgId(null), 2000);
  };

  // Format message time
  const formatMsgTime = (ts: number) => {
    return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Filter messages to hide any that the current user deleted "For Me"
  const visibleMessages = messages.filter(
    (m) => !m.deletedFor || !m.deletedFor.includes(currentUser.uid)
  );

  return (
    <div
      className={`flex flex-col bg-white dark:bg-[#121622] ${
        isEmbedded
          ? 'h-full rounded-2xl border border-slate-200/90 dark:border-slate-800 overflow-hidden'
          : 'fixed inset-0 z-50 md:relative md:inset-auto md:z-auto h-[100dvh] w-full overflow-hidden'
      }`}
    >
      {/* Hidden File Input for Photos */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImageFileChange}
        accept="image/*"
        className="hidden"
      />

      {/* Lightbox Modal */}
      {lightboxImage && (
        <ImageLightboxModal
          imageUrl={lightboxImage.url}
          senderName={lightboxImage.senderName}
          timestamp={lightboxImage.timestamp}
          caption={lightboxImage.caption}
          onClose={() => setLightboxImage(null)}
        />
      )}

      {/* 1-Time Photo (View Once) Modal */}
      {viewOnceModal && (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col animate-in fade-in duration-200 select-none">
          {/* Top Bar */}
          <div className="flex items-center justify-between p-3.5 sm:p-4 bg-black/90 backdrop-blur-md text-white border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewOnceModal(null)}
                className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <ArrowLeft size={20} />
              </button>
              <div>
                <h4 className="text-sm font-bold flex items-center gap-2">
                  <span>{viewOnceModal.senderName || '1-Time Photo'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500 text-white font-black font-mono tracking-wider">
                    1-TIME VIEW
                  </span>
                </h4>
                <p className="text-[10px] text-white/60">This photo will close and expire after viewing</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setViewOnceModal(null)}
              className="px-4 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-bold transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>

          {/* Image View */}
          <div className="flex-1 flex items-center justify-center p-2 sm:p-4 overflow-hidden relative">
            <img
              src={viewOnceModal.url}
              alt="1-Time View"
              className="max-h-[82vh] max-w-full object-contain select-none pointer-events-none rounded-lg"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Bottom Banner */}
          <div className="p-3 text-center bg-black/90 border-t border-white/10 text-white/70 text-xs font-medium shrink-0 flex items-center justify-center gap-2">
            <Lock size={13} className="text-emerald-400" />
            <span>1-Time Photo • Closes permanently upon exit</span>
          </div>
        </div>
      )}

      {/* Image Preview Modal before sending (with WhatsApp style 1-Time toggle) */}
      {previewImage && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181f2e] border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ImageIcon size={18} className="text-indigo-600 dark:text-indigo-400" />
                <span>Send Photo</span>
              </h3>
              <button
                type="button"
                onClick={() => {
                  setPreviewImage(null);
                  setIsViewOnce(false);
                }}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center relative">
              <img
                src={previewImage}
                alt="Selected preview"
                className="max-h-[48vh] w-auto object-contain rounded-lg"
              />
              {isViewOnce && (
                <div className="absolute top-3 right-3 px-3 py-1 rounded-full bg-emerald-600/90 text-white text-xs font-extrabold backdrop-blur-sm shadow-md flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-white text-emerald-700 flex items-center justify-center font-mono text-[11px]">1</span>
                  <span>1-Time Photo</span>
                </div>
              )}
            </div>

            {/* Input & WhatsApp style View Once Toggle */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsViewOnce(!isViewOnce)}
                className={`shrink-0 w-10 h-10 rounded-xl border flex flex-col items-center justify-center transition-all cursor-pointer ${
                  isViewOnce
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-md shadow-emerald-500/30 scale-105 ring-2 ring-emerald-400/40'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-emerald-500 hover:text-emerald-600'
                }`}
                title={isViewOnce ? '1-Time Photo enabled (Can be viewed only once)' : 'Set as 1-Time Photo (View Once)'}
              >
                <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center">
                  <span className="font-mono text-[10px] font-black">1</span>
                </div>
              </button>

              <input
                type="text"
                value={imageCaption}
                onChange={(e) => setImageCaption(e.target.value)}
                placeholder={isViewOnce ? '1-Time Photo (View Once)...' : 'Add an optional caption...'}
                className={`flex-1 py-2.5 px-3.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} text-sm focus:outline-hidden`}
              />
            </div>

            {isViewOnce && (
              <p className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 px-1">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>1-Time photo enabled: The recipient can view this photo only 1 time before it disappears.</span>
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => {
                  setPreviewImage(null);
                  setIsViewOnce(false);
                }}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={handleConfirmSendImage}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                <Send size={14} />
                <span>{isSending ? 'Sending...' : isViewOnce ? 'Send 1-Time Photo' : 'Send Photo'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Message Confirmation Modal (WhatsApp Style) */}
      {showDeleteModal && deleteTargetMessages.length > 0 && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181f2e] border border-slate-200 dark:border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">
                  {deleteTargetMessages.length > 1
                    ? `Delete ${deleteTargetMessages.length} Messages?`
                    : 'Delete Message?'}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {allSelectedFromMe
                    ? 'You can delete for everyone or just for yourself.'
                    : 'Messages from others can only be deleted for you.'}
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-1">
              {allSelectedFromMe && (
                <button
                  type="button"
                  onClick={() => handleExecuteDelete('everyone')}
                  className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 dark:hover:bg-rose-950/60 text-left transition-colors cursor-pointer flex items-center justify-between"
                >
                  <span>Delete for Everyone</span>
                  <span className="text-[10px] text-rose-500/80">Deleted for both</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleExecuteDelete('forMe')}
                className="w-full py-2.5 px-4 rounded-xl text-xs font-bold text-slate-800 dark:text-slate-100 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-left transition-colors cursor-pointer flex items-center justify-between"
              >
                <span>Delete for Me</span>
                <span className="text-[10px] text-slate-400">Only from your screen</span>
              </button>
            </div>

            <div className="pt-2 text-right">
              <button
                type="button"
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeleteTargetMessages([]);
                }}
                className="px-4 py-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Clear Chat Confirmation Modal (WhatsApp Style) */}
      {confirmClearModal && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181f2e] border border-slate-200 dark:border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600 flex items-center justify-center shrink-0">
                <RotateCcw size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Clear Chat?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Are you sure you want to clear messages in this chat?
                </p>
              </div>
            </div>

            <label className="flex items-start gap-2.5 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/80 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={clearChatDeleteMyForEveryone}
                onChange={(e) => setClearChatDeleteMyForEveryone(e.target.checked)}
                className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
              />
              <span className="text-xs text-slate-700 dark:text-slate-300">
                Also delete messages I sent for everyone (recipient's messages will remain for them).
              </span>
            </label>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmClearModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmClearChat}
                className="px-4 py-2 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Entire Conversation Confirmation Modal */}
      {confirmDeleteChatModal && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181f2e] border border-slate-200 dark:border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Delete Entire Chat?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This will completely delete this conversation and all its messages.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteChatModal(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteConversation}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Delete Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Chat Room Header / Selection Bar */}
      {selectedMessageIds.size > 0 ? (
        <div className="flex items-center justify-between px-4 py-3 border-b border-indigo-200 dark:border-indigo-900/60 bg-indigo-50/95 dark:bg-indigo-950/80 backdrop-blur-md sticky top-0 z-20 shrink-0 animate-in fade-in duration-150">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClearSelection}
              className="p-1.5 -ml-1 rounded-xl text-slate-600 dark:text-slate-300 hover:bg-white/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Close selection"
            >
              <X size={20} />
            </button>
            <span className="text-sm sm:text-base font-bold text-indigo-950 dark:text-indigo-100 flex items-center gap-1.5">
              <CheckSquare size={17} className="text-indigo-600 dark:text-indigo-400" />
              <span>{selectedMessageIds.size} Selected</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleCopySelected}
              className="p-2 rounded-xl text-slate-700 dark:text-slate-200 hover:bg-white/80 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              title="Copy selected text"
            >
              <Copy size={18} />
            </button>
            <button
              type="button"
              onClick={handleOpenDeleteSelected}
              className="p-2 rounded-xl text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-950/60 transition-colors cursor-pointer"
              title="Delete selected messages"
            >
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-[#151b28]/95 backdrop-blur-md sticky top-0 z-20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            {/* Back button (on mobile view) */}
            {onBack && (
              <button
                onClick={onBack}
                className="p-1.5 -ml-1 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 dark:hover:text-white transition-colors cursor-pointer"
                aria-label="Back to conversations"
              >
                <ArrowLeft size={20} />
              </button>
            )}

            {isGroup ? (
              <GroupAvatar size="md" />
            ) : (
              <UserAvatar
                name={friend.name}
                photoURL={friend.photoURL}
                avatarColor={friend.avatarColor}
                avatarIcon={friend.avatarIcon}
                isVerified={friend.isVerified}
                size="md"
                showOnlineStatus
              />
            )}

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white truncate flex items-center gap-1">
                  <span>{isGroup ? groupName : friend.name}</span>
                  {!isGroup && friend.isVerified && <VerifiedBadge size={16} />}
                </h3>
                {!isGroup && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">
                    {formatChatCodeDisplay(friend.chatCode)}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1 text-[11px] text-slate-500 dark:text-slate-400">
                <ShieldCheck size={12} className="text-emerald-500" />
                <span>{isGroup ? `${activeChat?.participantIds?.length || 0} participants` : 'Real-Time Encrypted'}</span>
              </div>
            </div>
          </div>

          {/* Right Header Controls */}
          <div className="flex items-center gap-2 relative">
            <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-lg">
              <Lock size={11} />
              Encrypted
            </span>

            {/* More options menu button */}
            <button
              type="button"
              onClick={() => setShowMenuDropdown(!showMenuDropdown)}
              className="p-2 rounded-xl text-slate-500 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
              aria-label="Chat options"
            >
              <MoreVertical size={18} />
            </button>

            {/* Dropdown Menu */}
            {showMenuDropdown && (
              <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 p-1.5 z-30 animate-in fade-in zoom-in-95 duration-150">
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowMenuDropdown(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-colors cursor-pointer"
                >
                  <ImageIcon size={14} className="text-indigo-500" />
                  <span>Send Photo</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMenuDropdown(false);
                    setConfirmClearModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/40 rounded-xl transition-colors cursor-pointer"
                >
                  <RotateCcw size={14} />
                  <span>Clear Chat</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowMenuDropdown(false);
                    setConfirmDeleteChatModal(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Delete Entire Chat</span>
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/60 dark:bg-[#0b0f19]/70">
        {/* Encryption notice */}
        <div className="flex justify-center my-1">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800/80 border border-slate-200/80 dark:border-slate-700/80 text-slate-500 dark:text-slate-400 text-[11px]">
            <Lock size={11} className="text-indigo-600 dark:text-indigo-400" />
            <span>Messages, photos & audio are encrypted and synced in real-time.</span>
          </div>
        </div>

        {visibleMessages.length === 0 ? (
          <div className="text-center py-16 sm:py-24">
            <div className="w-14 h-14 rounded-2xl bg-indigo-100 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mx-auto mb-3">
              <Smile size={28} />
            </div>
            <p className="text-sm font-bold text-slate-800 dark:text-slate-200">
              Beginning of your conversation with {friend.name}
            </p>
            <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">
              Send a text, photo, or voice message to say hello!
            </p>
          </div>
        ) : (
          visibleMessages.map((msg) => {
            const isMe = msg.senderId === currentUser.uid;
            const isDeleted = msg.isDeleted;
            const isSelected = selectedMessageIds.has(msg.id);

            const senderUser = isGroup ? activeChat?.participants[msg.senderId] : friend;
            const senderDisplayName = msg.senderName || senderUser?.name || 'User';

            return (
              <div
                key={msg.id}
                onTouchStart={(e) => handleMessageTouchStart(msg, e)}
                onTouchMove={handleMessageTouchMove}
                onTouchEnd={handleMessageTouchEnd}
                onTouchCancel={handleMessageTouchEnd}
                onMouseDown={(e) => handleMessageTouchStart(msg, e)}
                onMouseUp={handleMessageTouchEnd}
                onMouseLeave={handleMessageTouchEnd}
                onClick={() => handleMessageClick(msg)}
                className={`group flex flex-col ${isMe ? 'items-end' : 'items-start'} relative transition-colors duration-150 rounded-2xl p-1 select-none ${
                  isSelected
                    ? 'bg-indigo-100/70 dark:bg-indigo-950/50 ring-2 ring-indigo-500/50'
                    : ''
                }`}
              >
                <div
                  className={`flex items-end gap-2 max-w-[88%] sm:max-w-[75%] ${
                    isMe ? 'flex-row-reverse' : 'flex-row'
                  }`}
                >
                  {/* Small Sender Avatar on Laptop/Desktop */}
                  {!isMe && (
                    <div className="hidden sm:block shrink-0 mb-1">
                      <UserAvatar
                        name={senderDisplayName}
                        photoURL={msg.senderPhotoURL || senderUser?.photoURL}
                        avatarColor={senderUser?.avatarColor}
                        avatarIcon={senderUser?.avatarIcon}
                        isVerified={senderUser?.isVerified || msg.senderIsVerified}
                        size="sm"
                      />
                    </div>
                  )}

                  {/* Message Bubble Container */}
                  <div
                    className={`relative rounded-2xl text-sm leading-relaxed shadow-2xs transition-all overflow-hidden ${
                      isDeleted
                        ? 'bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-slate-400 italic'
                        : isMe
                        ? `${theme.chatBubbleSender} rounded-br-xs px-3 py-2.5`
                        : `${theme.chatBubbleReceiver} rounded-bl-xs px-3 py-2.5`
                    }`}
                  >
                    {/* Sender name for group chats */}
                    {isGroup && !isMe && !isDeleted && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-600 dark:text-indigo-400 mb-1">
                        <span>{senderDisplayName}</span>
                        {(senderUser?.isVerified || msg.senderIsVerified) && <VerifiedBadge size={12} />}
                      </span>
                    )}

                    {/* If Deleted */}
                    {isDeleted ? (
                      <p className="text-xs text-slate-400 dark:text-slate-500 flex items-center gap-1.5">
                        <Trash2 size={13} />
                        <span>This message was deleted</span>
                      </p>
                    ) : (
                      <>
                        {/* 1. PHOTO MESSAGE */}
                        {msg.type === 'image' && msg.mediaUrl && (
                          <>
                            {/* WhatsApp Style 1-Time Photo (View Once) */}
                            {msg.isViewOnce ? (
                              <div className="py-0.5">
                                {!isMe ? (
                                  /* Receiver View */
                                  msg.viewedBy && msg.viewedBy.includes(currentUser.uid) ? (
                                    /* Already Opened (Expired) */
                                    <div className="flex items-center gap-2.5 py-1 px-1.5 text-slate-400 dark:text-slate-400 select-none">
                                      <div className="w-7 h-7 rounded-full border border-slate-300 dark:border-slate-600 flex items-center justify-center font-mono text-xs font-bold text-slate-400">
                                        ✓
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold text-slate-600 dark:text-slate-300">Opened</span>
                                        <span className="text-[10px] text-slate-400 dark:text-slate-500">1-Time photo expired</span>
                                      </div>
                                    </div>
                                  ) : (
                                    /* Not Opened Yet: Clickable to View 1 Time */
                                    <div className="space-y-1">
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          if (selectedMessageIds.size > 0) return;
                                          e.stopPropagation();
                                          if (msg.mediaUrl) {
                                            setViewOnceModal({
                                              messageId: msg.id,
                                              url: msg.mediaUrl,
                                              senderName: senderDisplayName,
                                              timestamp: msg.timestamp
                                            });
                                            markViewOnceAsViewed(chatId, msg.id, currentUser.uid);
                                          }
                                        }}
                                        className="flex items-center gap-3 py-2 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-300 dark:border-emerald-700/80 hover:bg-emerald-100 dark:hover:bg-emerald-900/60 transition-all cursor-pointer select-none group/viewonce shadow-xs text-left"
                                      >
                                        <div className="w-8 h-8 rounded-full bg-emerald-600 text-white flex items-center justify-center font-mono font-black text-sm shadow-sm group-hover/viewonce:scale-105 transition-transform">
                                          1
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-xs font-black text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                            <span>Photo</span>
                                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-emerald-200 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-200 font-bold uppercase tracking-wider">
                                              1-Time
                                            </span>
                                          </span>
                                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-semibold">
                                            Tap to view (1 time only)
                                          </span>
                                        </div>
                                      </button>
                                      {msg.text && (
                                        <p className="whitespace-pre-wrap break-words px-1 text-xs text-slate-700 dark:text-slate-300">
                                          {msg.text}
                                        </p>
                                      )}
                                    </div>
                                  )
                                ) : (
                                  /* Sender View */
                                  msg.viewedBy && msg.viewedBy.some((id) => id !== currentUser.uid) ? (
                                    /* Opened by Recipient */
                                    <div className="flex items-center gap-2.5 py-1 px-1.5 text-white/80 select-none">
                                      <div className="w-7 h-7 rounded-full border border-white/50 flex items-center justify-center font-mono text-xs font-bold text-white">
                                        ✓
                                      </div>
                                      <div className="flex flex-col">
                                        <span className="text-xs font-bold text-white">Opened</span>
                                        <span className="text-[10px] text-white/70">1-Time photo viewed by recipient</span>
                                      </div>
                                    </div>
                                  ) : (
                                    /* Waiting for Recipient to Open */
                                    <div className="space-y-1">
                                      <div className="flex items-center gap-2.5 py-1 px-1.5 text-white select-none">
                                        <div className="w-7 h-7 rounded-full bg-white/20 border border-white/60 flex items-center justify-center font-mono text-xs font-black shadow-xs">
                                          1
                                        </div>
                                        <div className="flex flex-col">
                                          <span className="text-xs font-bold flex items-center gap-1.5">
                                            <span>Photo</span>
                                            <span className="text-[9px] px-1.5 py-0.2 rounded-full bg-white/20 text-white font-mono uppercase">
                                              1-Time
                                            </span>
                                          </span>
                                          <span className="text-[10px] text-white/80">1-time photo sent</span>
                                        </div>
                                      </div>
                                      {msg.text && (
                                        <p className="whitespace-pre-wrap break-words px-1 text-xs text-white/90">
                                          {msg.text}
                                        </p>
                                      )}
                                    </div>
                                  )
                                )}
                              </div>
                            ) : (
                              /* Standard Photo Message with Lightbox */
                              <div className="space-y-1.5">
                                <div
                                  onClick={(e) => {
                                    if (selectedMessageIds.size > 0) return;
                                    e.stopPropagation();
                                    setLightboxImage({
                                      url: msg.mediaUrl!,
                                      senderName: msg.senderName,
                                      timestamp: msg.timestamp,
                                      caption: msg.text
                                    });
                                  }}
                                  className="cursor-pointer overflow-hidden rounded-xl max-w-sm max-h-72 bg-black/5 hover:opacity-95 transition-opacity"
                                >
                                  <img
                                    src={msg.mediaUrl}
                                    alt="Shared photo"
                                    className="w-full h-auto object-cover max-h-72 rounded-xl"
                                    referrerPolicy="no-referrer"
                                  />
                                </div>
                                {msg.text && (
                                  <p className="whitespace-pre-wrap break-words px-1 text-sm font-medium">
                                    {msg.text}
                                  </p>
                                )}
                              </div>
                            )}
                          </>
                        )}

                        {/* 2. AUDIO / VOICE MESSAGE */}
                        {msg.type === 'audio' && msg.mediaUrl && (
                          <VoiceMessagePlayer
                            audioUrl={msg.mediaUrl}
                            duration={msg.mediaDuration}
                            isSender={isMe}
                          />
                        )}

                        {/* 3. PLAIN TEXT MESSAGE */}
                        {(!msg.type || msg.type === 'text') && (
                          <p className="whitespace-pre-wrap break-words px-1">{msg.text}</p>
                        )}

                        {/* Time & Read Checkmark (1 tick for sent, 2 ticks for seen) */}
                        <div
                          className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                            isMe ? 'text-white/80' : 'text-slate-400 dark:text-slate-400'
                          }`}
                        >
                          <span>{formatMsgTime(msg.timestamp)}</span>
                          {isMe && (
                            <span
                              className="inline-flex items-center ml-0.5"
                              title={
                                msg.readBy && msg.readBy.some((id) => id !== currentUser.uid)
                                  ? 'Seen (2 ticks)'
                                  : 'Sent (1 tick)'
                              }
                            >
                              {msg.readBy && msg.readBy.some((id) => id !== currentUser.uid) ? (
                                <CheckCheck size={14} className="text-sky-300 dark:text-sky-300 stroke-[2.5]" />
                              ) : (
                                <Check size={13} className="text-white/70 stroke-[2]" />
                              )}
                            </span>
                          )}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Actions hover: Copy, React, Delete */}
                  {!isDeleted && selectedMessageIds.size === 0 && (
                    <div
                      className={`opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 self-center ${
                        isMe ? 'flex-row-reverse' : 'flex-row'
                      }`}
                    >
                      {msg.text && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopyMessage(msg);
                          }}
                          className="p-1 rounded-md text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 bg-white dark:bg-slate-800 shadow-2xs border border-slate-200 dark:border-slate-700 cursor-pointer"
                          title="Copy text"
                        >
                          {copiedMsgId === msg.id ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMessageReaction(chatId, msg.id, '❤️', currentUser.uid);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-500 bg-white dark:bg-slate-800 shadow-2xs border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                        title="React with heart"
                      >
                        ❤️
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleMessageReaction(chatId, msg.id, '👍', currentUser.uid);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-indigo-500 bg-white dark:bg-slate-800 shadow-2xs border border-slate-200 dark:border-slate-700 text-xs cursor-pointer"
                        title="React with thumbs up"
                      >
                        👍
                      </button>

                      {/* Delete Message Button */}
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDeleteSingle(msg);
                        }}
                        className="p-1 rounded-md text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 bg-white dark:bg-slate-800 shadow-2xs border border-slate-200 dark:border-slate-700 cursor-pointer"
                        title="Delete Message"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  )}
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

      {/* Bottom Message Input (Sticky to bottom) */}
      <div className="p-2.5 sm:p-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b28] sticky bottom-0 z-20 shrink-0">
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

        {/* VOICE RECORDING BAR (WhatsApp style live recording) */}
        {isRecording ? (
          <div className="flex items-center justify-between gap-3 bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 p-2 sm:p-2.5 rounded-2xl animate-in fade-in duration-150">
            <div className="flex items-center gap-2.5 pl-2">
              <span className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
              </span>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                  Recording Voice Note
                </span>
                <span className="font-mono text-xs font-bold text-slate-700 dark:text-slate-300">
                  {Math.floor(recordingDuration / 60)}:
                  {(recordingDuration % 60).toString().padStart(2, '0')}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCancelVoiceRecord}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors cursor-pointer"
              >
                <Trash2 size={15} className="text-rose-600" />
                <span className="hidden sm:inline">Cancel</span>
              </button>

              <button
                type="button"
                onClick={handleSendVoiceRecord}
                disabled={isSending}
                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer transition-transform active:scale-95"
              >
                <Send size={14} />
                <span>Send</span>
              </button>
            </div>
          </div>
        ) : (
          /* STANDARD INPUT BAR */
          <form onSubmit={handleSendMessage} className="flex items-center gap-1.5 sm:gap-2">
            {/* Emoji toggle button */}
            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              aria-label="Add emoji"
            >
              <Smile size={20} />
            </button>

            {/* Photo Attachment Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="p-2 sm:p-2.5 rounded-xl text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors shrink-0 cursor-pointer"
              aria-label="Send photo"
              title="Send Photo"
            >
              <ImageIcon size={20} />
            </button>

            {/* Text input */}
            <input
              id="chat-message-input"
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Type a secure message..."
              className={`flex-1 py-2.5 px-3.5 sm:px-4 rounded-xl border ${theme.inputBg} ${theme.inputBorder} text-sm focus:outline-hidden transition-all`}
            />

            {/* Send or Voice Record Button (WhatsApp style dynamic action) */}
            {inputText.trim().length > 0 ? (
              <button
                id="chat-send-btn"
                type="submit"
                disabled={isSending}
                className="inline-flex items-center justify-center p-2.5 sm:px-4 sm:py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-sm transition-all shadow-xs active:scale-95 disabled:opacity-50 shrink-0 cursor-pointer"
              >
                <Send size={17} />
                <span className="hidden sm:inline ml-2">Send</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleStartVoiceRecord}
                className="inline-flex items-center justify-center p-2.5 rounded-xl bg-slate-100 hover:bg-indigo-50 dark:bg-slate-800 dark:hover:bg-indigo-950/50 text-slate-600 hover:text-indigo-600 dark:text-slate-300 dark:hover:text-indigo-400 font-bold transition-all shrink-0 cursor-pointer"
                title="Hold or tap to record voice note"
              >
                <Mic size={19} />
              </button>
            )}
          </form>
        )}
      </div>
    </div>
  );
};
