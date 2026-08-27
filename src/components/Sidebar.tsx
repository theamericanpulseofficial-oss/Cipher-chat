import React from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  Globe,
  User as UserIcon,
  LogOut,
  ShieldCheck,
  Sun,
  Moon,
  Plus
} from 'lucide-react';
import { NavTab, UserProfile } from '../types';
import { useTheme } from '../context/ThemeContext';
import { formatChatCodeDisplay } from '../services/chatService';
import { UserAvatar, VerifiedBadge } from './UserAvatar';

interface SidebarProps {
  currentTab: NavTab;
  onTabChange: (tab: NavTab) => void;
  user: UserProfile;
  unreadTotal: number;
  onLogout: () => void;
  onOpenNewChatModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onTabChange,
  user,
  unreadTotal,
  onLogout,
  onOpenNewChatModal
}) => {
  const { theme, themeMode, toggleTheme } = useTheme();

  const navItems = [
    { id: 'dashboard' as NavTab, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'chats' as NavTab, label: 'Chats', icon: MessageSquare, badge: unreadTotal },
    { id: 'world' as NavTab, label: 'World Chat', icon: Globe },
    { id: 'profile' as NavTab, label: 'Profile', icon: UserIcon },
  ];

  return (
    <>
      {/* DESKTOP / LAPTOP SIDEBAR */}
      <aside
        id="desktop-sidebar"
        className={`hidden md:flex flex-col justify-between w-64 lg:w-72 min-h-screen border-r ${theme.borderSubtle} ${theme.bgPage} p-5 transition-colors shrink-0`}
      >
        {/* Brand & Theme Quick Toggle */}
        <div>
          <div className="flex items-center justify-between px-2 py-3 mb-6">
            <div
              className="flex items-center gap-3 cursor-pointer group"
              onClick={() => onTabChange('dashboard')}
            >
              <div className="w-9 h-9 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-sm group-hover:scale-105 transition-transform">
                <ShieldCheck size={20} />
              </div>
              <div>
                <h1 className="text-lg font-black tracking-tight text-slate-900 dark:text-white">
                  UP1CHATBOX
                </h1>
                <span className="text-[10px] uppercase font-bold tracking-widest text-indigo-600 dark:text-indigo-400 block -mt-1">
                  Encrypted
                </span>
              </div>
            </div>

            {/* Quick 1-click Light / Dark Mode Toggle */}
            <button
              type="button"
              id="desktop-theme-toggle"
              onClick={toggleTheme}
              title={`Switch to ${themeMode === 'dark' ? 'Light' : 'Dark'} Mode`}
              className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 transition-all cursor-pointer shadow-2xs hover:scale-105 active:scale-95"
            >
              {themeMode === 'dark' ? (
                <Sun size={17} className="text-amber-400" />
              ) : (
                <Moon size={17} className="text-indigo-600" />
              )}
            </button>
          </div>

          {/* New Chat Quick Button */}
          {onOpenNewChatModal && (
            <div className="mb-4">
              <button
                type="button"
                id="btn-desktop-new-chat"
                onClick={onOpenNewChatModal}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all shadow-xs active:scale-98 cursor-pointer"
              >
                <Plus size={16} />
                <span>New Connection</span>
              </button>
            </div>
          )}

          {/* Navigation Links */}
          <nav className="space-y-1.5" aria-label="Main Navigation">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentTab === item.id;

              return (
                <button
                  key={item.id}
                  id={`nav-link-${item.id}`}
                  onClick={() => onTabChange(item.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-indigo-600 text-white shadow-xs font-bold'
                      : `text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/50`
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon size={19} className={isActive ? 'text-white' : 'opacity-70'} />
                    <span>{item.label}</span>
                  </div>

                  {item.badge && item.badge > 0 ? (
                    <span
                      className={`px-2 py-0.5 text-xs font-bold rounded-full ${
                        isActive
                          ? 'bg-white text-indigo-700'
                          : 'bg-indigo-600 text-white'
                      }`}
                    >
                      {item.badge}
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Footer Area: User Profile Card & Logout */}
        <div className="pt-4 border-t border-slate-200 dark:border-slate-800/80 space-y-3">
          {/* User Profile Card */}
          <div
            id="sidebar-user-card"
            onClick={() => onTabChange('profile')}
            className="flex items-center gap-3 p-2.5 rounded-2xl bg-white dark:bg-slate-850 border border-slate-200/80 dark:border-slate-800 hover:border-indigo-400 dark:hover:border-slate-700 shadow-2xs transition-all cursor-pointer group"
          >
            <UserAvatar
              name={user.name}
              photoURL={user.photoURL}
              avatarColor={user.avatarColor}
              avatarIcon={user.avatarIcon}
              isVerified={user.isVerified}
              size="md"
              showOnlineStatus
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate text-slate-900 dark:text-white group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors flex items-center gap-1">
                <span>{user.name}</span>
                {user.isVerified && <VerifiedBadge size={14} />}
              </p>
              <p className="text-xs text-slate-400 font-mono truncate">
                Code: {formatChatCodeDisplay(user.chatCode)}
              </p>
            </div>
          </div>

          <button
            id="logout-sidebar-btn"
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 hover:text-rose-600 hover:bg-rose-50/80 dark:hover:bg-rose-950/30 transition-colors cursor-pointer"
          >
            <LogOut size={15} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MOBILE TOP BAR (Distinct Mobile App Experience) */}
      <header className="md:hidden sticky top-0 z-30 flex items-center justify-between px-4 py-3 bg-white/95 dark:bg-[#121622]/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800">
        <div
          className="flex items-center gap-2.5 cursor-pointer"
          onClick={() => onTabChange('dashboard')}
        >
          <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-xs">
            <ShieldCheck size={18} />
          </div>
          <span className="font-extrabold text-base text-slate-900 dark:text-white">
            UP1CHATBOX
          </span>
        </div>

        <div className="flex items-center gap-2">
          {/* Quick Theme Toggle on Mobile */}
          <button
            type="button"
            id="mobile-theme-toggle"
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
            title="Toggle theme"
          >
            {themeMode === 'dark' ? (
              <Sun size={16} className="text-amber-400" />
            ) : (
              <Moon size={16} className="text-indigo-600" />
            )}
          </button>

          {/* User Avatar Click to Profile */}
          <div
            onClick={() => onTabChange('profile')}
            className="cursor-pointer active:scale-95 transition-transform"
          >
            <UserAvatar
              name={user.name}
              photoURL={user.photoURL}
              avatarColor={user.avatarColor}
              avatarIcon={user.avatarIcon}
              isVerified={user.isVerified}
              size="sm"
            />
          </div>
        </div>
      </header>

      {/* MOBILE BOTTOM NAVIGATION DOCK */}
      <nav
        id="mobile-bottom-nav"
        aria-label="Mobile Navigation"
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#121622]/95 backdrop-blur-lg border-t border-slate-200/80 dark:border-slate-800 px-3 py-1.5 flex items-center justify-around shadow-lg"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center gap-0.5 py-1 px-4 rounded-xl relative transition-all cursor-pointer ${
                isActive
                  ? 'text-indigo-600 dark:text-indigo-400 font-bold'
                  : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
              }`}
            >
              <div className={`p-1 rounded-xl transition-all ${isActive ? 'bg-indigo-50 dark:bg-indigo-950/60' : ''}`}>
                <Icon size={20} />
              </div>
              <span className="text-[10px] tracking-tight">{item.label}</span>

              {item.badge && item.badge > 0 ? (
                <span className="absolute top-1 right-3 w-4 h-4 bg-indigo-600 text-white text-[9px] font-black rounded-full flex items-center justify-center ring-2 ring-white dark:ring-[#121622]">
                  {item.badge}
                </span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </>
  );
};
