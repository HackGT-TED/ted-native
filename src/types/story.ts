export type Story = {
  id: string;
  user_id: string;
  creation_session_id: string | null;
  title: string;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
  published_at: string | null;
  /** Published to the marketplace for everyone, not just the author. */
  marketplace: boolean;
  /** Storage path of the story's cover image in the recordings bucket. */
  cover_path: string | null;
};
