'use client';

import { useState } from 'react';
import { addDays, addMonths, format, getDay, startOfMonth } from 'date-fns';

export default function AvailabilityCalendar({ selected, today, ranges, onSelect }: {
  selected: string;
  today: string;
  ranges: { start_date: string; end_date: string }[];
  onSelect: (date: string) => void;
}) {
  const [offset, setOffset] = useState(0);
  if (!today) return null;
  const month = startOfMonth(addMonths(new Date(`${today}T12:00:00`), offset));
  const monthLabel = new Intl.DateTimeFormat('id-ID', { month: 'long', year: 'numeric' }).format(month);
  const firstWeekday = (getDay(month) + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, index) => addDays(month, index - firstWeekday));
  return <div className="mt-4 rounded-xl border border-primary/10 p-4">
    <div className="flex items-center justify-between gap-3"><button type="button" disabled={offset === 0} onClick={() => setOffset(value => value - 1)} className="rounded-lg px-3 py-1 text-primary disabled:opacity-30" aria-label="Bulan sebelumnya">‹</button><h3 className="text-sm font-semibold capitalize">{monthLabel}</h3><button type="button" disabled={offset === 5} onClick={() => setOffset(value => value + 1)} className="rounded-lg px-3 py-1 text-primary disabled:opacity-30" aria-label="Bulan berikutnya">›</button></div>
    <div className="mt-3 grid grid-cols-7 gap-1 text-center text-xs">{['Sen','Sel','Rab','Kam','Jum','Sab','Min'].map(day => <span key={day} className="py-2 font-semibold text-muted-foreground">{day}</span>)}{cells.map((day, index) => {
      const value = format(day, 'yyyy-MM-dd');
      const outside = day.getMonth() !== month.getMonth();
      const booked = ranges.some(range => value >= range.start_date && value <= range.end_date);
      const disabled = outside || value < today || booked;
      return <button key={index} type="button" disabled={disabled} onClick={() => onSelect(value)} aria-pressed={value === selected} title={booked ? 'Sudah dipesan' : value} className={`aspect-square rounded-lg text-xs ${value === selected ? 'bg-primary font-bold text-white' : booked ? 'bg-red-100 text-red-700' : 'hover:bg-mint/50'} disabled:cursor-not-allowed ${outside || value < today ? 'opacity-25' : ''}`}>{day.getDate()}</button>;
    })}</div><p className="mt-3 text-xs text-muted-foreground">Merah: sudah dipesan. Tanggal lain dapat diajukan, tetapi persetujuan akhir tetap bergantung pada pemilik.</p>
  </div>;
}
