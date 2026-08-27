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
  isVerified?: boolean;
}

export const VERIFIED_BADGE_IMAGE_URL =
  'https://cdn.phototourl.com/free/2026-08-03-5734f1ec-8c0c-4046-a301-9496861cf40f.jpg';

export const VerifiedBadge: React.FC<{
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | number;
  className?: string;
}> = ({ size = 'md', className = '' }) => {
  let dimensionPx = 22;
  if (typeof size === 'number') {
    // Scale up numeric sizes so the custom badge is clearly visible and prominent
    dimensionPx = Math.max(Math.round(size * 1.3), size + 4);
  } else {
    switch (size) {
      case 'xs':
        dimensionPx = 16;
        break;
      case 'sm':
        dimensionPx = 20;
        break;
      case 'md':
        dimensionPx = 24;
        break;
      case 'lg':
        dimensionPx = 30;
        break;
      case 'xl':
        dimensionPx = 36;
        break;
      default:
        dimensionPx = 24;
    }
  }

  return (
    <span
      className={`inline-flex items-center justify-center shrink-0 select-none align-middle ${className}`}
      title="Verified Badge"
      aria-label="Verified Account"
    >
      <img
        src={VERIFIED_BADGE_IMAGE_URL}
        alt="Verified Badge"
        width={dimensionPx}
        height={dimensionPx}
        style={{ width: `${dimensionPx}px`, height: `${dimensionPx}px`, minWidth: `${dimensionPx}px` }}
        className="object-contain inline-block shrink-0 rounded-full drop-shadow-xs"
        referrerPolicy="no-referrer"
        loading="eager"
      />
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
