export type Folder = {
  id: string;
  user_id: string;
  parent_id: string | null;
  name: string;
  color: string;
  created_at: string;
  updated_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  folder_id: string | null;
  title: string;
  content: string;
  is_pinned: boolean;
  is_archived: boolean;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
};

export type AudioFile = {
  id: string;
  user_id: string;
  note_id: string;
  file_name: string;
  file_path: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
  signed_url?: string;
};

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';
