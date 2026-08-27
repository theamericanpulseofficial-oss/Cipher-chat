import React, { useState, useEffect, useRef } from 'react';
import {
  Globe,
  Send,
  Image as ImageIcon,
  Mic,
  Smile,
  Copy,
  Check,
  Trash2,
  Clock,
  Radio,
  X,
  Lock,
  Sparkles,
  Info,
  AlertCircle
} from 'lucide-react';
import { UserProfile, ChatMessage } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './Toast';
import {
  subscribeToWorldMessages,
  sendWorldMessage,
  toggleWorldMessageReaction,
  deleteWorldMessage
} from '../services/worldChatService';
import { playMessageSentSound, playMessageReceivedSound } from '../utils/audio';
import { UserAvatar, VerifiedBadge } from './UserAvatar';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { ImageLightboxModal } from './ImageLightboxModal';
import { ImageCropperModal } from './ImageCropperModal';
import { startVoiceRecording, VoiceRecorderSession } from '../utils/media';

interface WorldChatViewProps {
  currentUser: UserProfile;
}

const QUICK_EMOJIS = ['👍', '❤️', '🔥', '😂', '🎉', '🔒', '🙌', '💯', '✨', '⚡'];

export const WorldChatView: React.FC<WorldChatViewProps> = ({ currentUser }) => {
  const { theme, soundEnabled } = useTheme();
  const { showToast } = useToast();

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [copiedMsgId, setCopiedMsgId] = useState<string | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  // Photo sending & Lightbox state
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [rawPhotoForCrop, setRawPhotoForCrop] = useState<string | null>(null);
  const [showCropperModal, setShowCropperModal] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
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

  // Delete message confirmation
  const [msgToDelete, setMsgToDelete] = useState<ChatMessage | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const prevMessagesCount = useRef(0);

  // Subscribe to real-time world messages
  useEffect(() => {
    const unsubscribe = subscribeToWorldMessages(
      (newMessages) => {
        if (newMessages.length > prevMessagesCount.current && prevMessagesCount.current > 0) {
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
        showToast('Error syncing World Chat', 'error');
      }
    );

    // Periodic state re-render every 30 seconds to update time-remaining labels
    const ticker = setInterval(() => {
      setMessages((prev) => [...prev]);
    }, 30000);

    return () => {
      unsubscribe();
      clearInterval(ticker);
      if (voiceSessionRef.current) voiceSessionRef.current.cancel();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [currentUser.uid, soundEnabled, showToast]);

  // Auto scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length, previewImage, isRecording]);

  // Calculate remaining minutes before 1-hour expiration
  const getRemainingTimeStr = (timestamp: number) => {
    const expiresAt = timestamp + 60 * 60 * 1000;
    const remainingMs = expiresAt - Date.now();
    if (remainingMs <= 0) return 'Expiring...';
    const remainingMins = Math.ceil(remainingMs / (60 * 1000));
    if (remainingMins < 1) return '< 1m left';
    return `${remainingMins}m left`;
  };

  // Send plain text message
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = inputText.trim();
    if (!trimmed || isSending) return;

    if (currentUser.messagingDisabled) {
      showToast('Your messaging capability has been restricted.', 'error');
      return;
    }

    setInputText('');
    setIsSending(true);

    try {
      if (soundEnabled) playMessageSentSound();
      await sendWorldMessage(currentUser, {
        type: 'text',
        text: trimmed
      });
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to send message.';
      showToast(msg, 'error');
      setInputText(trimmed);
    } finally {
      setIsSending(false);
    }
  };

  // Handle photo pick -> Cropper
  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (currentUser.photosDisabled) {
      showToast('Photo sharing is disabled for your account.', 'error');
      return;
    }

    const file = files[0];
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setRawPhotoForCrop(reader.result);
        setShowCropperModal(true);
      }
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleCropComplete = (croppedBase64: string) => {
    setShowCropperModal(false);
    setRawPhotoForCrop(null);
    setPreviewImage(croppedBase64);
    setImageCaption('');
  };

  const handleConfirmSendPhoto = async () => {
    if (!previewImage || isSending) return;
    setIsSending(true);
    try {
      if (soundEnabled) playMessageSentSound();
      await sendWorldMessage(currentUser, {
        type: 'image',
        text: imageCaption.trim(),
        mediaUrl: previewImage
      });
      setPreviewImage(null);
      setImageCaption('');
      showToast('Photo sent to World Chat!', 'success');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to send photo.';
      showToast(msg, 'error');
    } finally {
      setIsSending(false);
    }
  };

  // Voice recording
  const handleStartVoice = async () => {
    if (currentUser.voiceDisabled) {
      showToast('Voice messaging is disabled for your account.', 'error');
      return;
    }
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
      console.error(err);
      showToast('Microphone access required for voice message.', 'error');
    }
  };

  const handleCancelVoice = () => {
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (voiceSessionRef.current) voiceSessionRef.current.cancel();
    setIsRecording(false);
    setRecordingDuration(0);
  };

  const handleStopAndSendVoice = async () => {
    if (!voiceSessionRef.current) return;
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);

    setIsSending(true);
    setIsRecording(false);

    try {
      const { audioDataUrl, duration } = await voiceSessionRef.current.stop();
      if (duration < 1) {
        showToast('Voice message too short.', 'info');
        return;
      }
      if (soundEnabled) playMessageSentSound();
      await sendWorldMessage(currentUser, {
        type: 'audio',
        text: '',
        mediaUrl: audioDataUrl,
        mediaDuration: duration
      });
      showToast('Voice message sent to World Chat!', 'success');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to send voice message.';
      showToast(msg, 'error');
    } finally {
      setIsSending(false);
      setRecordingDuration(0);
    }
  };

  // Delete message
  const handleConfirmDelete = async () => {
    if (!msgToDelete) return;
    try {
      await deleteWorldMessage(msgToDelete.id);
      showToast('Message deleted from World Chat', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete message', 'error');
    } finally {
      setMsgToDelete(null);
    }
  };

  const formatMsgTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const isMasterAdmin = (currentUser.name || '').trim().toLowerCase() === 'kailash';

  return (
    <div className="h-full max-w-5xl mx-auto p-2 sm:p-4 lg:p-6 flex flex-col h-[calc(100vh-4rem)] md:h-screen">
      {/* Photo Crop Modal */}
      {showCropperModal && rawPhotoForCrop && (
        <ImageCropperModal
          imageSrc={rawPhotoForCrop}
          isOpen={showCropperModal}
          aspectRatio="free"
          isCircularMask={false}
          title="Crop Photo for World Chat"
          onCropComplete={handleCropComplete}
          onClose={() => {
            setShowCropperModal(false);
            setRawPhotoForCrop(null);
          }}
        />
      )}

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

      {/* Photo Preview Modal */}
      {previewImage && (
        <div className="fixed inset-0 z-[80] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181f2e] border border-slate-200 dark:border-slate-700 rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-2xl flex flex-col gap-3.5 animate-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ImageIcon size={18} className="text-indigo-600 dark:text-indigo-400" />
                <span>Send Photo to World Chat</span>
              </h3>
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="max-h-[50vh] overflow-hidden rounded-xl bg-slate-950 flex items-center justify-center">
              <img
                src={previewImage}
                alt="Selected preview"
                className="max-h-[48vh] w-auto object-contain rounded-lg"
              />
            </div>

            <input
              type="text"
              value={imageCaption}
              onChange={(e) => setImageCaption(e.target.value)}
              placeholder="Add an optional caption..."
              className={`w-full py-2.5 px-3.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} text-sm focus:outline-hidden`}
            />

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPreviewImage(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSending}
                onClick={handleConfirmSendPhoto}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold shadow-md cursor-pointer disabled:opacity-50"
              >
                <Send size={14} />
                <span>{isSending ? 'Sending...' : 'Send to World'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {msgToDelete && (
        <div className="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181f2e] border border-slate-200 dark:border-slate-700 rounded-2xl max-w-sm w-full p-5 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/50 text-rose-600 flex items-center justify-center shrink-0">
                <Trash2 size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white">Delete Message?</h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  This will remove this message from World Chat for all users.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setMsgToDelete(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer"
              >
                Delete Message
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main World Chat Container */}
      <div className="flex-1 flex flex-col rounded-2xl border border-slate-200/90 dark:border-slate-800 bg-white dark:bg-[#151b28] overflow-hidden shadow-xs">
        {/* Top Channel Header */}
        <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between bg-white/95 dark:bg-[#151b28]/95 backdrop-blur-md shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-500 via-indigo-600 to-purple-600 text-white flex items-center justify-center shadow-md shrink-0">
              <Globe size={22} className="animate-spin-slow" />
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  World Chat
                </h2>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  <span>Public Live</span>
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
                <Clock size={12} className="text-indigo-500" />
                <span>Auto-clean: Every message auto-deletes after 1 hour</span>
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center gap-2">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
              {messages.length} active {messages.length === 1 ? 'message' : 'messages'}
            </span>
          </div>
        </div>

        {/* Informational Banner */}
        <div className="px-4 py-2 bg-indigo-50/70 dark:bg-indigo-950/30 border-b border-indigo-100 dark:border-indigo-900/40 text-[11px] text-indigo-900 dark:text-indigo-200 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 min-w-0">
            <Sparkles size={13} className="text-indigo-600 dark:text-indigo-400 shrink-0" />
            <span className="truncate">
              Welcome to the Global Hub. Messages are public and cleanly vanish 1 hour after creation.
            </span>
          </div>
          <span className="font-mono font-bold text-[10px] bg-white dark:bg-slate-800 px-2 py-0.5 rounded-md border border-indigo-200 dark:border-indigo-800 shrink-0">
            TTL: 60 MIN
          </span>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-5 space-y-4 bg-slate-50/40 dark:bg-[#0f131d]/60">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center p-8">
              <div className="w-16 h-16 rounded-3xl bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 flex items-center justify-center mb-3">
                <Globe size={32} />
              </div>
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                World Chat is Clean
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-xs mt-1">
                Be the first to say hello to everyone! Messages will stay live for 1 hour.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isMe = msg.senderId === currentUser.uid;
              const remainingTime = getRemainingTimeStr(msg.timestamp);

              return (
                <div
                  key={msg.id}
                  className={`group flex items-start gap-2.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}
                >
                  {/* Sender Avatar */}
                  <div className="shrink-0 pt-0.5">
                    <UserAvatar
                      name={msg.senderName}
                      photoURL={msg.senderPhotoURL}
                      size="sm"
                    />
                  </div>

                  {/* Message Bubble + Meta */}
                  <div className={`flex flex-col max-w-[85%] sm:max-w-[75%] ${isMe ? 'items-end' : 'items-start'}`}>
                    {/* Sender Name & Expiry Tag */}
                    <div className="flex items-center gap-1.5 px-1 mb-1 text-[11px]">
                      <span className="font-bold text-slate-800 dark:text-slate-200">
                        {isMe ? 'You' : msg.senderName}
                      </span>
                      <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-mono flex items-center gap-0.5">
                        <Clock size={10} />
                        <span>{remainingTime}</span>
                      </span>
                    </div>

                    {/* Bubble Content */}
                    <div
                      className={`relative p-3 rounded-2xl text-xs sm:text-sm shadow-2xs transition-all ${
                        isMe
                          ? 'bg-indigo-600 text-white rounded-tr-xs'
                          : 'bg-white dark:bg-[#1c2436] text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-800 rounded-tl-xs'
                      }`}
                    >
                      {/* Photo Message */}
                      {msg.type === 'image' && msg.mediaUrl && (
                        <div className="space-y-1.5 mb-1">
                          <div
                            onClick={() =>
                              setLightboxImage({
                                url: msg.mediaUrl!,
                                senderName: msg.senderName,
                                timestamp: msg.timestamp,
                                caption: msg.text
                              })
                            }
                            className="cursor-pointer overflow-hidden rounded-xl max-w-sm max-h-72 bg-black/10 hover:opacity-95"
                          >
                            <img
                              src={msg.mediaUrl}
                              alt="Shared photo"
                              className="w-full h-auto object-cover max-h-72 rounded-xl"
                              referrerPolicy="no-referrer"
                            />
                          </div>
                          {msg.text && <p className="whitespace-pre-wrap break-words">{msg.text}</p>}
                        </div>
                      )}

                      {/* Voice Message */}
                      {msg.type === 'audio' && msg.mediaUrl && (
                        <VoiceMessagePlayer
                          audioUrl={msg.mediaUrl}
                          duration={msg.mediaDuration}
                          isSender={isMe}
                        />
                      )}

                      {/* Text Message */}
                      {(!msg.type || msg.type === 'text') && (
                        <p className="whitespace-pre-wrap break-words">{msg.text}</p>
                      )}

                      {/* Timestamp */}
                      <div
                        className={`flex items-center justify-end gap-1 mt-1 text-[10px] ${
                          isMe ? 'text-white/80' : 'text-slate-400 dark:text-slate-500'
                        }`}
                      >
                        <span>{formatMsgTime(msg.timestamp)}</span>
                      </div>
                    </div>

                    {/* Quick Reactions / Hover Tools */}
                    <div className="flex items-center gap-1 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {msg.text && (
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(msg.text);
                            setCopiedMsgId(msg.id);
                            showToast('Message copied', 'info');
                            setTimeout(() => setCopiedMsgId(null), 2000);
                          }}
                          className="p-1 rounded bg-slate-200/60 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer"
                          title="Copy"
                        >
                          {copiedMsgId === msg.id ? <Check size={11} className="text-emerald-500" /> : <Copy size={11} />}
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => toggleWorldMessageReaction(msg.id, '❤️', currentUser.uid)}
                        className="p-1 rounded bg-slate-200/60 dark:bg-slate-800 text-xs cursor-pointer hover:scale-110"
                        title="React Heart"
                      >
                        ❤️
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleWorldMessageReaction(msg.id, '🔥', currentUser.uid)}
                        className="p-1 rounded bg-slate-200/60 dark:bg-slate-800 text-xs cursor-pointer hover:scale-110"
                        title="React Fire"
                      >
                        🔥
                      </button>

                      {(isMe || isMasterAdmin) && (
                        <button
                          type="button"
                          onClick={() => setMsgToDelete(msg)}
                          className="p-1 rounded bg-rose-50 dark:bg-rose-950/50 text-rose-500 hover:text-rose-700 cursor-pointer"
                          title="Delete message"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>

                    {/* Reaction Pills */}
                    {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {Object.entries(msg.reactions).map(([emoji, ids]) => {
                          const userIds = ids as string[];
                          if (!Array.isArray(userIds) || userIds.length === 0) return null;
                          const hasReacted = userIds.includes(currentUser.uid);

                          return (
                            <button
                              key={emoji}
                              type="button"
                              onClick={() => toggleWorldMessageReaction(msg.id, emoji, currentUser.uid)}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border cursor-pointer ${
                                hasReacted
                                  ? 'bg-indigo-50 dark:bg-indigo-950 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300'
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
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Bottom Message Input Bar */}
        <div className="p-3 sm:p-4 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#151b28] shrink-0">
          {/* Quick Emoji Bar */}
          {showEmojiPicker && (
            <div className="flex items-center gap-1.5 pb-2 overflow-x-auto">
              {QUICK_EMOJIS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => {
                    setInputText((prev) => prev + emoji);
                    setShowEmojiPicker(false);
                  }}
                  className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl text-lg transition-transform hover:scale-125 cursor-pointer"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          {/* Voice Recording Active Bar */}
          {isRecording ? (
            <div className="flex items-center justify-between gap-3 p-2 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 animate-pulse">
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold">
                <Radio size={16} className="animate-spin" />
                <span>Recording Voice... {recordingDuration}s</span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCancelVoice}
                  className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-white/60 rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleStopAndSendVoice}
                  className="px-4 py-1.5 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white rounded-xl shadow-xs cursor-pointer"
                >
                  Send Audio
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
              {/* Photo Input (Hidden) */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handlePhotoSelect}
                accept="image/*"
                className="hidden"
              />

              {/* Attach Photo Button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={currentUser.photosDisabled}
                className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
                title="Send photo"
              >
                <ImageIcon size={19} />
              </button>

              {/* Emoji Picker Toggle */}
              <button
                type="button"
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                className="p-2.5 rounded-xl text-slate-500 hover:text-amber-500 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer"
                title="Quick emojis"
              >
                <Smile size={19} />
              </button>

              {/* Text Input */}
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  currentUser.messagingDisabled
                    ? 'Messaging disabled by admin'
                    : 'Message the world (expires in 1h)...'
                }
                disabled={currentUser.messagingDisabled || isSending}
                className={`flex-1 px-4 py-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} text-sm focus:outline-hidden`}
              />

              {/* Voice Record Button (when input is empty) */}
              {!inputText.trim() ? (
                <button
                  type="button"
                  onClick={handleStartVoice}
                  disabled={currentUser.voiceDisabled}
                  className="p-2.5 rounded-xl text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer disabled:opacity-40"
                  title="Record voice message"
                >
                  <Mic size={19} />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isSending || currentUser.messagingDisabled}
                  className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95 transition-all cursor-pointer disabled:opacity-50"
                  title="Send message"
                >
                  <Send size={18} />
                </button>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
