export type PostCategory =
  | 'Announcements'
  | 'World News'
  | 'Tech & AI'
  | 'Business'
  | 'Local SG News'
  | 'Sports'
  | 'Life';

export type AuthorBadge = 'mod' | 'verified';
export type SortMode    = 'Hot' | 'New' | 'Top';

export interface Post {
  id:           string;
  authorId:     string; // uuid of the author — empty string for legacy seed data
  title:        string;
  content:      string;
  category:     PostCategory;
  author:       string;
  authorBadge?: AuthorBadge;
  createdAt:    string; // ISO
  votes:        number;
  commentCount: number;
  isStickied?:  boolean;
}

export interface Reply {
  id:           string;
  author:       string;
  authorBadge?: AuthorBadge;
  content:      string;
  createdAt:    string;
  votes:        number;
}

export interface Comment {
  id:           string;
  author:       string;
  authorBadge?: AuthorBadge;
  content:      string;
  createdAt:    string;
  votes:        number;
  replies:      Reply[];
}
