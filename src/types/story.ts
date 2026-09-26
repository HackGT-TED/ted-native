export type Story = {
  id: string;
  user_id: string;
  creation_session_id: string | null;
  title: string;
  status: 'draft' | 'published';
  created_at: string;
  updated_at: string;
  published_at: string | null;
};
