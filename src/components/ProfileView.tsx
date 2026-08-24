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
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { UserProfile, ChatConversation } from '../types';
import { useTheme } from '../context/ThemeContext';
import { useToast } from './Toast';
import { formatChatCodeDisplay } from '../services/chatService';
import { updateUserProfile } from '../services/authService';
import { UserAvatar } from './UserAvatar';
import { compressImageFile, PRESET_AVATARS } from '../utils/imageUtils';

interface ProfileViewProps {
  user: UserProfile;
  chats: ChatConversation[];
  onLogout: () => void;
  onProfileUpdated?: (updated: Partial<UserProfile>) => void;
}

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  chats,
  onLogout,
  onProfileUpdated
}) => {
  const { theme, themeMode, setThemeMode, soundEnabled, setSoundEnabled } = useTheme();
  const { showToast } = useToast();

  const [copied, setCopied] = useState(false);
  const [name, setName] = useState(user.name);
  const [bio, setBio] = useState(user.bio || '');
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [showPresetModal, setShowPresetModal] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

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

  // Handle Photo File Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploadingPhoto(true);
    try {
      const compressedBase64 = await compressImageFile(file, 300, 0.85);
      await updateUserProfile(user.uid, { photoURL: compressedBase64 });
      user.photoURL = compressedBase64;
      onProfileUpdated?.({ photoURL: compressedBase64 });
      showToast('Profile photo updated successfully!', 'success');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to upload photo';
      showToast(msg, 'error');
    } finally {
      setIsUploadingPhoto(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
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

  // Save Name & Bio
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      showToast('Name cannot be empty', 'error');
      return;
    }

    setIsSaving(true);
    try {
      await updateUserProfile(user.uid, {
        name: name.trim(),
        bio: bio.trim()
      });
      user.name = name.trim();
      user.bio = bio.trim();
      onProfileUpdated?.({ name: name.trim(), bio: bio.trim() });
      showToast('Profile details saved successfully!', 'success');
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to save profile changes.';
      showToast(msg, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const memberSince = new Date(user.createdAt || Date.now()).toLocaleDateString([], {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white">
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
        onChange={handlePhotoUpload}
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
                <h3 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                  {user.name}
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center justify-center sm:justify-start gap-1.5 mt-0.5">
                  <Calendar size={13} />
                  <span>Member since {memberSince}</span>
                </p>
              </div>

              <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 flex items-center justify-center gap-1.5 self-center sm:self-auto">
                <Shield size={12} />
                <span>Verified Account</span>
              </span>
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
                <Upload size={14} />
                <span>Upload Custom Photo</span>
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
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                Display Name
              </label>
              <input
                type="text"
                id="input-profile-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={`w-full px-3.5 py-2.5 rounded-xl border ${theme.inputBg} ${theme.inputBorder} text-sm font-medium`}
                placeholder="Enter your display name"
                required
              />
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

          <div className="flex justify-end">
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
          <span>Sign Out of CipherChat</span>
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
    </div>
  );
};
