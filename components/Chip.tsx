'use client';

export default function Chip({ label, selected = false, onSelect }: { label: string; selected?: boolean; onSelect?: () => void }) {
  return <button type="button" aria-pressed={selected} onClick={onSelect} className={`shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors ${selected ? 'bg-primary text-white' : 'bg-white text-foreground hover:bg-primary/10'}`}>{label}</button>;
}
