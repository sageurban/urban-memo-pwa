export type Note = {
  id: string;
  user_id: string;
  title: string;
  content: string;
  is_pinned: boolean;
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
