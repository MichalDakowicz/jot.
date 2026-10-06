export type Profile = {
  id: string;
  full_name: string;
  year_label: string;
  avatar_path: string | null;
};

export type Notebook = {
  id: string;
  user_id: string;
  name: string;
  code: string;
  prof: string;
  tint: number;
  position: number;
  created_at: string;
};

export type Note = {
  id: string;
  user_id: string;
  notebook_id: string;
  title: string;
  body: string;
  /** Lower case, no "#"; set in the row under the title, not in the body. */
  tags: string[];
  created_at: string;
  updated_at: string;
};

export type ClassSession = {
  id: string;
  user_id: string;
  notebook_id: string;
  weekday: number; // 0 = Sunday .. 6 = Saturday
  starts_at: string; // "09:00:00"
  room: string;
};

/** A note flattened for list rendering. */
export type NoteCard = {
  id: string;
  title: string;
  when: string;
  snippet: string;
  tags: string[];
  nbId: string;
  nbName: string;
  tint: string;
  soft: string;
  dark: string;
};
