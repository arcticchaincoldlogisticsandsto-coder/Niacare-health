import React from 'react';

const AVATAR_COLORS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-purple-500', 'bg-cyan-500'];

const avatarColor = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
};

const initials = (name: string) =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join('') || '?';

const SIZE_CLASSES = {
  sm: 'h-7 w-7 text-[10px]',
  md: 'h-9 w-9 text-xs',
  lg: 'h-12 w-12 text-sm',
} as const;

interface AvatarProps {
  name: string;
  size?: keyof typeof SIZE_CLASSES;
}

/** Colored initials circle — the same person-row style used across every
 * role's dashboard (Admin/Doctor/Provider), matching the reference design. */
export const Avatar: React.FC<AvatarProps> = ({ name, size = 'sm' }) => (
  <div className={`flex shrink-0 items-center justify-center rounded-full font-black text-white ${avatarColor(name)} ${SIZE_CLASSES[size]}`}>
    {initials(name)}
  </div>
);
