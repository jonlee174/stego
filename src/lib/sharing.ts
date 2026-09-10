import { supabase } from './supabase';
import type { Deck } from '../types';

/** Everything send_deck can report. Blocked senders are told 'ok' on purpose. */
export type SendResult = 'ok' | 'no_such_user' | 'self' | 'inbox_full' | 'not_signed_in';

export interface IncomingDeck {
  id: string;
  from: string;
  deckName: string;
  cardCount: number;
  sentAt: number;
  deck: Deck;
}

export async function sendDeck(toUsername: string, deck: Deck): Promise<SendResult> {
  const { data, error } = await supabase().rpc('send_deck', {
    to_username: toUsername.trim().toLowerCase(),
    deck_name: deck.name,
    card_count: deck.cards.length,
    deck,
  });
  if (error) throw error;
  return (data as SendResult) ?? 'no_such_user';
}

export async function listInbox(): Promise<IncomingDeck[]> {
  const { data, error } = await supabase()
    .from('deck_shares')
    .select('id, from_username, deck_name, card_count, deck, created_at')
    .order('created_at', { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row) => ({
    id: row.id as string,
    from: row.from_username as string,
    deckName: row.deck_name as string,
    cardCount: row.card_count as number,
    sentAt: new Date(row.created_at as string).getTime(),
    deck: row.deck as Deck,
  }));
}

export async function inboxCount(): Promise<number> {
  const { count, error } = await supabase()
    .from('deck_shares')
    .select('id', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

/** Accepting and rejecting are the same row removal; the caller keeps the deck. */
export async function discardShare(id: string): Promise<void> {
  const { error } = await supabase().from('deck_shares').delete().eq('id', id);
  if (error) throw error;
}

export async function blockUser(username: string): Promise<void> {
  const { data } = await supabase().auth.getUser();
  const owner = data.user?.id;
  if (!owner) return;
  const { error } = await supabase()
    .from('blocks')
    .insert({ owner_id: owner, blocked_username: username.toLowerCase() });
  if (error && !/duplicate/i.test(error.message)) throw error;
}

export async function unblockUser(username: string): Promise<void> {
  const { error } = await supabase()
    .from('blocks')
    .delete()
    .eq('blocked_username', username.toLowerCase());
  if (error) throw error;
}

export async function listBlocks(): Promise<string[]> {
  const { data, error } = await supabase().from('blocks').select('blocked_username');
  if (error) throw error;
  return (data ?? []).map((r) => r.blocked_username as string);
}

export async function reportShare(share: IncomingDeck): Promise<void> {
  const { data } = await supabase().auth.getUser();
  const { error } = await supabase().from('reports').insert({
    reporter_id: data.user?.id,
    reported_username: share.from,
    deck_snapshot: share.deck,
  });
  if (error) throw error;
}
