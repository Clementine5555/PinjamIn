'use client';

import Image from 'next/image';
import { UserRound } from 'lucide-react';
import type { User } from '@supabase/supabase-js';

function avatarUrl(user: User) {
  const value = String(user.user_metadata.avatar_url ?? '');
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!value || !projectUrl) return '';
  try {
    const avatar = new URL(value);
    const project = new URL(projectUrl);
    const expectedPath = `/storage/v1/object/public/avatars/${user.id}/avatar`;
    return avatar.origin === project.origin && avatar.pathname === expectedPath ? value : '';
  } catch {
    return '';
  }
}

export default function UserAvatar({ user, className = 'size-10', decorative = false }: { user: User; className?: string; decorative?: boolean }) {
  const source = avatarUrl(user);
  const name = String(user.user_metadata.full_name || user.email || 'Pengguna');
  return <span className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-mint/60 font-semibold text-primary ${className}`}>
    {source ? <Image src={source} alt={decorative ? '' : `Foto profil ${name}`} fill sizes="96px" className="object-cover" /> : name ? name.slice(0, 1).toUpperCase() : <UserRound size={20} />}
  </span>;
}
