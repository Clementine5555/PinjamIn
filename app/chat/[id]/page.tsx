'use client';

import Link from 'next/link';
import { use, useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowLeft, Send } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { supabase } from '@/lib/supabase';

type Rental = { id: number; renter_id: string; status: string; item: { title: string; owner_id: string | null } | null };
type Message = { id: number; rental_id: number; sender_id: string; body: string; created_at: string };

function mergeMessages(current: Message[], incoming: Message[]) {
  const byId = new Map(current.map(message => [message.id, message]));
  incoming.forEach(message => byId.set(message.id, message));
  return [...byId.values()].sort((a, b) => a.id - b.id);
}

export default function ChatPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user, loading: authLoading, error: authError } = useAuth();
  const [rental, setRental] = useState<Rental | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [body, setBody] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [realtimeError, setRealtimeError] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);
  const userId = user && !user.is_anonymous ? user.id : '';
  const rentalId = /^\d+$/.test(id) ? Number(id) : 0;

  useEffect(() => { bottom.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | undefined;
    async function load() {
      setError('');
      if (!rentalId) { setError('Chat tidak ditemukan.'); setLoading(false); return; }
      try {
        const { data, error: rentalError } = await supabase.from('rentals')
          .select('id,renter_id,status,items(title,owner_id)').eq('id', rentalId).maybeSingle();
        if (rentalError) throw rentalError;
        if (!active) return;
        if (!data) { if (active) setError('Chat tidak ditemukan atau kamu tidak punya akses.'); return; }
        const item = Array.isArray(data.items) ? data.items[0] ?? null : data.items;
        if (!item?.owner_id) { if (active) setError('Barang ini belum memiliki akun pemilik, jadi chat belum tersedia.'); return; }
        if (data.renter_id !== userId && item.owner_id !== userId) { if (active) setError('Kamu tidak punya akses ke chat ini.'); return; }
        if (active) setRental({ id: data.id, renter_id: data.renter_id, status: data.status, item });

        channel = supabase.channel(`rental-chat:${rentalId}`)
          .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `rental_id=eq.${rentalId}` }, payload => {
            if (active) setMessages(current => mergeMessages(current, [payload.new as Message]));
          })
          .subscribe(status => {
            if (active) setRealtimeError(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT');
          });
        const { data: history, error: messagesError } = await supabase.from('messages')
          .select('id,rental_id,sender_id,body,created_at').eq('rental_id', rentalId)
          .order('id', { ascending: true }).limit(200);
        if (messagesError) throw messagesError;
        if (active) setMessages(current => mergeMessages(current, (history ?? []) as Message[]));
      } catch {
        if (active) setError('Chat gagal dimuat. Coba muat ulang halaman.');
      } finally { if (active) setLoading(false); }
    }
    void load();
    return () => { active = false; if (channel) void supabase.removeChannel(channel); };
  }, [rentalId, userId]);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const text = body.trim();
    if (!rental || !userId || !text || text.length > 1000 || sending) return;
    setSending(true); setError('');
    try {
      const { data, error: sendError } = await supabase.from('messages')
        .insert({ rental_id: rental.id, sender_id: userId, body: text })
        .select('id,rental_id,sender_id,body,created_at').single();
      if (sendError) throw sendError;
      setBody('');
      setMessages(current => mergeMessages(current, [data as Message]));
    } catch { setError('Pesan gagal dikirim. Coba lagi.'); }
    finally { setSending(false); }
  }

  if (authLoading) return <div className="page-container" role="status">Memuat sesi...</div>;
  if (authError) return <div className="page-container" role="alert">{authError}</div>;
  if (!userId) return <div className="page-container"><h1 className="text-2xl font-bold">Chat</h1><p className="mt-3">Masuk untuk melihat pesan sewa.</p><Link href={`/login?next=${encodeURIComponent(`/chat/${id}`)}`} className="mt-4 inline-block rounded-full bg-primary px-6 py-3 text-white">Masuk</Link></div>;

  return <div className="page-container"><div className="mx-auto flex max-w-2xl flex-col overflow-hidden rounded-2xl border border-primary/10 bg-white">
    <div className="border-b border-primary/10 p-4 sm:p-5"><Link href={rental?.renter_id === userId ? '/transactions' : '/lend/requests'} className="mb-3 inline-flex items-center gap-2 text-sm text-primary"><ArrowLeft size={18} />Kembali</Link><h1 className="text-xl font-bold">{rental?.item?.title ?? 'Chat sewa'}</h1>{rental && <p className="mt-1 text-sm text-muted-foreground">Transaksi #{rental.id} · {rental.status}</p>}</div>
    {loading ? <p className="p-6" role="status">Memuat chat...</p> : rental ? <>
      <div role="log" aria-label="Pesan chat" aria-live="polite" className="flex h-[min(55vh,520px)] min-h-72 flex-col gap-3 overflow-y-auto bg-background/60 p-4 sm:p-6">
        {!messages.length && <p className="m-auto text-center text-sm text-muted-foreground">Belum ada pesan. Mulai percakapan tentang barang sewaan ini.</p>}
        {messages.map(message => <div key={message.id} className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${message.sender_id === userId ? 'ml-auto bg-primary text-white' : 'mr-auto border border-primary/10 bg-white'}`}><p className="whitespace-pre-wrap break-words">{message.body}</p><time dateTime={message.created_at} className={`mt-1 block text-right text-xs ${message.sender_id === userId ? 'text-white/70' : 'text-muted-foreground'}`}>{new Date(message.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}</time></div>)}
        <div ref={bottom} />
      </div>
      {realtimeError && <p role="status" className="px-4 pt-3 text-xs text-amber-700">Koneksi pesan langsung terputus. Muat ulang halaman untuk melihat pesan terbaru.</p>}
      <form onSubmit={send} className="flex gap-2 border-t border-primary/10 p-3 sm:p-4"><label htmlFor="chat-body" className="sr-only">Tulis pesan</label><input id="chat-body" value={body} onChange={event => setBody(event.target.value)} maxLength={1000} placeholder="Tulis pesan tentang sewa ini..." className="min-w-0 flex-1 rounded-full border border-primary/20 px-4 py-3 text-sm" /><button type="submit" disabled={sending || !body.trim()} aria-label="Kirim pesan" className="flex size-11 shrink-0 items-center justify-center rounded-full bg-primary text-white disabled:opacity-50"><Send size={18} /></button></form>
    </> : null}
    {error && <p role="alert" className="p-4 text-sm text-red-700">{error}</p>}
  </div></div>;
}
