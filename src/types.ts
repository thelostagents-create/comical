export type LibraryStatus = "reading" | "completed" | "plan_to_read" | "dropped";

export type RatingTargetType = "series" | "issue";

export interface Profile {
  id: string;
  username: string;
  bio: string;
  avatar_url: string | null;
  created_at: string;
}

export interface Series {
  id: string;
  title: string;
  publisher: string;
  description: string;
  cover_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Issue {
  id: string;
  series_id: string;
  issue_number: string;
  title: string;
  cover_url: string | null;
  created_by: string | null;
  created_at: string;
}

export interface LibraryEntry {
  id: string;
  user_id: string;
  series_id: string;
  status: LibraryStatus;
  starred: boolean;
  added_at: string;
}

export interface Read {
  id: string;
  user_id: string;
  issue_id: string;
  read_at: string;
}

export interface Rating {
  id: string;
  user_id: string;
  target_type: RatingTargetType;
  target_id: string;
  rating: number;
  review: string;
  created_at: string;
  updated_at: string;
}

export interface Follow {
  follower_id: string;
  followee_id: string;
  created_at: string;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  image_url: string | null;
  publisher: string;
  comicvine_id: string | null;
  series_id: string | null;
  created_by: string | null;
  created_at: string;
}

export interface Show {
  id: string;
  title: string;
  network: string;
  description: string;
  image_url: string | null;
  series_id: string | null;
  created_by: string | null;
  created_at: string;
}

export const LIBRARY_STATUS_LABELS: Record<LibraryStatus, string> = {
  reading: "Reading",
  completed: "Completed",
  plan_to_read: "Plan to Read",
  dropped: "Dropped",
};

export type ReactionType = "thumbs_up" | "heart" | "laugh" | "wow" | "sad";

export const REACTION_TYPES: ReactionType[] = ["thumbs_up", "heart", "laugh", "wow", "sad"];

export const REACTION_EMOJI: Record<ReactionType, string> = {
  thumbs_up: "👍",
  heart: "❤️",
  laugh: "😂",
  wow: "😮",
  sad: "😢",
};

export interface FandomPost {
  id: string;
  user_id: string;
  body: string;
  image_url: string | null;
  created_at: string;
}

export interface FandomReaction {
  id: string;
  post_id: string;
  user_id: string;
  reaction: ReactionType;
  created_at: string;
}

export interface FavoriteCharacter {
  id: string;
  user_id: string;
  character_id: string;
  image_url: string | null;
  created_at: string;
}

export interface FandomReply {
  id: string;
  post_id: string;
  user_id: string;
  body: string;
  created_at: string;
}
