import { supabase } from '../lib/supabase';

export type Person = { id: string; username: string | null; full_name: string | null };

export function personName(person: Person) {
  return person.full_name?.trim() || person.username || 'Someone';
}

/** People to send a story to, by username or name (at least 2 characters). Never returns the caller. */
export async function searchPeople(query: string): Promise<Person[]> {
  if (query.trim().length < 2) return [];
  if (!supabase) throw new Error('Account storage is unavailable.');
  const { data, error } = await supabase.rpc('search_profiles', { p_query: query.trim() });
  if (error) throw new Error('Could not search for people. Please retry.');
  return (data ?? []) as Person[];
}

/** Sends a published story to each person. Sending again to someone is ignored. */
export async function sendStory(storyId: string, recipientIds: string[]): Promise<void> {
  if (!recipientIds.length) return;
  if (!supabase) throw new Error('Account storage is unavailable.');
  const { error } = await supabase.from('story_shares').upsert(
    recipientIds.map(recipient_id => ({ story_id: storyId, recipient_id })),
    { onConflict: 'story_id,recipient_id', ignoreDuplicates: true },
  );
  if (error) throw new Error('Your story was published, but it could not be sent. Tap Publish to try again.');
}
