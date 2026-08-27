import React, { useState } from 'react';
import { Shield, Zap, Cpu, Lock, Terminal, Orbit, Compass, Check, Users } from 'lucide-react';

interface UserAvatarProps {
  name: string;
  photoURL?: string;
  avatarColor?: string;
  avatarIcon?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  showOnlineStatus?: boolean;
  isOnline?: boolean;
}

export const VerifiedBadge: React.FC<{ size?: 'sm' | 'md' | 'lg'; className?: string }> = ({
  size = 'md',
  className = ''
}) => {
  const sizeMap = {
    sm: 'w-3.5 h-3.5 min-w-[14px]',
    md: 'w-4 h-4 min-w-[16px]',
    lg: 'w-5 h-5 min-w-[20px]'
  };
  const iconSizeMap = {
    sm: 9,
    md: 10,
    lg: 13
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-full bg-sky-500 text-white shadow-2xs shrink-0 select-none ${sizeMap[size]} ${className}`}
      title="Verified Blue Tick"
      aria-label="Verified Account"
    >
      <Check size={iconSizeMap[size]} strokeWidth={3.5} className="text-white" />
    </span>
  );
};

export const GroupAvatar: React.FC<{
  name?: string;
  photoURL?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
}> = ({ size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-24 h-24 text-3xl'
  };
  const iconSizes = {
    sm: 15,
    md: 20,
    lg: 24,
    xl: 32,
    '2xl': 48
  };

  return (
    <div className={`${sizeClasses[size]} rounded-2xl bg-gradient-to-br from-indigo-600 via-indigo-700 to-purple-800 flex items-center justify-center text-white shadow-inner shrink-0 select-none border border-indigo-400/20`}>
      <Users size={iconSizes[size]} className="text-white/95" />
    </div>
  );
};

export const UserAvatar: React.FC<UserAvatarProps> = ({
  name,
  photoURL,
  avatarColor = 'bg-indigo-600',
  avatarIcon = 'shield',
  size = 'md',
  showOnlineStatus = false,
  isOnline = true
}) => {
  const [imageError, setImageError] = useState(false);

  const sizeClasses = {
    sm: 'w-8 h-8 text-xs',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-xl',
    '2xl': 'w-24 h-24 text-3xl'
  };

  const iconSizes = {
    sm: 14,
    md: 18,
    lg: 22,
    xl: 28,
    '2xl': 40
  };

  const getIcon = () => {
    const s = iconSizes[size];
    switch (avatarIcon) {
      case 'zap': return <Zap size={s} className="text-white/90" />;
      case 'cpu': return <Cpu size={s} className="text-white/90" />;
      case 'lock': return <Lock size={s} className="text-white/90" />;
      case 'terminal': return <Terminal size={s} className="text-white/90" />;
      case 'orbit': return <Orbit size={s} className="text-white/90" />;
      case 'compass': return <Compass size={s} className="text-white/90" />;
      case 'shield':
      default:
        return <Shield size={s} className="text-white/90" />;
    }
  };

  const getInitials = (n: string) => {
    if (!n) return 'U';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return n.slice(0, 2).toUpperCase();
  };

  const hasValidPhoto = Boolean(photoURL && !imageError);

  return (
    <div className="relative inline-flex flex-shrink-0 items-center justify-center">
      {hasValidPhoto ? (
        <div
          className={`${sizeClasses[size]} rounded-2xl overflow-hidden shadow-xs border border-slate-200/60 dark:border-slate-700/60 bg-slate-100 dark:bg-slate-800 flex items-center justify-center`}
        >
          <img
            src={photoURL}
            alt={name || 'User Profile Photo'}
            onError={() => setImageError(true)}
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      ) : (
        <div
          className={`${sizeClasses[size]} ${avatarColor} rounded-2xl flex items-center justify-center text-white font-bold shadow-inner transition-transform`}
          style={{
            background: avatarColor.startsWith('bg-') ? undefined : avatarColor,
            backgroundImage: 'linear-gradient(135deg, rgba(255,255,255,0.25) 0%, rgba(0,0,0,0.25) 100%)'
          }}
        >
          {avatarIcon ? getIcon() : <span>{getInitials(name)}</span>}
        </div>
      )}

      {showOnlineStatus && isOnline && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 block rounded-full ring-2 ring-white dark:ring-[#151b28] bg-emerald-500 ${
            size === 'sm' ? 'w-2.5 h-2.5' : size === '2xl' ? 'w-4 h-4' : 'w-3 h-3'
          }`}
          title="Online"
        />
      )}
    </div>
  );
};
