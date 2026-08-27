import React, { useState, useEffect, useRef } from 'react';
import {
  ShieldAlert,
  Users,
  MessageSquare,
  KeyRound,
  Ban,
  CheckCircle,
  XCircle,
  Eye,
  Trash2,
  Plus,
  Search,
  Lock,
  Mic,
  Image as ImageIcon,
  Send,
  Sparkles,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  UserCheck,
  UserX,
  Volume2,
  VolumeX,
  FileText,
  UserPlus,
  Edit2,
  Check
} from 'lucide-react';
import { UserProfile, ChatConversation, ChatMessage, GroupRequest, PasswordResetRequest, NameChangeRequest } from '../types';
import { useToast } from './Toast';
import {
  getAllUsers,
  getAllConversations,
  setUserModerationStatus,
  adminChangeUserPassword,
  createAdminGroupChat,
  addMemberToGroup,
  removeMemberFromGroup,
  deleteAdminGroup,
  subscribeToGroupRequests,
  approveGroupRequest,
  rejectGroupRequest,
  subscribeToPasswordRequests,
  resolvePasswordRequest,
  approvePasswordRequest,
  rejectPasswordRequest,
  setUserVerifiedStatus,
  setNameChangeLock,
  adminUpdateUserName,
  deleteUserAccount,
  deletePasswordRequest,
  deleteGroupRequest,
  subscribeToNameChangeRequests,
  approveNameChangeRequest,
  rejectNameChangeRequest,
  deleteNameChangeRequest,
  subscribeToAdminLockState,
  toggleAdminLockState
} from '../services/adminService';
import { subscribeToChatMessages, formatChatCodeDisplay } from '../services/chatService';
import { UserAvatar, VerifiedBadge } from './UserAvatar';
import { VoiceMessagePlayer } from './VoiceMessagePlayer';
import { ImageLightboxModal } from './ImageLightboxModal';

interface AdminDashboardProps {
  currentUser: UserProfile;
  onExit: () => void;
}

type AdminTab = 'chats' | 'users' | 'groups' | 'passwords' | 'names';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ currentUser, onExit }) => {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<AdminTab>('chats');
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [groupRequests, setGroupRequests] = useState<GroupRequest[]>([]);
  const [passwordRequests, setPasswordRequests] = useState<PasswordResetRequest[]>([]);
  const [nameRequests, setNameRequests] = useState<NameChangeRequest[]>([]);
  const [loading, setLoading] = useState(true);

  // Search filters
  const [userSearch, setUserSearch] = useState('');
  const [chatSearch, setChatSearch] = useState('');

  // Selected chat for surveillance/eavesdrop
  const [selectedChat, setSelectedChat] = useState<ChatConversation | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [loadingMessages, setLoadingMessages] = useState(false);

  // Modals state
  const [passwordModalUser, setPasswordModalUser] = useState<UserProfile | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState('');
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  // Rename user modal state
  const [renameModalUser, setRenameModalUser] = useState<UserProfile | null>(null);
  const [renameInput, setRenameInput] = useState('');
  const [isSavingRename, setIsSavingRename] = useState(false);

  // Group creation modal
  const [showCreateGroupModal, setShowCreateGroupModal] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [groupDescInput, setGroupDescInput] = useState('');
  const [selectedMemberUids, setSelectedMemberUids] = useState<string[]>([]);
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);

  // Add member to group modal
  const [targetGroupForMember, setTargetGroupForMember] = useState<ChatConversation | null>(null);
  const [userToAddUid, setUserToAddUid] = useState('');

  // Lightbox for photos in surveillance
  const [surveillanceLightbox, setSurveillanceLightbox] = useState<{
    url: string;
    senderName?: string;
    caption?: string;
  } | null>(null);

  const [isAdminLocked, setIsAdminLocked] = useState(false);
  const badgeClickCountRef = useRef(0);
  const lastBadgeClickTimeRef = useRef(0);

  // Subscribe to global Admin Lock State
  useEffect(() => {
    const unsubLock = subscribeToAdminLockState((isLocked) => {
      setIsAdminLocked(isLocked);
    });
    return () => unsubLock();
  }, []);

  // Triple Click on AUTHORITATIVE Badge to Toggle Admin Access Block/Open
  const handleAuthoritativeBadgeTripleClick = async () => {
    const normalizedName = (currentUser.name || '').trim().toLowerCase();
    if (normalizedName !== 'kailash') {
      showToast('Only Master Admin "Kailash" can toggle Admin Access Lock.', 'error');
      return;
    }

    const now = Date.now();
    if (now - lastBadgeClickTimeRef.current > 1500) {
      badgeClickCountRef.current = 1;
    } else {
      const nextCount = badgeClickCountRef.current + 1;
      badgeClickCountRef.current = nextCount;
      if (nextCount >= 3) {
        badgeClickCountRef.current = 0;
        try {
          const nextState = await toggleAdminLockState(currentUser.name);
          if (nextState) {
            showToast('🔴 Admin access BLOCKED for everyone! Only Kailash can access.', 'error');
          } else {
            showToast('🟢 Admin access UNLOCKED & OPEN for everyone with PIN 2026!', 'success');
          }
        } catch (err) {
          console.error(err);
          showToast('Failed to toggle admin lock state', 'error');
        }
      }
    }
    lastBadgeClickTimeRef.current = now;
  };

  // Load initial data
  const loadPlatformData = async () => {
    setLoading(true);
    try {
      const [uList, cList] = await Promise.all([
        getAllUsers(),
        getAllConversations()
      ]);
      setUsers(uList);
      setConversations(cList);
    } catch (err) {
      console.error(err);
      showToast('Error loading platform data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPlatformData();

    // Subscribe to live group creation requests
    const unsubGroup = subscribeToGroupRequests((reqs) => {
      setGroupRequests(reqs);
    });

    // Subscribe to live password change requests
    const unsubPwd = subscribeToPasswordRequests((reqs) => {
      setPasswordRequests(reqs);
    });

    // Subscribe to live name change requests
    const unsubName = subscribeToNameChangeRequests((reqs) => {
      setNameRequests(reqs);
    });

    return () => {
      unsubGroup();
      unsubPwd();
      unsubName();
    };
  }, []);

  // Subscribe to messages of selected monitored chat
  useEffect(() => {
    if (!selectedChat) {
      setChatMessages([]);
      return;
    }

    setLoadingMessages(true);
    const unsubscribe = subscribeToChatMessages(
      selectedChat.id,
      (msgs) => {
        setChatMessages(msgs);
        setLoadingMessages(false);
      },
      (err) => {
        console.error(err);
        setLoadingMessages(false);
      }
    );

    return () => unsubscribe();
  }, [selectedChat?.id]);

  // Create lookup dictionary of users
  const usersMap = React.useMemo(() => {
    const map: Record<string, UserProfile> = {};
    users.forEach((u) => {
      map[u.uid] = u;
    });
    return map;
  }, [users]);

  // Toggle Ban / Unban
  const handleToggleBan = async (user: UserProfile) => {
    const newStatus = !user.isBanned;
    try {
      await setUserModerationStatus(user.uid, { isBanned: newStatus });
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, isBanned: newStatus } : u))
      );
      showToast(
        newStatus ? `Account for ${user.name} has been BANNED.` : `Account for ${user.name} UNBANNED.`,
        newStatus ? 'error' : 'success'
      );
    } catch (err) {
      console.error(err);
      showToast('Failed to update ban status', 'error');
    }
  };

  // Toggle Text Messaging
  const handleToggleMessaging = async (user: UserProfile) => {
    const newStatus = !user.messagingDisabled;
    try {
      await setUserModerationStatus(user.uid, { messagingDisabled: newStatus });
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, messagingDisabled: newStatus } : u))
      );
      showToast(
        newStatus ? `Text messaging disabled for ${user.name}` : `Text messaging enabled for ${user.name}`,
        'info'
      );
    } catch (err) {
      console.error(err);
      showToast('Failed to update messaging permission', 'error');
    }
  };

  // Toggle Voice Messaging
  const handleToggleVoice = async (user: UserProfile) => {
    const newStatus = !user.voiceDisabled;
    try {
      await setUserModerationStatus(user.uid, { voiceDisabled: newStatus });
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, voiceDisabled: newStatus } : u))
      );
      showToast(
        newStatus ? `Voice notes disabled for ${user.name}` : `Voice notes enabled for ${user.name}`,
        'info'
      );
    } catch (err) {
      console.error(err);
      showToast('Failed to update voice permission', 'error');
    }
  };

  // Toggle Photo Sharing
  const handleTogglePhotos = async (user: UserProfile) => {
    const newStatus = !user.photosDisabled;
    try {
      await setUserModerationStatus(user.uid, { photosDisabled: newStatus });
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, photosDisabled: newStatus } : u))
      );
      showToast(
        newStatus ? `Photo sharing disabled for ${user.name}` : `Photo sharing enabled for ${user.name}`,
        'info'
      );
    } catch (err) {
      console.error(err);
      showToast('Failed to update photo permission', 'error');
    }
  };

  // Toggle Verified WhatsApp Blue Tick
  const handleToggleVerified = async (user: UserProfile) => {
    const newStatus = !user.isVerified;
    try {
      await setUserVerifiedStatus(user.uid, newStatus);
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, isVerified: newStatus } : u))
      );
      showToast(
        newStatus
          ? `Verified Blue Tick granted to ${user.name}!`
          : `Verified status removed from ${user.name}.`,
        'success'
      );
    } catch (err) {
      console.error(err);
      showToast('Failed to update verified status', 'error');
    }
  };

  // Toggle Name Change Lock
  const handleToggleNameLock = async (user: UserProfile) => {
    const newStatus = !user.isNameChangeLocked;
    try {
      await setNameChangeLock(user.uid, newStatus);
      setUsers((prev) =>
        prev.map((u) => (u.uid === user.uid ? { ...u, isNameChangeLocked: newStatus } : u))
      );
      showToast(
        newStatus
          ? `Name change locked for ${user.name}.`
          : `Name change unlocked for ${user.name}.`,
        'info'
      );
    } catch (err) {
      console.error(err);
      showToast('Failed to toggle name lock', 'error');
    }
  };

  // Admin Save User Rename
  const handleSaveUserRename = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renameModalUser || !renameInput.trim()) return;
    setIsSavingRename(true);
    try {
      await adminUpdateUserName(renameModalUser.uid, renameInput.trim());
      setUsers((prev) =>
        prev.map((u) => (u.uid === renameModalUser.uid ? { ...u, name: renameInput.trim() } : u))
      );
      showToast(`User renamed to "${renameInput.trim()}"!`, 'success');
      setRenameModalUser(null);
      setRenameInput('');
    } catch (err) {
      console.error(err);
      showToast('Failed to rename user', 'error');
    } finally {
      setIsSavingRename(false);
    }
  };

  // Admin Permanently Delete User Account
  const handleDeleteUserAccount = async (user: UserProfile) => {
    if (!confirm(`Are you sure you want to PERMANENTLY delete user account "${user.name}" (${user.chatCode})? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteUserAccount(user.uid);
      setUsers((prev) => prev.filter((u) => u.uid !== user.uid));
      showToast(`User account for ${user.name} was permanently deleted.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete user account', 'error');
    }
  };

  // Delete Password Request
  const handleDeletePasswordReq = async (reqId: string) => {
    try {
      await deletePasswordRequest(reqId);
      setPasswordRequests((prev) => prev.filter((r) => r.id !== reqId));
      showToast('Password request deleted from database.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete request', 'error');
    }
  };

  // Delete Group Request
  const handleDeleteGroupReq = async (reqId: string) => {
    try {
      await deleteGroupRequest(reqId);
      setGroupRequests((prev) => prev.filter((r) => r.id !== reqId));
      showToast('Group request deleted from database.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete group request', 'error');
    }
  };

  // Change Password
  const handleSaveUserPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordModalUser || !newPasswordInput.trim()) return;
    if (newPasswordInput.trim().length < 4) {
      showToast('Password must be at least 4 characters', 'error');
      return;
    }

    setIsSavingPassword(true);
    try {
      await adminChangeUserPassword(passwordModalUser.uid, newPasswordInput.trim());
      showToast(`Password updated for ${passwordModalUser.name}!`, 'success');
      setPasswordModalUser(null);
      setNewPasswordInput('');
    } catch (err) {
      console.error(err);
      showToast('Failed to change password', 'error');
    } finally {
      setIsSavingPassword(false);
    }
  };

  // Create Group Chat
  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!groupNameInput.trim()) {
      showToast('Group name is required', 'error');
      return;
    }

    setIsCreatingGroup(true);
    try {
      const selectedMembers = users.filter((u) => selectedMemberUids.includes(u.uid));
      const newGroup = await createAdminGroupChat(
        groupNameInput.trim(),
        groupDescInput.trim(),
        selectedMembers,
        currentUser
      );
      setConversations((prev) => [newGroup, ...prev]);
      setShowCreateGroupModal(false);
      setGroupNameInput('');
      setGroupDescInput('');
      setSelectedMemberUids([]);
      showToast(`Group "${groupNameInput}" created successfully!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to create group', 'error');
    } finally {
      setIsCreatingGroup(false);
    }
  };

  // Approve Group Request
  const handleApproveGroupReq = async (req: GroupRequest) => {
    try {
      await approveGroupRequest(req, usersMap, currentUser);
      showToast(`Group "${req.groupName}" approved and created!`, 'success');
      loadPlatformData();
    } catch (err) {
      console.error(err);
      showToast('Failed to approve group request', 'error');
    }
  };

  // Reject Group Request
  const handleRejectGroupReq = async (reqId: string) => {
    try {
      await rejectGroupRequest(reqId);
      showToast('Group request declined.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to decline request', 'error');
    }
  };

  // Resolve Password Request (Direct set by Admin)
  const handleResolvePasswordReq = async (req: PasswordResetRequest, customPass: string) => {
    if (!customPass || customPass.length < 4) {
      showToast('Please enter a valid password (min 4 characters)', 'error');
      return;
    }
    try {
      await resolvePasswordRequest(req.id, req.userId, customPass);
      showToast(`Password for ${req.userName} reset to "${customPass}"!`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to reset password', 'error');
    }
  };

  // Approve Password Request (Allow user to set their new password in profile)
  const handleApprovePasswordReq = async (reqId: string, userName: string) => {
    try {
      await approvePasswordRequest(reqId);
      showToast(`Approved! ${userName} can now set their new password from their profile.`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to approve password request', 'error');
    }
  };

  // Reject Password Request
  const handleRejectPasswordReq = async (reqId: string) => {
    try {
      await rejectPasswordRequest(reqId);
      showToast('Password request rejected', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to reject password request', 'error');
    }
  };

  // Approve Name Change Request
  const handleApproveNameReq = async (req: NameChangeRequest) => {
    try {
      await approveNameChangeRequest(req.id, req.userId, req.requestedName);
      setUsers((prev) =>
        prev.map((u) => (u.uid === req.userId ? { ...u, name: req.requestedName } : u))
      );
      showToast(`Name for ${req.currentName} updated to "${req.requestedName}"!`, 'success');
      loadPlatformData();
    } catch (err) {
      console.error(err);
      showToast('Failed to approve name change', 'error');
    }
  };

  // Reject Name Change Request
  const handleRejectNameReq = async (reqId: string) => {
    try {
      await rejectNameChangeRequest(reqId);
      showToast('Name change request rejected', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to reject request', 'error');
    }
  };

  // Delete Name Change Request
  const handleDeleteNameReq = async (reqId: string) => {
    try {
      await deleteNameChangeRequest(reqId);
      showToast('Name change request record deleted', 'info');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete request', 'error');
    }
  };

  // Add Member to Group
  const handleAddMemberToTargetGroup = async () => {
    if (!targetGroupForMember || !userToAddUid) return;
    const memberToAdd = usersMap[userToAddUid];
    if (!memberToAdd) return;

    try {
      await addMemberToGroup(targetGroupForMember.id, memberToAdd);
      showToast(`${memberToAdd.name} added to group!`, 'success');
      setTargetGroupForMember(null);
      setUserToAddUid('');
      loadPlatformData();
    } catch (err: unknown) {
      console.error(err);
      const msg = err instanceof Error ? err.message : 'Failed to add member';
      showToast(msg, 'error');
    }
  };

  // Remove Member from Group
  const handleRemoveMemberFromTargetGroup = async (groupId: string, memberUid: string, memberName: string) => {
    try {
      await removeMemberFromGroup(groupId, memberUid, memberName);
      showToast(`${memberName} removed from group`, 'info');
      loadPlatformData();
    } catch (err) {
      console.error(err);
      showToast('Failed to remove member', 'error');
    }
  };

  // Delete Group
  const handleDeleteGroup = async (groupId: string, groupName: string) => {
    if (!confirm(`Are you sure you want to permanently delete the group "${groupName}"?`)) return;
    try {
      await deleteAdminGroup(groupId);
      setConversations((prev) => prev.filter((c) => c.id !== groupId));
      if (selectedChat?.id === groupId) setSelectedChat(null);
      showToast(`Group "${groupName}" deleted`, 'success');
    } catch (err) {
      console.error(err);
      showToast('Failed to delete group', 'error');
    }
  };

  const pendingGroupReqsCount = groupRequests.filter((r) => r.status === 'pending').length;
  const pendingPasswordReqsCount = passwordRequests.filter((r) => r.status === 'pending').length;
  const pendingNameReqsCount = nameRequests.filter((r) => r.status === 'pending').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-600 selection:text-white">
      {/* Lightbox Modal */}
      {surveillanceLightbox && (
        <ImageLightboxModal
          imageUrl={surveillanceLightbox.url}
          senderName={surveillanceLightbox.senderName}
          caption={surveillanceLightbox.caption}
          onClose={() => setSurveillanceLightbox(null)}
        />
      )}

      {/* Direct Password Reset Modal */}
      {passwordModalUser && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <KeyRound size={22} />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  Reset Password for {passwordModalUser.name}
                </h3>
                <p className="text-xs text-slate-400">
                  Chat Code: {formatChatCodeDisplay(passwordModalUser.chatCode)}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveUserPassword} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Set New Password
                </label>
                <input
                  type="text"
                  value={newPasswordInput}
                  onChange={(e) => setNewPasswordInput(e.target.value)}
                  placeholder="Enter new password (e.g. 123456 or securepass)"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white font-mono text-sm focus:outline-hidden focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setPasswordModalUser(null);
                    setNewPasswordInput('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingPassword}
                  className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingPassword ? 'Updating...' : 'Set Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Rename User Modal */}
      {renameModalUser && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Edit2 size={22} />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">
                  Change Name for {renameModalUser.name}
                </h3>
                <p className="text-xs text-slate-400">
                  Chat Code: {formatChatCodeDisplay(renameModalUser.chatCode)}
                </p>
              </div>
            </div>

            <form onSubmit={handleSaveUserRename} className="space-y-4 pt-2">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  New Display Name
                </label>
                <input
                  type="text"
                  value={renameInput}
                  onChange={(e) => setRenameInput(e.target.value)}
                  placeholder="Enter new username"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-hidden focus:border-indigo-500"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setRenameModalUser(null);
                    setRenameInput('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingRename}
                  className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isSavingRename ? 'Saving...' : 'Update Name'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Modal */}
      {showCreateGroupModal && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <Users size={22} />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Create New Group Chat</h3>
                <p className="text-xs text-slate-400">
                  Admin authoritative group creation & member assignment
                </p>
              </div>
            </div>

            <form onSubmit={handleCreateGroup} className="space-y-4 pt-1">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Group Name
                </label>
                <input
                  type="text"
                  value={groupNameInput}
                  onChange={(e) => setGroupNameInput(e.target.value)}
                  placeholder="e.g. VIP Alpha Team or Project Core"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-hidden focus:border-indigo-500"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Group Description / Purpose
                </label>
                <input
                  type="text"
                  value={groupDescInput}
                  onChange={(e) => setGroupDescInput(e.target.value)}
                  placeholder="e.g. Official encrypted team channel"
                  className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-hidden focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">
                  Select Initial Members ({selectedMemberUids.length} selected)
                </label>
                <div className="max-h-48 overflow-y-auto rounded-xl border border-slate-800 bg-slate-950 p-2 space-y-1 divide-y divide-slate-900">
                  {users.map((u) => {
                    const isSelected = selectedMemberUids.includes(u.uid);
                    return (
                      <div
                        key={u.uid}
                        onClick={() => {
                          setSelectedMemberUids((prev) =>
                            isSelected ? prev.filter((id) => id !== u.uid) : [...prev, u.uid]
                          );
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          isSelected ? 'bg-indigo-950/60 border border-indigo-800/60' : 'hover:bg-slate-900'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <UserAvatar
                            name={u.name}
                            photoURL={u.photoURL}
                            avatarColor={u.avatarColor}
                            avatarIcon={u.avatarIcon}
                            size="sm"
                          />
                          <div>
                            <p className="text-xs font-bold text-white">{u.name}</p>
                            <p className="text-[10px] text-slate-400 font-mono">
                              {formatChatCodeDisplay(u.chatCode)}
                            </p>
                          </div>
                        </div>

                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}}
                          className="accent-indigo-600 rounded"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowCreateGroupModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isCreatingGroup}
                  className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingGroup ? 'Creating...' : 'Create Group'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Member to Group Modal */}
      {targetGroupForMember && (
        <div className="fixed inset-0 z-[110] bg-black/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center shrink-0">
                <UserPlus size={22} />
              </div>
              <div>
                <h3 className="font-bold text-base text-white">Add Member to Group</h3>
                <p className="text-xs text-slate-400">{targetGroupForMember.groupName}</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400">
                Choose Registered User to Add
              </label>

              <select
                value={userToAddUid}
                onChange={(e) => setUserToAddUid(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl bg-slate-950 border border-slate-800 text-white text-sm focus:outline-hidden focus:border-indigo-500"
              >
                <option value="">-- Select User --</option>
                {users
                  .filter((u) => !targetGroupForMember.participantIds.includes(u.uid))
                  .map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.name} ({formatChatCodeDisplay(u.chatCode)})
                    </option>
                  ))}
              </select>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setTargetGroupForMember(null);
                    setUserToAddUid('');
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-400 hover:text-white rounded-xl cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="button"
                  disabled={!userToAddUid}
                  onClick={handleAddMemberToTargetGroup}
                  className="px-5 py-2.5 text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl shadow-lg transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  Add to Group
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top Admin Header */}
      <header className="px-4 sm:px-8 py-4 bg-slate-900/90 border-b border-slate-800 sticky top-0 z-30 backdrop-blur-md flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-2xl bg-indigo-600 text-white shadow-lg">
            <ShieldAlert size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg sm:text-xl font-black tracking-tight text-white">
                Admin Master Control
              </h1>
              {isAdminLocked ? (
                <button
                  type="button"
                  onClick={handleAuthoritativeBadgeTripleClick}
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-rose-950/90 text-rose-300 border border-rose-700/80 flex items-center gap-1.5 cursor-pointer select-none hover:border-rose-400 transition-all active:scale-95 shadow-xs"
                  title="Admin Access: BLOCKED for others (Click 3x to toggle unlock)"
                >
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-pulse shadow-sm shadow-rose-500" />
                  <span>AUTHORITATIVE [BLOCKED]</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAuthoritativeBadgeTripleClick}
                  className="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-950/90 text-emerald-300 border border-emerald-700/80 flex items-center gap-1.5 cursor-pointer select-none hover:border-emerald-400 transition-all active:scale-95 shadow-xs"
                  title="Admin Access: OPEN for PIN 2026 (Click 3x to toggle block)"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse shadow-sm shadow-emerald-400" />
                  <span>AUTHORITATIVE [OPEN]</span>
                </button>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Full real-time chat surveillance, user bans, permissions & group creation
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onExit}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-all cursor-pointer"
          >
            <ArrowLeft size={14} />
            <span>Exit Admin Panel</span>
          </button>
        </div>
      </header>

      {/* Quick Stat Counters Bar */}
      <div className="px-4 sm:px-8 py-3 bg-slate-900/40 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-4 text-xs">
        <div className="flex items-center gap-6 overflow-x-auto py-1">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Total Users:</span>
            <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md font-mono">
              {users.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">All Chats:</span>
            <span className="font-bold text-white bg-slate-800 px-2 py-0.5 rounded-md font-mono">
              {conversations.length}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Groups:</span>
            <span className="font-bold text-indigo-400 bg-indigo-950/60 border border-indigo-800/40 px-2 py-0.5 rounded-md font-mono">
              {conversations.filter((c) => c.isGroup).length}
            </span>
          </div>

          {pendingGroupReqsCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-amber-400 font-bold">Group Requests:</span>
              <span className="font-bold text-white bg-amber-600 px-2 py-0.5 rounded-md font-mono animate-pulse">
                {pendingGroupReqsCount} Pending
              </span>
            </div>
          )}

          {pendingPasswordReqsCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-rose-400 font-bold">Password Requests:</span>
              <span className="font-bold text-white bg-rose-600 px-2 py-0.5 rounded-md font-mono animate-pulse">
                {pendingPasswordReqsCount} Pending
              </span>
            </div>
          )}

          {pendingNameReqsCount > 0 && (
            <div className="flex items-center gap-2">
              <span className="text-purple-400 font-bold">Name Requests:</span>
              <span className="font-bold text-white bg-purple-600 px-2 py-0.5 rounded-md font-mono animate-pulse">
                {pendingNameReqsCount} Pending
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={loadPlatformData}
            className="text-[11px] text-indigo-400 hover:text-indigo-300 underline cursor-pointer"
          >
            Refresh Data
          </button>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="px-4 sm:px-8 pt-4 pb-2 border-b border-slate-800 bg-slate-950 flex items-center gap-2 overflow-x-auto">
        <button
          type="button"
          onClick={() => {
            setActiveTab('chats');
            setSelectedChat(null);
          }}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'chats'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
        >
          <Eye size={15} />
          <span>All User Chats (Spy / Monitor)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('groups')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeTab === 'groups'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
        >
          <Users size={15} />
          <span>Group Management</span>
          {pendingGroupReqsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('users')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            activeTab === 'users'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
        >
          <UserCheck size={15} />
          <span>User Accounts & Permissions</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('passwords')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeTab === 'passwords'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
        >
          <KeyRound size={15} />
          <span>Password Requests ({pendingPasswordReqsCount})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('names')}
          className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer relative ${
            activeTab === 'names'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-850'
          }`}
        >
          <FileText size={15} />
          <span>Name Requests ({pendingNameReqsCount})</span>
          {pendingNameReqsCount > 0 && (
            <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
          )}
        </button>
      </div>

      {/* Main Content Body */}
      <main className="flex-1 p-4 sm:p-8 max-w-7xl w-full mx-auto">
        {loading ? (
          <div className="py-24 text-center space-y-3">
            <Loader2 size={32} className="animate-spin text-indigo-500 mx-auto" />
            <p className="text-sm font-semibold text-slate-400">
              Synchronizing authoritative administrative telemetry...
            </p>
          </div>
        ) : (
          <>
            {/* TAB 1: ALL USER CHATS SURVEILLANCE & EAVESDROPPING */}
            {activeTab === 'chats' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-[calc(100vh-14rem)]">
                {/* Left: Chat list */}
                <div className="lg:col-span-5 flex flex-col h-full bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
                  <div className="p-4 border-b border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Eye size={16} className="text-indigo-400" />
                        <span>All Platform Conversations ({conversations.length})</span>
                      </h3>
                    </div>

                    <div className="relative">
                      <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                      <input
                        type="text"
                        value={chatSearch}
                        onChange={(e) => setChatSearch(e.target.value)}
                        placeholder="Search chats by participant or text..."
                        className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto divide-y divide-slate-800/80 p-2 space-y-1">
                    {conversations.length === 0 ? (
                      <div className="text-center py-12 text-xs text-slate-500">
                        No conversations found in the database
                      </div>
                    ) : (
                      conversations
                        .filter((c) => {
                          const pNames = Object.values(c.participants || {})
                            .map((p: any) => p?.name || '')
                            .join(' ');
                          const gName = c.groupName || '';
                          return (
                            pNames.toLowerCase().includes(chatSearch.toLowerCase()) ||
                            gName.toLowerCase().includes(chatSearch.toLowerCase()) ||
                            (c.lastMessage?.text || '').toLowerCase().includes(chatSearch.toLowerCase())
                          );
                        })
                        .map((chat) => {
                          const isSelected = selectedChat?.id === chat.id;
                          const participantNames = Object.values(chat.participants || {})
                            .map((p: any) => p?.name || 'User')
                            .join(' & ');

                          return (
                            <div
                              key={chat.id}
                              onClick={() => setSelectedChat(chat)}
                              className={`p-3 rounded-2xl cursor-pointer transition-all flex items-center justify-between gap-3 ${
                                isSelected
                                  ? 'bg-indigo-950/70 border border-indigo-700/80 shadow-md'
                                  : 'hover:bg-slate-850/60'
                              }`}
                            >
                              <div className="flex items-center gap-3 min-w-0 flex-1">
                                {chat.isGroup ? (
                                  <div className="w-10 h-10 rounded-2xl bg-violet-600/30 text-violet-400 border border-violet-500/40 flex items-center justify-center font-bold text-sm shrink-0">
                                    👥
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded-2xl bg-indigo-600/30 text-indigo-400 border border-indigo-500/40 flex items-center justify-center font-bold text-xs shrink-0">
                                    💬
                                  </div>
                                )}

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center justify-between gap-2 mb-0.5">
                                    <h4 className="text-xs font-bold text-white truncate">
                                      {chat.isGroup ? `[Group] ${chat.groupName}` : participantNames || 'Direct Chat'}
                                    </h4>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {new Date(chat.lastMessage?.timestamp || chat.updatedAt).toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                      })}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-slate-400 truncate">
                                    {chat.lastMessage?.text || 'No messages'}
                                  </p>
                                </div>
                              </div>

                              <Eye size={14} className={isSelected ? 'text-indigo-400' : 'text-slate-600'} />
                            </div>
                          );
                        })
                    )}
                  </div>
                </div>

                {/* Right: Live Spy Message Viewer */}
                <div className="lg:col-span-7 flex flex-col h-full bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden">
                  {selectedChat ? (
                    <>
                      {/* Monitored Chat Header */}
                      <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <h3 className="text-sm font-bold text-white">
                              {selectedChat.isGroup
                                ? `Group: ${selectedChat.groupName}`
                                : Object.values(selectedChat.participants || {})
                                    .map((p: any) => p?.name || 'User')
                                    .join(' ↔ ')}
                            </h3>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5 font-mono">
                            Chat ID: {selectedChat.id} • {selectedChat.participantIds.length} Participants
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-1 rounded-lg text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                            LIVE SPY
                          </span>
                        </div>
                      </div>

                      {/* Monitored Messages Area */}
                      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 bg-slate-950/40">
                        {loadingMessages ? (
                          <div className="py-16 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                            <Loader2 size={16} className="animate-spin text-indigo-500" />
                            <span>Loading encrypted transcript...</span>
                          </div>
                        ) : chatMessages.length === 0 ? (
                          <div className="text-center py-16 text-xs text-slate-500">
                            No messages recorded in this conversation yet
                          </div>
                        ) : (
                          chatMessages.map((msg) => (
                            <div
                              key={msg.id}
                              className="p-3 rounded-2xl bg-slate-900 border border-slate-800 space-y-1.5"
                            >
                              <div className="flex items-center justify-between text-[11px]">
                                <div className="flex items-center gap-2 font-bold text-indigo-300">
                                  <span>{msg.senderName || 'Sender'}</span>
                                  <span className="text-[10px] font-mono text-slate-500">
                                    (UID: {msg.senderId})
                                  </span>
                                </div>
                                <span className="text-slate-500 font-mono text-[10px]">
                                  {new Date(msg.timestamp).toLocaleString()}
                                </span>
                              </div>

                              {/* Photo */}
                              {msg.type === 'image' && msg.mediaUrl && (
                                <div className="space-y-1">
                                  <img
                                    src={msg.mediaUrl}
                                    alt="User photo"
                                    onClick={() =>
                                      setSurveillanceLightbox({
                                        url: msg.mediaUrl!,
                                        senderName: msg.senderName,
                                        caption: msg.text
                                      })
                                    }
                                    className="max-h-48 rounded-xl object-contain bg-black/40 cursor-pointer hover:opacity-90"
                                  />
                                  {msg.text && (
                                    <p className="text-xs text-slate-300">{msg.text}</p>
                                  )}
                                </div>
                              )}

                              {/* Audio voice note */}
                              {msg.type === 'audio' && msg.mediaUrl && (
                                <VoiceMessagePlayer
                                  audioUrl={msg.mediaUrl}
                                  duration={msg.mediaDuration}
                                  isSender={false}
                                />
                              )}

                              {/* Text */}
                              {(!msg.type || msg.type === 'text') && (
                                <p className="text-xs text-slate-200 whitespace-pre-wrap">
                                  {msg.text}
                                </p>
                              )}

                              {msg.isDeleted && (
                                <span className="inline-block text-[10px] text-rose-400 italic">
                                  [Marked deleted by user]
                                </span>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    </>
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-slate-500">
                      <Eye size={40} className="text-slate-700 mb-3" />
                      <h4 className="text-sm font-bold text-slate-300">
                        Select a Conversation to Monitor
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mt-1">
                        Click on any chat or group on the left to read all messages, shared photos, voice notes, and timestamps in real-time.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* TAB 2: GROUP MANAGEMENT */}
            {activeTab === 'groups' && (
              <div className="space-y-6">
                {/* Header & Create Group CTA */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-6 rounded-3xl border border-slate-800">
                  <div>
                    <h3 className="text-lg font-bold text-white">Group Chat Center</h3>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Create groups, approve user requests, add or remove members, and manage channels.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => setShowCreateGroupModal(true)}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md transition-all active:scale-95 cursor-pointer self-start sm:self-auto"
                  >
                    <Plus size={16} />
                    <span>Create New Group</span>
                  </button>
                </div>

                {/* Section A: Pending Group Requests */}
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-bold text-white flex items-center gap-2">
                      <Sparkles size={16} className="text-amber-400" />
                      <span>User Group Creation Requests ({pendingGroupReqsCount} Pending)</span>
                    </h4>
                  </div>

                  {groupRequests.length === 0 ? (
                    <p className="text-xs text-slate-500 py-4">No group requests submitted yet.</p>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {groupRequests.map((req) => (
                        <div
                          key={req.id}
                          className="p-4 rounded-2xl bg-slate-950 border border-slate-800 space-y-3"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <h5 className="text-sm font-bold text-white">{req.groupName}</h5>
                              <p className="text-[11px] text-slate-400">
                                Requested by <span className="font-bold text-indigo-400">{req.requesterName}</span>
                              </p>
                            </div>

                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                                req.status === 'approved'
                                  ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                                  : req.status === 'rejected'
                                  ? 'bg-rose-950 text-rose-300 border border-rose-800'
                                  : 'bg-amber-950 text-amber-300 border border-amber-800'
                              }`}
                            >
                              {req.status.toUpperCase()}
                            </span>
                          </div>

                          {req.description && (
                            <p className="text-xs text-slate-300 bg-slate-900/60 p-2 rounded-xl">
                              "{req.description}"
                            </p>
                          )}

                          <div className="flex items-center justify-between pt-1">
                            <button
                              type="button"
                              onClick={() => handleDeleteGroupReq(req.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
                              title="Delete request"
                            >
                              <Trash2 size={14} />
                            </button>

                            {req.status === 'pending' && (
                              <div className="flex items-center gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleRejectGroupReq(req.id)}
                                  className="px-3 py-1.5 rounded-xl text-xs font-bold text-rose-400 hover:bg-rose-950/40 cursor-pointer"
                                >
                                  Decline
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleApproveGroupReq(req)}
                                  className="inline-flex items-center gap-1 px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white cursor-pointer"
                                >
                                  <CheckCircle size={14} />
                                  <span>Approve & Create</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Section B: Active Groups List */}
                <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users size={16} className="text-indigo-400" />
                    <span>Active Groups ({conversations.filter((c) => c.isGroup).length})</span>
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {conversations
                      .filter((c) => c.isGroup)
                      .map((grp) => (
                        <div
                          key={grp.id}
                          className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h5 className="text-base font-bold text-white">{grp.groupName}</h5>
                              <p className="text-xs text-slate-400 mt-0.5">
                                {grp.groupDescription || 'No description provided'}
                              </p>
                              <span className="text-[10px] text-slate-500 font-mono mt-1 inline-block">
                                {grp.participantIds.length} Members
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleDeleteGroup(grp.id, grp.groupName || 'Group')}
                              className="p-2 rounded-xl text-rose-400 hover:bg-rose-950/50 cursor-pointer"
                              title="Delete Group"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Member List */}
                          <div className="space-y-1.5 pt-2 border-t border-slate-800">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                                Group Members
                              </span>
                              <button
                                type="button"
                                onClick={() => setTargetGroupForMember(grp)}
                                className="text-xs font-bold text-indigo-400 hover:text-indigo-300 cursor-pointer flex items-center gap-1"
                              >
                                <Plus size={13} />
                                <span>Add User</span>
                              </button>
                            </div>

                            <div className="flex flex-wrap gap-1.5 pt-1">
                              {grp.participantIds.map((uid) => {
                                const p = grp.participants[uid] || usersMap[uid] || { name: 'User' };
                                return (
                                  <div
                                    key={uid}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-slate-900 border border-slate-800 text-xs"
                                  >
                                    <span className="font-semibold text-slate-200">{p.name}</span>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveMemberFromTargetGroup(grp.id, uid, p.name)}
                                      className="text-slate-500 hover:text-rose-400 cursor-pointer"
                                      title="Remove from group"
                                    >
                                      ×
                                    </button>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}

            {/* TAB 3: USER ACCOUNTS & PERMISSIONS */}
            {activeTab === 'users' && (
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-white">Registered Users & Permissions</h3>
                    <p className="text-xs text-slate-400">
                      Manage bans, toggle text/voice/photos, or change passwords.
                    </p>
                  </div>

                  <div className="relative w-full sm:w-72">
                    <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                    <input
                      type="text"
                      value={userSearch}
                      onChange={(e) => setUserSearch(e.target.value)}
                      placeholder="Search by name or code..."
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs text-white focus:outline-hidden focus:border-indigo-500"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-slate-300">
                    <thead className="bg-slate-950/80 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
                      <tr>
                        <th className="py-3 px-4">User</th>
                        <th className="py-3 px-4">Chat Code</th>
                        <th className="py-3 px-4">Verified & Lock</th>
                        <th className="py-3 px-4">Account Status</th>
                        <th className="py-3 px-4">Permissions (Msg / Voice / Photo)</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {users
                        .filter(
                          (u) =>
                            u.name.toLowerCase().includes(userSearch.toLowerCase()) ||
                            u.chatCode.toLowerCase().includes(userSearch.toLowerCase())
                        )
                        .map((u) => {
                          const isBanned = u.isBanned;

                          return (
                            <tr key={u.uid} className="hover:bg-slate-850/40 transition-colors">
                              {/* User Info */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-3">
                                  <UserAvatar
                                    name={u.name}
                                    photoURL={u.photoURL}
                                    avatarColor={u.avatarColor}
                                    avatarIcon={u.avatarIcon}
                                    size="sm"
                                  />
                                  <div>
                                    <div className="flex items-center gap-1.5">
                                      <p className="font-bold text-white">{u.name}</p>
                                      {u.isVerified && <VerifiedBadge size={14} />}
                                    </div>
                                    <p className="text-[10px] text-slate-500 font-mono">{u.uid}</p>
                                  </div>
                                </div>
                              </td>

                              {/* Chat Code */}
                              <td className="py-3.5 px-4 font-mono font-bold text-indigo-400">
                                {formatChatCodeDisplay(u.chatCode)}
                              </td>

                              {/* Verified & Name Lock Controls */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  {/* Verified Badge Toggle */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleVerified(u)}
                                    title={u.isVerified ? 'Remove Verified Blue Tick' : 'Grant Verified Blue Tick'}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                      u.isVerified
                                        ? 'bg-sky-950/80 text-sky-400 border border-sky-800 hover:bg-sky-900/80'
                                        : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:text-white'
                                    }`}
                                  >
                                    <VerifiedBadge size={12} />
                                    <span>{u.isVerified ? 'Verified' : 'Unverified'}</span>
                                  </button>

                                  {/* Name Lock Toggle */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleNameLock(u)}
                                    title={u.isNameChangeLocked ? 'Unlock name changes' : 'Lock name changes (User cannot edit name)'}
                                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                      u.isNameChangeLocked
                                        ? 'bg-amber-950/80 text-amber-400 border border-amber-800 hover:bg-amber-900/80'
                                        : 'bg-slate-800/80 text-slate-400 border border-slate-700 hover:text-white'
                                    }`}
                                  >
                                    <Lock size={11} />
                                    <span>{u.isNameChangeLocked ? 'Name Locked' : 'Unlocked'}</span>
                                  </button>
                                </div>
                              </td>

                              {/* Account Status */}
                              <td className="py-3.5 px-4">
                                {isBanned ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-950 text-rose-300 border border-rose-800">
                                    <Ban size={11} />
                                    <span>BANNED</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    <UserCheck size={11} />
                                    <span>ACTIVE</span>
                                  </span>
                                )}
                              </td>

                              {/* Feature Toggles */}
                              <td className="py-3.5 px-4">
                                <div className="flex items-center gap-2">
                                  {/* Text toggle */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleMessaging(u)}
                                    title={u.messagingDisabled ? 'Enable text messages' : 'Disable text messages'}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                      u.messagingDisabled
                                        ? 'bg-rose-950/60 text-rose-400 border border-rose-800'
                                        : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                                    }`}
                                  >
                                    Msg: {u.messagingDisabled ? 'OFF' : 'ON'}
                                  </button>

                                  {/* Voice toggle */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleVoice(u)}
                                    title={u.voiceDisabled ? 'Enable voice notes' : 'Disable voice notes'}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                      u.voiceDisabled
                                        ? 'bg-rose-950/60 text-rose-400 border border-rose-800'
                                        : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                                    }`}
                                  >
                                    Voice: {u.voiceDisabled ? 'OFF' : 'ON'}
                                  </button>

                                  {/* Photo toggle */}
                                  <button
                                    type="button"
                                    onClick={() => handleTogglePhotos(u)}
                                    title={u.photosDisabled ? 'Enable photo sharing' : 'Disable photo sharing'}
                                    className={`px-2 py-1 rounded-lg text-[10px] font-bold cursor-pointer transition-colors ${
                                      u.photosDisabled
                                        ? 'bg-rose-950/60 text-rose-400 border border-rose-800'
                                        : 'bg-emerald-950/60 text-emerald-400 border border-emerald-800'
                                    }`}
                                  >
                                    Photo: {u.photosDisabled ? 'OFF' : 'ON'}
                                  </button>
                                </div>
                              </td>

                              {/* Actions */}
                              <td className="py-3.5 px-4 text-right">
                                <div className="flex items-center justify-end gap-1.5">
                                  {/* Rename user button */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setRenameModalUser(u);
                                      setRenameInput(u.name);
                                    }}
                                    title="Rename user"
                                    className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                                  >
                                    <Edit2 size={13} />
                                  </button>

                                  {/* Set Password */}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPasswordModalUser(u);
                                      setNewPasswordInput('');
                                    }}
                                    className="px-2.5 py-1.5 rounded-xl text-[11px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition-colors cursor-pointer"
                                  >
                                    Password
                                  </button>

                                  {/* Ban/Unban Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleToggleBan(u)}
                                    className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold transition-colors cursor-pointer ${
                                      isBanned
                                        ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                                        : 'bg-rose-600 hover:bg-rose-700 text-white'
                                    }`}
                                  >
                                    {isBanned ? 'Unban' : 'Ban'}
                                  </button>

                                  {/* Delete Account */}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUserAccount(u)}
                                    title="Permanently Delete User Account"
                                    className="p-1.5 rounded-xl text-slate-500 hover:text-rose-400 hover:bg-rose-950/40 border border-transparent hover:border-rose-900/60 transition-colors cursor-pointer"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* TAB 4: PASSWORD RESET REQUESTS */}
            {activeTab === 'passwords' && (
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                <div>
                  <h3 className="text-base font-bold text-white">Password Change Requests</h3>
                  <p className="text-xs text-slate-400">
                    Requests submitted by users for admin password override.
                  </p>
                </div>

                {passwordRequests.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">
                    No pending password change requests.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {passwordRequests.map((req) => (
                      <PasswordRequestCard
                        key={req.id}
                        req={req}
                        onApprove={() => handleApprovePasswordReq(req.id, req.userName)}
                        onReject={() => handleRejectPasswordReq(req.id)}
                        onResolve={(newPass) => handleResolvePasswordReq(req, newPass)}
                        onDelete={() => handleDeletePasswordReq(req.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* TAB 5: NAME CHANGE REQUESTS */}
            {activeTab === 'names' && (
              <div className="bg-slate-900 p-6 rounded-3xl border border-slate-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                      <FileText className="text-purple-400" size={20} />
                      <span>Display Name Change Requests</span>
                    </h3>
                    <p className="text-xs text-slate-400">
                      Requests submitted by users to update their verified display names.
                    </p>
                  </div>
                </div>

                {nameRequests.length === 0 ? (
                  <p className="text-xs text-slate-500 py-8 text-center">
                    No name change requests yet.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {nameRequests.map((req) => (
                      <NameRequestCard
                        key={req.id}
                        req={req}
                        onApprove={() => handleApproveNameReq(req)}
                        onReject={() => handleRejectNameReq(req.id)}
                        onDelete={() => handleDeleteNameReq(req.id)}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

// Subcomponent for Name Request Card
const NameRequestCard: React.FC<{
  req: NameChangeRequest;
  onApprove: () => void;
  onReject: () => void;
  onDelete: () => void;
}> = ({ req, onApprove, onReject, onDelete }) => {
  return (
    <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 line-through">{req.currentName}</span>
            <span className="text-xs text-slate-500">➔</span>
            <span className="text-sm font-bold text-white text-purple-300">{req.requestedName}</span>
          </div>
          <p className="text-[10px] text-slate-400 font-mono mt-0.5">
            Chat Code: {formatChatCodeDisplay(req.userChatCode)} • ID: {req.userId}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              req.status === 'approved'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : req.status === 'rejected'
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}
          >
            {req.status.toUpperCase()}
          </span>

          <button
            type="button"
            onClick={onDelete}
            title="Delete Request Record"
            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {req.reason && (
        <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl">
          Reason: "{req.reason}"
        </p>
      )}

      {req.status === 'pending' ? (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onReject}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-rose-300 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-800/60 transition-colors cursor-pointer"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={onApprove}
            className="px-4 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Check size={14} />
            <span>Approve & Rename</span>
          </button>
        </div>
      ) : req.status === 'approved' ? (
        <p className="text-[11px] text-emerald-400 font-semibold">
          ✓ Approved: User display name updated to "{req.requestedName}"
        </p>
      ) : (
        <p className="text-[11px] text-rose-400 font-semibold">
          ✕ Declined by Admin
        </p>
      )}
    </div>
  );
};

// Subcomponent for Password Request Card with inline password setter and approval flow
const PasswordRequestCard: React.FC<{
  req: PasswordResetRequest;
  onApprove: () => void;
  onReject: () => void;
  onResolve: (pass: string) => void;
  onDelete: () => void;
}> = ({ req, onApprove, onReject, onResolve, onDelete }) => {
  const [passInput, setPassInput] = useState('');

  return (
    <div className="p-5 rounded-2xl bg-slate-950 border border-slate-800 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-white">{req.userName}</h4>
          <p className="text-[10px] text-slate-400 font-mono">
            Chat Code: {formatChatCodeDisplay(req.userChatCode)} • ID: {req.userId}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              req.status === 'completed'
                ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                : req.status === 'approved'
                ? 'bg-blue-950 text-blue-300 border border-blue-800'
                : req.status === 'rejected'
                ? 'bg-rose-950 text-rose-300 border border-rose-800'
                : 'bg-amber-950 text-amber-300 border border-amber-800'
            }`}
          >
            {req.status.toUpperCase()}
          </span>

          <button
            type="button"
            onClick={onDelete}
            title="Delete Request"
            className="p-1 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {req.reason && (
        <p className="text-xs text-slate-300 bg-slate-900/60 p-2.5 rounded-xl">
          Reason: "{req.reason}"
        </p>
      )}

      {req.status === 'pending' ? (
        <div className="space-y-2.5 pt-1">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onApprove}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs cursor-pointer active:scale-95 transition-all"
            >
              <Check size={14} />
              <span>Approve (Allow User to Set)</span>
            </button>
            <button
              type="button"
              onClick={onReject}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold bg-rose-600/20 text-rose-300 hover:bg-rose-600/30 border border-rose-500/30 cursor-pointer active:scale-95 transition-all"
            >
              <XCircle size={14} />
              <span>Decline</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="text"
              value={passInput}
              onChange={(e) => setPassInput(e.target.value)}
              placeholder="Or direct set password here"
              className="flex-1 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-hidden"
            />
            <button
              type="button"
              disabled={!passInput.trim()}
              onClick={() => onResolve(passInput.trim())}
              className="px-3.5 py-1.5 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-700 text-white disabled:opacity-50 cursor-pointer shrink-0"
            >
              Set Direct
            </button>
          </div>
        </div>
      ) : req.status === 'approved' ? (
        <p className="text-[11px] text-blue-400 font-semibold">
          ✓ Approved: Waiting for user to submit their new password from Profile.
        </p>
      ) : req.status === 'rejected' ? (
        <p className="text-[11px] text-rose-400 font-semibold">
          ✕ Declined by Admin
        </p>
      ) : (
        <p className="text-[11px] text-emerald-400 font-semibold">
          ✓ Password successfully resolved & saved
        </p>
      )}
    </div>
  );
};
