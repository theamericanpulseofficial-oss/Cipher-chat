/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeContext';
import { ToastProvider, useToast } from './components/Toast';
import { AuthScreen } from './components/AuthScreen';
import { Sidebar } from './components/Sidebar';
import { DashboardView } from './components/DashboardView';
import { ChatsView } from './components/ChatsView';
import { ChatRoomView } from './components/ChatRoomView';
import { ProfileView } from './components/ProfileView';
import { WorldChatView } from './components/WorldChatView';
import { NewChatModal } from './components/NewChatModal';
import { AdminDashboard } from './components/AdminDashboard';
import { UserProfile, ChatConversation, NavTab } from './types';
import { subscribeToAuthState, logoutUser } from './services/authService';
import { subscribeToUserChats } from './services/chatService';
import { ShieldCheck, Loader2 } from 'lucide-react';

function MainApp() {
  const { theme } = useTheme();
  const { showToast } = useToast();

  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [currentTab, setCurrentTab] = useState<NavTab>('dashboard');
  const [activeChatId, setActiveChatId] = useState<string | null>(null);
  const [chats, setChats] = useState<ChatConversation[]>([]);
  const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
  const [isMobileScreen, setIsMobileScreen] = useState(false);
  const [isAdminView, setIsAdminView] = useState(false);

  // Monitor screen size for responsive mobile vs laptop view
  useEffect(() => {
    const checkScreen = () => {
      setIsMobileScreen(window.innerWidth < 768);
    };
    checkScreen();
    window.addEventListener('resize', checkScreen);
    return () => window.removeEventListener('resize', checkScreen);
  }, []);

  // Subscribe to Firebase Auth state
  useEffect(() => {
    const unsubscribe = subscribeToAuthState((user, profile) => {
      setCurrentUser(profile);
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Subscribe to real-time conversations when user is logged in
  useEffect(() => {
    if (!currentUser?.uid) {
      setChats([]);
      return;
    }

    const unsubscribe = subscribeToUserChats(
      currentUser.uid,
      (userChats) => {
        setChats(userChats);
      },
      (err) => {
        console.error('Error fetching chats:', err);
      }
    );

    return () => unsubscribe();
  }, [currentUser?.uid]);

  // Handle Logout
  const handleLogout = async () => {
    try {
      await logoutUser();
      setCurrentUser(null);
      setActiveChatId(null);
      setCurrentTab('dashboard');
      showToast('Successfully signed out.', 'info');
    } catch (err) {
      console.error(err);
      showToast('Error during logout.', 'error');
    }
  };

  // Open a specific chat room
  const handleOpenChat = (chatId: string) => {
    setActiveChatId(chatId);
    if (isMobileScreen) {
      // On mobile, show dedicated full screen chat view
      setCurrentTab('chats');
    } else {
      // On desktop, switch to chats split-view with this chat selected
      setCurrentTab('chats');
    }
  };

  // Calculate total unread messages
  const unreadTotal = currentUser
    ? chats.reduce((acc, c) => acc + (c.unreadCounts?.[currentUser.uid] || 0), 0)
    : 0;

  // Initial Auth Loading Screen
  if (authLoading) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center bg-[#f8fafc] dark:bg-[#0b0f19] text-slate-700 dark:text-slate-300 gap-4">
        <div className="w-12 h-12 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-lg animate-pulse">
          <ShieldCheck size={26} />
        </div>
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Loader2 size={18} className="animate-spin text-indigo-600 dark:text-indigo-400" />
          <span>Synchronizing UP1CHATBOX Session...</span>
        </div>
      </div>
    );
  }

  // Not logged in -> Show Login/Register Screen
  if (!currentUser) {
    return <AuthScreen onAuthSuccess={(profile) => setCurrentUser(profile)} />;
  }

  // Admin Dashboard Mode (Password 2026 accessed via secret triple click)
  if (isAdminView) {
    return (
      <AdminDashboard
        currentUser={currentUser}
        onExit={() => setIsAdminView(false)}
      />
    );
  }

  // Mobile dedicated chat room view
  const isMobileActiveChat = isMobileScreen && currentTab === 'chats' && activeChatId;

  return (
    <div className={`min-h-screen flex flex-col md:flex-row ${theme.bgPage} font-sans selection:bg-indigo-500 selection:text-white`}>
      {/* Sidebar Navigation (Desktop sidebar + Mobile Top & Bottom Navigation) */}
      {!isMobileActiveChat && (
        <Sidebar
          currentTab={currentTab}
          onTabChange={(tab) => {
            setCurrentTab(tab);
            if (tab !== 'chats') {
              setActiveChatId(null);
            }
          }}
          user={currentUser}
          unreadTotal={unreadTotal}
          onLogout={handleLogout}
          onOpenNewChatModal={() => setIsNewChatModalOpen(true)}
        />
      )}

      {/* Main Content Area */}
      <main className={`flex-1 min-w-0 ${isMobileActiveChat ? 'h-[100dvh] overflow-hidden' : 'pb-20 md:pb-0 overflow-y-auto'}`}>
        {/* On Mobile: When active chat is opened, show full-screen ChatRoomView */}
        {isMobileActiveChat && activeChatId ? (
          <ChatRoomView
            chatId={activeChatId}
            currentUser={currentUser}
            chats={chats}
            onBack={() => setActiveChatId(null)}
          />
        ) : (
          <>
            {currentTab === 'dashboard' && (
              <DashboardView
                user={currentUser}
                chats={chats}
                onOpenChat={handleOpenChat}
                onNavigate={(tab) => {
                  setCurrentTab(tab);
                  if (tab !== 'chats') setActiveChatId(null);
                }}
              />
            )}

            {currentTab === 'chats' && (
              <ChatsView
                user={currentUser}
                chats={chats}
                activeChatId={activeChatId}
                onOpenChat={(chatId) => setActiveChatId(chatId)}
                onOpenNewChatModal={() => setIsNewChatModalOpen(true)}
              />
            )}

            {currentTab === 'world' && (
              <WorldChatView currentUser={currentUser} />
            )}

            {currentTab === 'profile' && (
              <ProfileView
                user={currentUser}
                chats={chats}
                onLogout={handleLogout}
                onProfileUpdated={(updated) => {
                  setCurrentUser((prev) => (prev ? { ...prev, ...updated } : null));
                }}
                onEnterAdmin={() => setIsAdminView(true)}
              />
            )}
          </>
        )}
      </main>

      {/* Connect with friend modal dialog */}
      <NewChatModal
        currentUser={currentUser}
        isOpen={isNewChatModalOpen}
        onClose={() => setIsNewChatModalOpen(false)}
        onChatCreated={(chatId) => {
          setActiveChatId(chatId);
          setCurrentTab('chats');
        }}
      />
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <MainApp />
      </ToastProvider>
    </ThemeProvider>
  );
}
