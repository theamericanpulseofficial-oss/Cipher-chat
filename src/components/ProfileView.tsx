import React, { useState, useRef } from 'react';
import {
  Copy,
  Check,
  LogOut,
  Palette,
  Volume2,
  VolumeX,
  Shield,
  Calendar,
  Sparkles,
  Camera,
  Upload,
  Trash2,
  Sun,
  Moon,
  Save,
  Loader2,
  Image as ImageIcon,
  User as UserIcon,
  X,
  KeyRound,
  Lock,
  Crop,
  Send,
  AlertTriangle
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, ChatConversation } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './Toast';
import { formatChatCodeDisplay } from '../services/chatService';
import { updateUserProfile } from '../services/authService';
import { submitPasswordResetRequest, submitNameChangeRequest } from '../services/adminService';
import { UserAvatar, VerifiedBadge } from './UserAvatar';
import { PRESET_AVATARS } from '../utils/imageUtils';
import { ImageCropperModal } from './ImageCropperModal';

interface ProfileViewProps {
  user: UserProfile;
  chats: ChatConversation[];
  onLogout: () => void;
  onProfileUpdated?: (updated: Partial<UserProfile>) => void;
  onEnterAdmin?: () => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  chats,
  onLogout,
  onProfileUpdated,
  onEnterAdmin
}) => {
  const { theme, themeMode, setThemeMode, soundEnabled, setSoundEnabled } = useTheme();
  const { showToast } = useToast();

  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);

  // Triple-Click Admin Trigger
  const [clickCount, setClickCount] = useState(0);
  const lastClickTimeRef = useRef<number>(0);
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [adminPassInput, setAdminPassInput] = useState('');
  const [adminAuthError, setAdminAuthError] = useState(false);

  // Cropper State for Profile Photo
  const [rawPhotoForCrop, setRawPhotoForCrop] = useState<string | null>(null);
  const [showCropperModal, setShowCropperModal] = useState(false);

  // Request Password Reset Modal
  const [showPasswordReqModal, setShowPasswordReqModal] = useState(false);
  const [passwordReqReason, setPasswordReqReason] = useState('');
  const [isSubmittingPasswordReq, setIsSubmittingPasswordReq] = useState(false);

  // Request Name Change Modal
  const [showNameChangeModal, setShowNameChangeModal] = useState(false);
  const [requestedName, setRequestedName] = useState('');
  const [nameChangeReason, setNameChangeReason] = useState('');
  const [isSubmittingNameReq, setIsSubmittingNameReq] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Secret Triple-Click on "Account Profile & Settings" / "Setting"
  const handleHeaderTripleClick = () => {
    const now = Date.now();
    if (now - lastClickTimeRef.current > 1500) {
      setClickCount(1);
    } else {
      const nextCount = clickCount + 1;
      setClickCount(nextCount);
      if (nextCount >= 3) {
        setClickCount(0);
        // Security check: Only account named 'Kailash' (case-insensitive) can access Master Admin
        const normalizedName = (user.name || '').trim().toLowerCase();
        if (normalizedName === 'kailash') {
          setShowAdminAuthModal(true);
          setAdminPassInput('');
          setAdminAuthError(false);
        } else {
          showToast('Access Denied: Only user "Kailash" is permitted to access the Master Admin Control. (Not Allowed)', 'error');
        }
      }
    }
    lastClickTimeRef.current = now;
  };

  // Verify Admin Passcode (2026)
  const handleVerifyAdminPasscode = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminPassInput.trim() === '2026') {
      setShowAdminAuthModal(false);
      setAdminPassInput('');
      showToast('Admin mode authenticated!', 'success');
      onEnterAdmin?.();
    } else {
      setAdminAuthError(true);
    }
  };

  // Copy Chat Code
  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(user.chatCode);
      setCopied(true);
      showToast('Personal chat code copied to clipboard!', 'success');

      confetti({
        particleCount: 40,
        spread: 60,
        origin: { y: 0.8 },
        colors: ['#4f46e5', '#7c3aed', '#6366f1', '#10b981']
      });

      setTimeout(() => setCopied(false), 2500);
    } catch {
      showToast(user.chatCode, 'info');
    }
  };

  // Handle Photo Selection -> Open Cropper
  const handlePhotoFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

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

  // Handle Apply Cropped Avatar
  const handleAvatarCropApplied = async (croppedBase64: string) => {
    setShowCropperModal(false);
    setRawPhotoForCrop(null);
    setIsUploadingPhoto(true);

    try {
      await updateUserProfile(user.uid, { photoURL: croppedBase64 });
      user.photoURL = croppedBase64;
      onProfileUpdated?.({ photoURL: croppedBase64 });
      showToast('Profile photo updated successfully!', 'success');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to update photo';
      showToast(msg, 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Handle Preset Avatar Selection
  const handleSelectPreset = async (url: string) => {
    setIsUploadingPhoto(true);
    setShowPresetModal(false);
    try {
      await updateUserProfile(user.uid, { photoURL: url });
      user.photoURL = url;
      onProfileUpdated?.({ photoURL: url });
      showToast('Profile avatar updated!', 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to update avatar', 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Remove Profile Photo
  const handleRemovePhoto = async () => {
    setIsUploadingPhoto(true);
    try {
      await updateUserProfile(user.uid, { photoURL: '' });
      user.photoURL = undefined;
      onProfileUpdated?.({ photoURL: undefined });
      showToast('Profile photo removed.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to remove photo', 'error');
    } finally {
      setIsUploadingPhoto(false);
    }
  };

  // Save Bio & Status
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();

    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, {
        bio: bio.trim()
      });
      user.bio = bio.trim();
      onProfileUpdated?.({ bio: bio.trim() });
      showToast('Profile bio updated successfully!', 'success');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to save profile changes.';
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Submit Name Change Request
  const handleSubmitNameChangeRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestedName.trim()) {
      showToast('Please enter your desired new name', 'error');
      return;
    }

    setIsSubmittingNameReq(true);
    try {
      await submitNameChangeRequest(user, requestedName, nameChangeReason);
      showToast('Name change request submitted to Admin successfully!', 'success');
      setShowNameChangeModal(false);
      setRequestedName('');
      setNameChangeReason('');
    } catch (err) {
      console.error(err);
      showToast('Failed to submit name change request', 'error');
    } finally {
      setIsSubmittingNameReq(false);
    }
  };

  // Submit Password Request
  const handleSubmitPasswordRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmittingPasswordReq(true);
    try {
      await submitPasswordResetRequest(user, passwordReqReason);
      showToast('Password change request sent to Admin successfully!', 'success');
      setShowPasswordReqModal(false);
      setPasswordReqReason('');
    } catch (err) {
      console.error(err);
      showToast('Failed to submit password request', 'error');
    } finally {
      setIsSubmittingPasswordReq(false);
    }
  };

  const memberSince = new Date(user.createdAt || Date.now()).toLocaleDateString([], {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Interactive Image Cropper for Profile Photo */}
      {showCropperModal && rawPhotoForCrop && (
        <ImageCropperModal
          imageSrc={rawPhotoForCrop}
          isOpen={showCropperModal}
          aspectRatio="square"
          isCircularMask={true}
          title="Crop Profile Photo"
          onCropComplete={handleAvatarCropApplied}
          onClose={() => {
            setShowCropperModal(false);
            setRawPhotoForCrop(null);
          }}
        />
      )}

      {/* Secret Admin Authentication Modal (3 Clicks Trigger) */}
      {showAdminAuthModal && (
        <div className="fixed inset-0 z-[120] bg-black/85 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Lock size={20} />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Security Verification</h3>
                <p className="text-[11px] text-slate-400">Enter access key to continue</p>
              </div>
            </div>

            <form onSubmit={handleVerifyAdminPasscode} className="space-y-3 pt-1">
              <div>
                <input
                  type="password"
                  value={adminPassInput}
                  onChange={(e) => {
                    setAdminPassInput(e.target.value);
                    setAdminAuthError(false);
                  }}
                  placeholder="••••"
                  autoFocus
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-center tracking-widest text-lg focus:outline-hidden focus:border-indigo-500"
                />
                {adminAuthError && (
                  <p className="text-[11px] text-rose-400 text-center mt-1.5 font-medium">
                    Access Denied
                  </p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAdminAuthModal(false)}
                  className="px-3.5 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all active:scale-95 cursor-pointer"
                >
                  Authenticate
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Request Modal */}
      {showPasswordReqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#181b24] border border-slate-200 dark:border-slate-800 rounded-3xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <KeyRound size={20} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Request Password Change
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Send a request directly to the Admin
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordReqModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitPasswordRequest} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                  Reason / Note for Admin (Optional)
                </label>
                <textarea
                  rows={3}
                  value={passwordReqReason}
                  onChange={(e) => setPasswordReqReason(e.target.value)}
                  placeholder="e.g. Please reset my password or set my new temporary key"
                  className={`w-full px-3.5 py-2 rounded-xl border ${theme.inputBg} ${theme.inputBorder} text-xs`}
                />
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordReqModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSubmittingPasswordReq}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md active:scale-95 disabled:opacity-60 cursor-pointer"
                >
                  {isSubmittingPasswordReq ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Account Restrictions Banner (if any) */}
      {(user.isBanned || user.messagingDisabled || user.voiceDisabled || user.photosDisabled) && (
        <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 flex items-start gap-3">
          <AlertTriangle size={20} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="text-xs font-bold text-rose-800 dark:text-rose-300">
              Account Moderation Notice
            </h4>
            <p className="text-xs text-rose-700 dark:text-rose-400">
              {user.isBanned && 'Your account has been suspended by the administrator.'}
              {user.messagingDisabled && ' Text messaging is disabled for your account.'}
              {user.voiceDisabled && ' Voice messages are disabled for your account.'}
              {user.photosDisabled && ' Photo sharing is disabled for your account.'}
            </p>
          </div>
        </div>
      )}

      {/* Header - Triple Click Secret Trigger on Title */}
      <div>
        <h2
          onClick={handleHeaderTripleClick}
          className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white cursor-pointer select-none transition-colors"
          title="Account Profile & Settings"
        >
          Account Profile & Settings
        </h2>
        <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-1">
          Customize your profile photo, personal information, and Light/Dark display theme.
        </p>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handlePhotoFileSelected}
        className="hidden"
      />

      {/* Section 1: Profile Photo & Hero Identity */}
      <div className={`p-6 sm:p-8 rounded-2xl border ${theme.surfaceCard} space-y-6`}>
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
          {/* Avatar with Camera Overlay */}
          <div className="relative group">
            <UserAvatar
              name={user.name}
              photoURL={user.photoURL}
              avatarColor={user.avatarColor}
              avatarIcon={user.avatarIcon}
              size="2xl"
              showOnlineStatus
              isOnline={true}
            />

            <button
              type="button"
              id="btn-upload-photo-badge"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingPhoto}
              title="Change profile photo"
              className="absolute bottom-0 right-0 p-2 rounded-full bg-indigo-600 hover:bg-indigo-700 text-white shadow-md border-2 border-white dark:border-[#151b28] transition-transform active:scale-95 cursor-pointer"
            >
              {isUploadingPhoto ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Camera size={16} />
              )}
            </button>
          </div>

          {/* Photo Actions & User Info */}
          <div className="flex-1 text-center sm:text-left space-y-3 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <div className="flex items-center justify-center sm:justify-start gap-1.5 flex-wrap">
                  <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                    {user.name}
                  </h3>
                  {user.isVerified && <VerifiedBadge size="md" />}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                  <Calendar size={13} />
                  <span>Member since {memberSince}</span>
                </p>
              </div>

              {user.isVerified && (
                <span className="px-3 py-1 rounded-full text-xs font-semibold bg-sky-50 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300 border border-sky-200 dark:border-sky-800 flex items-center justify-center gap-1.5 self-center sm:self-auto">
                  <VerifiedBadge size="sm" />
                  <span>Verified Account</span>
                </span>
              )}
            </div>

            {/* Photo Action Buttons */}
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
              <button
                type="button"
                id="btn-upload-profile-photo"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploadingPhoto}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-xs cursor-pointer disabled:opacity-60"
              >
                <Crop size={14} />
                <span>Upload & Crop Photo</span>
              </button>

              <button
                type="button"
                id="btn-select-preset-avatar"
                onClick={() => setShowPresetModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 transition-all cursor-pointer"
              >
                <ImageIcon size={14} />
                <span>Choose Avatar</span>
              </button>

              {user.photoURL && (
                <button
                  type="button"
                  id="btn-remove-photo"
                  onClick={handleRemovePhoto}
                  disabled={isUploadingPhoto}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors cursor-pointer"
                >
                  <Trash2 size={14} />
                  <span>Remove Photo</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Edit Info Form */}
        <form onSubmit={handleSaveProfile} className="pt-4 border-t border-slate-100 dark:border-slate-800/80 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                  Display Name
                </label>
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/60 px-2 py-0.5 rounded-md border border-amber-200 dark:border-amber-800">
                  <Lock size={11} /> Admin Request Only
                </span>
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="input-profile-name"
                  value={user.name}
                  disabled
                  className="flex-1 px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900/80 text-sm font-semibold text-slate-800 dark:text-slate-200 cursor-not-allowed"
                  placeholder="Your display name"
                />
                <button
                  type="button"
                  onClick={() => {
                    setRequestedName('');
                    setNameChangeReason('');
                    setShowNameChangeModal(true);
                  }}
                  className="px-3.5 py-2.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/60 dark:hover:bg-indigo-900/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800 text-xs font-bold transition-all cursor-pointer shrink-0"
                >
                  Request Change
                </button>
              </div>
              <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-1">
                Name changes require administrator review and approval.
              </p>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Personal Bio / Status
              </label>
              <input
                type="text"
                id="input-profile-bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} text-sm`}
                placeholder="e.g. Always ready to encrypt and chat"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={() => setShowPasswordReqModal(true)}
              className="inline-flex items-center gap-1.5 text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              <KeyRound size={14} />
              <span>Request Password Change</span>
            </button>

            <button
              type="submit"
              id="btn-save-profile-info"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-sm transition-all shadow-xs active:scale-98 disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  <Save size={16} />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Section 2: Unique Chat Code Card */}
      <div className={`p-6 sm:p-8 rounded-2xl border ${theme.surfaceCard} space-y-4`}>
        <div>
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            MY PERMANENT CHAT CODE
          </h4>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Others use this unique 6-character code to find and chat with you directly.
          </p>
        </div>

        <div className="p-4 sm:p-5 rounded-2xl bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/40 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-2xl sm:text-3xl font-mono font-black tracking-widest text-indigo-600 dark:text-indigo-400 select-all">
            {formatChatCodeDisplay(user.chatCode)}
          </span>

          <button
            id="btn-copy-profile-code"
            onClick={handleCopyCode}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-indigo-600 hover:bg-indigo-700 text-white transition-all shadow-sm active:scale-98 cursor-pointer"
          >
            {copied ? (
              <>
                <Check size={16} />
                <span>Copied Code!</span>
              </>
            ) : (
              <>
                <Copy size={16} />
                <span>Copy Code</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Section 3: UI Theme System (Light Mode & Dark Mode ONLY) */}
      <div className={`p-6 sm:p-8 rounded-2xl border ${theme.surfaceCard} space-y-4`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Palette size={20} className="text-indigo-600 dark:text-indigo-400" />
            <div>
              <h4 className="text-base font-bold text-slate-900 dark:text-white">
                UI Theme (Dark / Light)
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Choose between Light Mode and Dark Mode for your interface.
              </p>
            </div>
          </div>
        </div>

        {/* Exactly 2 Themes: Light and Dark */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
          {/* Light Mode Card */}
          <button
            type="button"
            id="theme-select-light"
            onClick={() => {
              setThemeMode('light');
              showToast('Switched to Light Mode', 'info');
            }}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
              themeMode === 'light'
                ? 'border-indigo-600 ring-2 ring-indigo-500/20 bg-indigo-50/50 dark:bg-indigo-950/40 shadow-sm'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-100 text-amber-700">
                  <Sun size={20} />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                    Light Mode
                  </h5>
                  <span className="text-[11px] text-slate-500">Daytime Clarity</span>
                </div>
              </div>

              {themeMode === 'light' && (
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                  <Check size={14} />
                </div>
              )}
            </div>

            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              Clean, crisp white canvas with high contrast typography and royal indigo accents.
            </p>
          </button>

          {/* Dark Mode Card */}
          <button
            type="button"
            id="theme-select-dark"
            onClick={() => {
              setThemeMode('dark');
              showToast('Switched to Dark Mode', 'info');
            }}
            className={`p-5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between relative overflow-hidden ${
              themeMode === 'dark'
                ? 'border-indigo-500 ring-2 ring-indigo-500/30 bg-indigo-950/30 shadow-md'
                : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 bg-white dark:bg-slate-850'
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-indigo-950 text-indigo-400 border border-indigo-800/50">
                  <Moon size={20} />
                </div>
                <div>
                  <h5 className="text-sm font-bold text-slate-900 dark:text-white">
                    Dark Mode
                  </h5>
                  <span className="text-[11px] text-slate-400">Midnight OLED</span>
                </div>
              </div>

              {themeMode === 'dark' && (
                <div className="w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center">
                  <Check size={14} />
                </div>
              )}
            </div>

            <p className="text-xs text-slate-400 leading-relaxed">
              Deep charcoal and obsidian palette with glowing accents, gentle on the eyes in low light.
            </p>
          </button>
        </div>
      </div>

      {/* Section 4: Sound Effects & Preferences */}
      <div className={`p-6 sm:p-8 rounded-2xl border ${theme.surfaceCard} flex items-center justify-between`}>
        <div className="flex items-center gap-3">
          {soundEnabled ? (
            <Volume2 size={22} className="text-indigo-600 dark:text-indigo-400" />
          ) : (
            <VolumeX size={22} className="text-slate-400" />
          )}
          <div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              Sound Effects
            </h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Audio feedback for sent messages and friend connections.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setSoundEnabled(!soundEnabled);
            showToast(soundEnabled ? 'Sound muted' : 'Sound enabled', 'info');
          }}
          className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            soundEnabled
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          {soundEnabled ? 'Enabled' : 'Muted'}
        </button>
      </div>

      {/* Section 5: Sign Out */}
      <div className="pt-2">
        <button
          id="btn-profile-logout"
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl border border-rose-200 dark:border-rose-900 bg-rose-50 hover:bg-rose-100/80 dark:bg-rose-950/30 dark:hover:bg-rose-950/60 text-rose-700 dark:text-rose-300 font-bold text-sm transition-colors cursor-pointer"
        >
          <LogOut size={18} />
          <span>Sign Out of UP1CHATBOX</span>
        </button>
      </div>

      {/* Preset Avatars Selection Modal */}
      {showPresetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#181b24] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Choose Profile Avatar
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select one of our curated avatars for your profile.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPresetModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-4 gap-3 py-2">
              {PRESET_AVATARS.map((avatarUrl, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectPreset(avatarUrl)}
                  className="w-16 h-16 rounded-2xl overflow-hidden border-2 border-transparent hover:border-indigo-600 hover:scale-105 transition-all shadow-xs cursor-pointer focus:outline-hidden"
                >
                  <img
                    src={avatarUrl}
                    alt={`Avatar ${idx + 1}`}
                    referrerPolicy="no-referrer"
                    className="w-full h-full object-cover"
                  />
                </button>
              ))}
            </div>

            <div className="pt-2 text-center">
              <button
                type="button"
                onClick={() => setShowPresetModal(false)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Name Change Request Modal */}
      {showNameChangeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#181b24] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <UserIcon size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Request Name Change
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Submit a new display name for Admin approval
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowNameChangeModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitNameChangeRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Current Name
                </label>
                <input
                  type="text"
                  value={user.name}
                  disabled
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-900 text-sm font-medium text-slate-500 cursor-not-allowed"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Desired New Name *
                </label>
                <input
                  type="text"
                  value={requestedName}
                  onChange={(e) => setRequestedName(e.target.value)}
                  placeholder="e.g. Kailash Kumar"
                  required
                  autoFocus
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Request (Optional)
                </label>
                <textarea
                  value={nameChangeReason}
                  onChange={(e) => setNameChangeReason(e.target.value)}
                  placeholder="Explain why you would like to change your display name..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowNameChangeModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingNameReq || !requestedName.trim()}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {isSubmittingNameReq ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Password Reset Request Modal */}
      {showPasswordReqModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white dark:bg-[#181b24] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                  <KeyRound size={18} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 dark:text-white">
                    Request Password Change
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Send password reset request to administrator
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPasswordReqModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmitPasswordRequest} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 mb-1">
                  Your Account
                </label>
                <p className="text-xs font-mono font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/50 p-2.5 rounded-xl border border-indigo-200 dark:border-indigo-800">
                  {user.name} ({formatChatCodeDisplay(user.chatCode)})
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  Reason for Password Change (Optional)
                </label>
                <textarea
                  value={passwordReqReason}
                  onChange={(e) => setPasswordReqReason(e.target.value)}
                  placeholder="e.g. Forgot old password or security routine..."
                  rows={3}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-medium text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600 outline-hidden resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowPasswordReqModal(false)}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPasswordReq}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs disabled:opacity-60 cursor-pointer"
                >
                  {isSubmittingPasswordReq ? (
                    <Loader2 size={15} className="animate-spin" />
                  ) : (
                    <Send size={15} />
                  )}
                  <span>Submit Request</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
