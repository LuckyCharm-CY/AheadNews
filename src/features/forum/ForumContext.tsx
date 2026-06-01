import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { useAuth } from '@/src/features/auth/AuthContext';
import { supabase } from '@/src/lib/supabase';
import { moderateContent } from './moderation';
import type { AuthorBadge, Comment, Post, PostCategory, Reply } from './types';

// ─── Local row shapes ─────────────────────────────────────────────────────────

type ProfileRow = { username: string; role: string };

// Supabase JS infers embedded one-to-one joins as arrays without generated types.
// We accept both shapes and normalise in the mappers.
type ProfileEmbed = ProfileRow | ProfileRow[];

type PostRow = {
  id:            string;
  author_id:     string;
  title:         string;
  content:       string;
  category:      string;
  votes:         number;
  comment_count: number;
  is_stickied:   boolean;
  created_at:    string;
  profiles:      ProfileEmbed;
};

type CommentRow = {
  id:        string;
  post_id:   string;
  author_id: string;
  parent_id: string | null;
  content:   string;
  votes:     number;
  created_at:string;
  profiles:  ProfileEmbed;
};

// ─── Mappers ──────────────────────────────────────────────────────────────────

function badge(role: string): AuthorBadge | undefined {
  return role === 'mod' ? 'mod' : undefined;
}

function resolveProfile(embed: ProfileEmbed): ProfileRow {
  return Array.isArray(embed) ? embed[0] : embed;
}

function mapPost(row: PostRow): Post {
  const p = resolveProfile(row.profiles);
  return {
    id:           row.id,
    authorId:     row.author_id,
    title:        row.title,
    content:      row.content,
    category:     row.category as PostCategory,
    author:       p.username,
    authorBadge:  badge(p.role),
    votes:        row.votes,
    commentCount: row.comment_count,
    isStickied:   row.is_stickied,
    createdAt:    row.created_at,
  };
}

function buildCommentTree(rows: CommentRow[]): Comment[] {
  const map = new Map<string, Comment>();
  const replyMap = new Map<string, Reply[]>();

  // First pass — build all nodes
  for (const row of rows) {
    const p = resolveProfile(row.profiles);
    if (!row.parent_id) {
      map.set(row.id, {
        id:          row.id,
        author:      p.username,
        authorBadge: badge(p.role),
        content:     row.content,
        votes:       row.votes,
        createdAt:   row.created_at,
        replies:     [],
      });
    }
  }

  // Second pass — attach replies
  for (const row of rows) {
    const p = resolveProfile(row.profiles);
    if (row.parent_id && map.has(row.parent_id)) {
      const list = replyMap.get(row.parent_id) ?? [];
      list.push({
        id:          row.id,
        author:      p.username,
        authorBadge: badge(p.role),
        content:     row.content,
        votes:       row.votes,
        createdAt:   row.created_at,
      });
      replyMap.set(row.parent_id, list);
    }
  }

  // Merge replies into comments
  for (const [id, replies] of replyMap) {
    const c = map.get(id);
    if (c) c.replies = replies;
  }

  return [...map.values()];
}

// ─── Context shape ────────────────────────────────────────────────────────────

type VoteDir = 1 | -1 | 0;

interface ForumState {
  posts:            Post[];
  commentsByPost:   Record<string, Comment[]>;
  postVotes:        Record<string, VoteDir>;
  commentVotes:     Record<string, VoteDir>;
  isLoadingPosts:   boolean;
  castPostVote:     (postId: string, dir: VoteDir) => Promise<void>;
  castCommentVote:  (commentId: string, dir: VoteDir) => Promise<void>;
  addPost:          (draft: { title: string; content: string; category: PostCategory }) => Promise<void>;
  editPost:         (postId: string, updates: { title: string; content: string }) => Promise<void>;
  deletePost:       (postId: string) => Promise<void>;
  addComment:       (postId: string, content: string) => Promise<void>;
  addReply:         (postId: string, commentId: string, content: string) => Promise<void>;
  loadCommentsForPost: (postId: string) => Promise<void>;
}

const ForumContext = createContext<ForumState | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ForumProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [posts,          setPosts]          = useState<Post[]>([]);
  const [commentsByPost, setCommentsByPost] = useState<Record<string, Comment[]>>({});
  const [postVotes,      setPostVotes]      = useState<Record<string, VoteDir>>({});
  const [commentVotes,   setCommentVotes]   = useState<Record<string, VoteDir>>({});
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);

  // ── Fetch posts + user's existing votes ──────────────────────────────────────

  const fetchPosts = useCallback(async () => {
    setIsLoadingPosts(true);
    try {
      const { data, error } = await supabase
        .from('posts')
        .select('id, author_id, title, content, category, votes, comment_count, is_stickied, created_at, profiles!author_id(username, role)')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error || !data) return;
      setPosts((data as PostRow[]).map(mapPost));

      // Fetch user's votes for these posts
      if (user) {
        const ids = data.map((p) => p.id);
        const { data: votes } = await supabase
          .from('post_votes')
          .select('post_id, direction')
          .eq('user_id', user.id)
          .in('post_id', ids);

        if (votes) {
          const map: Record<string, VoteDir> = {};
          for (const v of votes) map[v.post_id] = v.direction as VoteDir;
          setPostVotes(map);
        }
      }
    } finally {
      setIsLoadingPosts(false);
    }
  }, [user]);

  // ── Real-time subscription for new / updated posts ────────────────────────────

  useEffect(() => {
    if (!user) return;

    // Ensure a profile row exists for this user.
    // Users who signed up before the DB migration won't have one from the trigger.
    supabase
      .from('profiles')
      .upsert({ id: user.id, username: user.name }, { onConflict: 'id', ignoreDuplicates: true });

    fetchPosts();

    const channel = supabase
      .channel('public:posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        fetchPosts();
      })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'posts' }, (payload) => {
        setPosts((prev) => prev.filter((p) => p.id !== payload.old.id));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Load comments for a specific post ────────────────────────────────────────

  const loadCommentsForPost = useCallback(async (postId: string) => {
    const { data, error } = await supabase
      .from('comments')
      .select('*, profiles!author_id(username, role)')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });

    if (error || !data) return;

    const tree = buildCommentTree(data as CommentRow[]);
    setCommentsByPost((prev) => ({ ...prev, [postId]: tree }));

    // Fetch user's comment votes for this post
    if (user) {
      const ids = data.map((c) => c.id);
      const { data: votes } = await supabase
        .from('comment_votes')
        .select('comment_id, direction')
        .eq('user_id', user.id)
        .in('comment_id', ids);

      if (votes) {
        const map: Record<string, VoteDir> = {};
        for (const v of votes) map[v.comment_id] = v.direction as VoteDir;
        setCommentVotes((prev) => ({ ...prev, ...map }));
      }
    }
  }, [user]);

  // ── Create post ───────────────────────────────────────────────────────────────

  const addPost = useCallback(async (draft: { title: string; content: string; category: PostCategory }) => {
    if (!user) throw new Error('You must be signed in to post.');

    const text = `${draft.title}\n${draft.content}`;
    const mod = await moderateContent(text);
    if (!mod.ok) throw new Error(mod.reason);

    const { data, error } = await supabase
      .from('posts')
      .insert({
        author_id: user.id,
        title:     draft.title,
        content:   draft.content,
        category:  draft.category,
      })
      .select('*, profiles!author_id(username, role)')
      .single();

    if (error) throw new Error(error.message);
    setPosts((prev) => [mapPost(data as PostRow), ...prev]);
  }, [user]);

  // ── Edit post ─────────────────────────────────────────────────────────────────

  const editPost = useCallback(async (postId: string, updates: { title: string; content: string }) => {
    const mod = await moderateContent(`${updates.title}\n${updates.content}`);
    if (!mod.ok) throw new Error(mod.reason);

    const { error } = await supabase
      .from('posts')
      .update({ title: updates.title, content: updates.content })
      .eq('id', postId);

    if (error) throw new Error(error.message);
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, title: updates.title, content: updates.content } : p)),
    );
  }, []);

  // ── Delete post ───────────────────────────────────────────────────────────────

  const deletePost = useCallback(async (postId: string) => {
    const { error } = await supabase.from('posts').delete().eq('id', postId);
    if (error) throw new Error(error.message);
    setPosts((prev) => prev.filter((p) => p.id !== postId));
  }, []);

  // ── Create comment ────────────────────────────────────────────────────────────

  const addComment = useCallback(async (postId: string, content: string) => {
    if (!user) throw new Error('You must be signed in to comment.');

    const mod = await moderateContent(content);
    if (!mod.ok) throw new Error(mod.reason);

    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, author_id: user.id, content })
      .select('*, profiles!author_id(username, role)')
      .single();

    if (error) throw new Error(error.message);

    const cRow = data as CommentRow;
    const cProfile = resolveProfile(cRow.profiles);
    const newComment: Comment = {
      id:          cRow.id,
      author:      cProfile.username,
      authorBadge: badge(cProfile.role),
      content:     cRow.content,
      votes:       cRow.votes,
      createdAt:   cRow.created_at,
      replies:     [],
    };

    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: [newComment, ...(prev[postId] ?? [])],
    }));
    setPosts((prev) =>
      prev.map((p) => (p.id === postId ? { ...p, commentCount: p.commentCount + 1 } : p)),
    );
  }, [user]);

  // ── Create reply ──────────────────────────────────────────────────────────────

  const addReply = useCallback(async (postId: string, commentId: string, content: string) => {
    if (!user) throw new Error('You must be signed in to reply.');

    const mod = await moderateContent(content);
    if (!mod.ok) throw new Error(mod.reason);

    const { data, error } = await supabase
      .from('comments')
      .insert({ post_id: postId, author_id: user.id, parent_id: commentId, content })
      .select('*, profiles!author_id(username, role)')
      .single();

    if (error) throw new Error(error.message);

    const rRow = data as CommentRow;
    const rProfile = resolveProfile(rRow.profiles);
    const newReply: Reply = {
      id:          rRow.id,
      author:      rProfile.username,
      authorBadge: badge(rProfile.role),
      content:     rRow.content,
      votes:       rRow.votes,
      createdAt:   rRow.created_at,
    };

    setCommentsByPost((prev) => ({
      ...prev,
      [postId]: (prev[postId] ?? []).map((c) =>
        c.id === commentId ? { ...c, replies: [...c.replies, newReply] } : c,
      ),
    }));
  }, [user]);

  // ── Vote on post (optimistic) ─────────────────────────────────────────────────

  const castPostVote = useCallback(async (postId: string, dir: VoteDir) => {
    if (!user || dir === 0) return;
    const prev = postVotes[postId] ?? 0;
    const next: VoteDir = prev === dir ? 0 : dir;

    // Optimistic update
    setPostVotes((p) => ({ ...p, [postId]: next }));

    try {
      await supabase.rpc('cast_post_vote', {
        p_post_id:   postId,
        p_direction: dir,
      });
    } catch {
      // Revert on error
      setPostVotes((p) => ({ ...p, [postId]: prev as VoteDir }));
    }
  }, [user, postVotes]);

  // ── Vote on comment (optimistic) ──────────────────────────────────────────────

  const castCommentVote = useCallback(async (commentId: string, dir: VoteDir) => {
    if (!user || dir === 0) return;
    const prev = commentVotes[commentId] ?? 0;
    const next: VoteDir = prev === dir ? 0 : dir;

    setCommentVotes((p) => ({ ...p, [commentId]: next }));

    try {
      await supabase.rpc('cast_comment_vote', {
        p_comment_id: commentId,
        p_direction:  dir,
      });
    } catch {
      setCommentVotes((p) => ({ ...p, [commentId]: prev as VoteDir }));
    }
  }, [user, commentVotes]);

  // ─────────────────────────────────────────────────────────────────────────────

  const value = useMemo(
    () => ({
      posts, commentsByPost, postVotes, commentVotes, isLoadingPosts,
      castPostVote, castCommentVote,
      addPost, editPost, deletePost,
      addComment, addReply, loadCommentsForPost,
    }),
    [posts, commentsByPost, postVotes, commentVotes, isLoadingPosts,
     castPostVote, castCommentVote,
     addPost, editPost, deletePost,
     addComment, addReply, loadCommentsForPost],
  );

  return <ForumContext.Provider value={value}>{children}</ForumContext.Provider>;
}

export function useForum() {
  const ctx = useContext(ForumContext);
  if (!ctx) throw new Error('useForum must be used inside ForumProvider');
  return ctx;
}
