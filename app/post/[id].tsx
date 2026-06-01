import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@/src/features/auth/AuthContext';
import { useForum } from '@/src/features/forum/ForumContext';
import type { Comment, Reply } from '@/src/features/forum/types';

// ─── Tokens ───────────────────────────────────────────────────────────────────

const C = {
  bg:            '#F6F5F2',
  card:          '#FFFFFF',
  border:        '#E8E7E3',
  textPrimary:   '#111110',
  textSecondary: '#5A5955',
  textTertiary:  '#ADADAA',
  accent:        '#111110',
  upvote:        '#C94F0A',
  mod:           '#2D7A4F',
  error:         '#C9392C',
};

const CATEGORY_STYLE: Record<string, { bg: string; text: string }> = {
  'Announcements': { bg: '#111110', text: '#FFFFFF' },
  'World News':    { bg: '#EFF5F1', text: '#2D6B4A' },
  'Tech & AI':     { bg: '#EBF2FA', text: '#2B5B8A' },
  'Business':      { bg: '#FBF4E9', text: '#7D5A1F' },
  'Local SG News': { bg: '#F1EDFB', text: '#5B3FA0' },
  'Singapore':     { bg: '#F1EDFB', text: '#5B3FA0' }, // legacy fallback
  'Sports':        { bg: '#FAF0F4', text: '#9E3060' },
  'Life':          { bg: '#E8F8F3', text: '#1F7A5B' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)  return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function CategoryPill({ category }: { category: string }) {
  const s = CATEGORY_STYLE[category] ?? { bg: '#F1EFE8', text: '#5F5E5A' };
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, alignSelf: 'flex-start' }}>
      <Text style={{ fontSize: 10, fontWeight: '700', color: s.text, letterSpacing: 0.2 }}>
        {category.toUpperCase()}
      </Text>
    </View>
  );
}

function ModBadge() {
  return (
    <View style={{ backgroundColor: C.mod, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, marginLeft: 4 }}>
      <Text style={{ fontSize: 9, fontWeight: '800', color: '#FFF', letterSpacing: 0.5 }}>MOD</Text>
    </View>
  );
}

function MiniVote({
  votes, voteDir, onUp, onDown,
}: {
  votes: number; voteDir: 0|1|-1; onUp: () => void; onDown: () => void;
}) {
  const score = votes + voteDir;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <Pressable onPress={onUp} hitSlop={8}>
        <Text style={{ fontSize: 13, color: voteDir === 1 ? C.upvote : C.textTertiary }}>▲</Text>
      </Pressable>
      <Text style={{
        fontSize: 12, fontWeight: '600',
        color: voteDir === 1 ? C.upvote : voteDir === -1 ? '#4A7EC7' : C.textTertiary,
        minWidth: 20, textAlign: 'center',
      }}>
        {score}
      </Text>
      <Pressable onPress={onDown} hitSlop={8}>
        <Text style={{ fontSize: 13, color: voteDir === -1 ? '#4A7EC7' : C.textTertiary }}>▼</Text>
      </Pressable>
    </View>
  );
}

// ─── Reply row ────────────────────────────────────────────────────────────────

function ReplyRow({
  reply, voteDir, onUp, onDown,
}: {
  reply: Reply; voteDir: 0|1|-1; onUp: () => void; onDown: () => void;
}) {
  return (
    <View style={styles.replyRow}>
      <View style={styles.replyLine} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
          <View style={styles.avatarSmall}>
            <Text style={styles.avatarTextSmall}>{reply.author[0].toUpperCase()}</Text>
          </View>
          <Text style={styles.authorName}>{reply.author}</Text>
          {reply.authorBadge === 'mod' && <ModBadge />}
          <Text style={[styles.metaText, { marginLeft: 6 }]}>{relativeTime(reply.createdAt)}</Text>
        </View>
        <Text style={styles.commentBody}>{reply.content}</Text>
        <MiniVote votes={reply.votes} voteDir={voteDir} onUp={onUp} onDown={onDown} />
      </View>
    </View>
  );
}

// ─── Comment row ──────────────────────────────────────────────────────────────

function CommentRow({
  comment,
  postId,
  replyingToId,
  setReplyingTo,
  onError,
}: {
  comment:       Comment;
  postId:        string;
  replyingToId:  string | null;
  setReplyingTo: (id: string | null) => void;
  onError:       (msg: string) => void;
}) {
  const { commentVotes, castCommentVote, addReply } = useForum();
  const [replyText,  setReplyText]  = useState('');
  const [submitting, setSubmitting] = useState(false);
  const dir = (commentVotes[comment.id] ?? 0) as 0|1|-1;

  const submitReply = async () => {
    if (!replyText.trim() || submitting) return;
    setSubmitting(true);
    try {
      await addReply(postId, comment.id, replyText.trim());
      setReplyText('');
      setReplyingTo(null);
    } catch (e: unknown) {
      onError(e instanceof Error ? e.message : 'Failed to post reply.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.commentCard}>
      {/* Author row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{comment.author[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.authorName}>{comment.author}</Text>
        {comment.authorBadge === 'mod' && <ModBadge />}
        <Text style={[styles.metaText, { marginLeft: 6 }]}>{relativeTime(comment.createdAt)}</Text>
      </View>

      <Text style={styles.commentBody}>{comment.content}</Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 }}>
        <MiniVote
          votes={comment.votes}
          voteDir={dir}
          onUp={() => castCommentVote(comment.id, 1)}
          onDown={() => castCommentVote(comment.id, -1)}
        />
        <Pressable onPress={() => setReplyingTo(replyingToId === comment.id ? null : comment.id)} hitSlop={8}>
          <Text style={{ fontSize: 12, color: C.textTertiary, fontWeight: '500' }}>↩ Reply</Text>
        </Pressable>
      </View>

      {/* Replies */}
      {comment.replies.map((r) => {
        const rDir = (commentVotes[r.id] ?? 0) as 0|1|-1;
        return (
          <ReplyRow
            key={r.id}
            reply={r}
            voteDir={rDir}
            onUp={() => castCommentVote(r.id, 1)}
            onDown={() => castCommentVote(r.id, -1)}
          />
        );
      })}

      {/* Inline reply input */}
      {replyingToId === comment.id && (
        <View style={styles.inlineReply}>
          <TextInput
            value={replyText}
            onChangeText={setReplyText}
            placeholder={`Reply to ${comment.author}…`}
            placeholderTextColor={C.textTertiary}
            style={styles.inlineInput}
            multiline
            autoFocus
          />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
            <Pressable onPress={() => setReplyingTo(null)}>
              <Text style={{ fontSize: 13, color: C.textTertiary }}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submitReply} disabled={submitting}>
              {submitting
                ? <ActivityIndicator size="small" color={C.accent} />
                : <Text style={{ fontSize: 13, fontWeight: '700', color: replyText.trim() ? C.accent : C.textTertiary }}>Reply</Text>
              }
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

// ─── Post detail screen ───────────────────────────────────────────────────────

export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const { posts, commentsByPost, postVotes, castPostVote, addComment, loadCommentsForPost, deletePost, editPost } = useForum();

  const post     = posts.find((p) => p.id === id);
  const comments = commentsByPost[id ?? ''] ?? [];

  const [replyingTo,   setReplyingTo]   = useState<string | null>(null);
  const [commentText,  setCommentText]  = useState('');
  const [submitting,   setSubmitting]   = useState(false);
  const [commentError, setCommentError] = useState('');
  const [loadingCmts,  setLoadingCmts]  = useState(false);

  const canManage =
    !!post && !!user &&
    (user.id === post.authorId || user.name === post.author);

  const postDir = (postVotes[id ?? ''] ?? 0) as 0|1|-1;
  const inputRef = useRef<TextInput>(null);

  // ── Post action sheet state ───────────────────────────────────────────────────
  const [sheetOpen,     setSheetOpen]     = useState(false);
  const [confirming,    setConfirming]    = useState(false);
  const [editOpen,      setEditOpen]      = useState(false);
  const [editTitle,     setEditTitle]     = useState('');
  const [editContent,   setEditContent]   = useState('');
  const [editSaving,    setEditSaving]    = useState(false);
  const [editError,     setEditError]     = useState('');

  const openSheet = () => {
    setConfirming(false);
    setSheetOpen(true);
  };
  const closeSheet = () => { setSheetOpen(false); setConfirming(false); };

  const openEdit = () => {
    if (!post) return;
    setEditTitle(post.title);
    setEditContent(post.content);
    setEditError('');
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editTitle.trim() || !editContent.trim()) return;
    setEditSaving(true);
    setEditError('');
    try {
      await editPost(id!, { title: editTitle.trim(), content: editContent.trim() });
      setEditOpen(false);
    } catch (e: unknown) {
      setEditError(e instanceof Error ? e.message : 'Failed to save.');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    await deletePost(id!);
    closeSheet();
    router.back();
  };

  // Load comments on mount
  useEffect(() => {
    if (!id) return;
    setLoadingCmts(true);
    loadCommentsForPost(id).finally(() => setLoadingCmts(false));
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleAddComment = async () => {
    if (!commentText.trim() || submitting) return;
    setSubmitting(true);
    setCommentError('');
    try {
      await addComment(id!, commentText.trim());
      setCommentText('');
    } catch (e: unknown) {
      setCommentError(e instanceof Error ? e.message : 'Failed to post comment.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!post) {
    return (
      <>
        <Stack.Screen options={{ title: 'Post' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: C.bg }}>
          <ActivityIndicator color={C.textTertiary} />
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: post.category, headerTitleAlign: 'center', headerBackTitle: 'Forum' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: C.bg }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}
          ListHeaderComponent={
            <View>
              {/* Post content */}
              <View style={styles.postCard}>
                <CategoryPill category={post.category} />

                <Text style={styles.postTitle}>{post.title}</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 4 }}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{post.author[0].toUpperCase()}</Text>
                  </View>
                  <Text style={styles.authorName}>{post.author}</Text>
                  {post.authorBadge === 'mod' && <ModBadge />}
                  <Text style={styles.metaText}> · {relativeTime(post.createdAt)}</Text>
                </View>

                <Text style={styles.postBody}>{post.content}</Text>

                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Pressable onPress={() => castPostVote(post.id, 1)} hitSlop={8}>
                      <Text style={{ fontSize: 18, color: postDir === 1 ? C.upvote : C.textTertiary }}>▲</Text>
                    </Pressable>
                    <Text style={{ fontSize: 14, fontWeight: '700', minWidth: 28, textAlign: 'center', color: postDir === 1 ? C.upvote : postDir === -1 ? '#4A7EC7' : C.textSecondary }}>
                      {post.votes + postDir}
                    </Text>
                    <Pressable onPress={() => castPostVote(post.id, -1)} hitSlop={8}>
                      <Text style={{ fontSize: 18, color: postDir === -1 ? '#4A7EC7' : C.textTertiary }}>▼</Text>
                    </Pressable>
                  </View>
                  {canManage && (
                    <TouchableOpacity onPress={openSheet} hitSlop={{ top: 16, bottom: 16, left: 16, right: 16 }}>
                      <Text style={{ fontSize: 18, color: C.textTertiary }}>⋯</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Comments header */}
              <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {loadingCmts ? 'Loading…' : `${comments.length} Comment${comments.length !== 1 ? 's' : ''}`}
                </Text>
                {loadingCmts && <ActivityIndicator size="small" color={C.textTertiary} />}
              </View>

              {/* Empty comments nudge */}
              {!loadingCmts && comments.length === 0 && (
                <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
                  <Text style={{ fontSize: 13, color: C.textTertiary }}>
                    No comments yet. Be the first to share your thoughts.
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item }) => (
            <View style={{ paddingHorizontal: 12, marginBottom: 8 }}>
              <CommentRow
                comment={item}
                postId={id!}
                replyingToId={replyingTo}
                setReplyingTo={setReplyingTo}
                onError={setCommentError}
              />
            </View>
          )}
        />

        {/* ── Error banner ── */}
        {commentError ? (
          <View style={{ backgroundColor: '#FEF0EF', borderTopWidth: 1, borderTopColor: '#F0CECE', paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={{ fontSize: 12, color: C.error, lineHeight: 17, flex: 1 }}>{commentError}</Text>
            <Pressable onPress={() => setCommentError('')} hitSlop={8}>
              <Text style={{ fontSize: 16, color: C.error, marginLeft: 8 }}>✕</Text>
            </Pressable>
          </View>
        ) : null}

        {/* ── Add comment bar ── */}
        <View style={styles.commentBar}>
          <TextInput
            ref={inputRef}
            value={commentText}
            onChangeText={(t) => { setCommentText(t); setCommentError(''); }}
            placeholder="Add a comment…"
            placeholderTextColor={C.textTertiary}
            style={[styles.commentInput, { flex: 1 }]}
            multiline
          />
          <Pressable
            style={[styles.sendBtn, (!commentText.trim() || submitting) && { backgroundColor: C.border }]}
            onPress={handleAddComment}
            disabled={submitting || !commentText.trim()}
          >
            {submitting
              ? <ActivityIndicator size="small" color="#FFF" />
              : <Text style={{ color: '#FFF', fontSize: 16 }}>↑</Text>
            }
          </Pressable>
        </View>
      </KeyboardAvoidingView>

      {/* ── Post action sheet ── */}
      <Modal visible={sheetOpen} transparent animationType="fade" onRequestClose={closeSheet}>
        <Pressable style={styles.sheetOverlay} onPress={closeSheet}>
          <Pressable style={styles.sheet} onPress={() => {}}>
            {confirming ? (
              <>
                <Text style={styles.sheetConfirmText}>Delete this post? This cannot be undone.</Text>
                <TouchableOpacity style={[styles.sheetItem, { borderTopWidth: 1, borderTopColor: C.border }]} onPress={handleDelete}>
                  <Text style={[styles.sheetItemText, { color: C.error }]}>Yes, delete</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sheetItem, { borderTopWidth: 1, borderTopColor: C.border }]} onPress={() => setConfirming(false)}>
                  <Text style={styles.sheetItemText}>Cancel</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <TouchableOpacity style={styles.sheetItem} onPress={() => { closeSheet(); openEdit(); }}>
                  <Text style={styles.sheetItemText}>Edit post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sheetItem, { borderTopWidth: 1, borderTopColor: C.border }]} onPress={() => setConfirming(true)}>
                  <Text style={[styles.sheetItemText, { color: C.error }]}>Delete post</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.sheetItem, styles.sheetCancel]} onPress={closeSheet}>
                  <Text style={[styles.sheetItemText, { color: C.textTertiary }]}>Cancel</Text>
                </TouchableOpacity>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Inline edit modal ── */}
      <Modal visible={editOpen} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setEditOpen(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={styles.editHeader}>
            <TouchableOpacity onPress={() => setEditOpen(false)} hitSlop={10}>
              <Text style={{ fontSize: 14, color: C.textTertiary }}>Cancel</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 15, fontWeight: '700', color: C.textPrimary }}>Edit Post</Text>
            <TouchableOpacity onPress={saveEdit} disabled={editSaving}>
              {editSaving
                ? <ActivityIndicator size="small" color={C.accent} />
                : <Text style={{ fontSize: 14, fontWeight: '700', color: C.accent }}>Save</Text>
              }
            </TouchableOpacity>
          </View>
          <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
            {editError ? (
              <View style={{ backgroundColor: '#FEF0EF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#F0CECE' }}>
                <Text style={{ fontSize: 13, color: C.error }}>{editError}</Text>
              </View>
            ) : null}
            <TextInput
              value={editTitle}
              onChangeText={setEditTitle}
              placeholder="Title"
              placeholderTextColor={C.textTertiary}
              style={styles.editInput}
              multiline
            />
            <TextInput
              value={editContent}
              onChangeText={setEditContent}
              placeholder="Content"
              placeholderTextColor={C.textTertiary}
              style={[styles.editInput, { minHeight: 140, textAlignVertical: 'top' }]}
              multiline
            />
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  postCard: {
    backgroundColor: C.card, margin: 12, borderRadius: 16,
    borderWidth: 1, borderColor: C.border, padding: 20, gap: 12,
  },
  postTitle: { fontSize: 18, fontWeight: '700', color: C.textPrimary, lineHeight: 26, letterSpacing: -0.3 },
  postBody:  { fontSize: 14.5, color: C.textSecondary, lineHeight: 23 },

  commentCard: { backgroundColor: C.card, borderRadius: 14, borderWidth: 1, borderColor: C.border, padding: 14 },
  commentBody: { fontSize: 14, color: C.textSecondary, lineHeight: 21 },

  replyRow:  { flexDirection: 'row', marginTop: 12, paddingLeft: 4 },
  replyLine: { width: 2, backgroundColor: C.border, borderRadius: 1, marginRight: 12, marginTop: 2 },

  avatar:         { width: 26, height: 26, borderRadius: 13, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', marginRight: 6 },
  avatarText:     { fontSize: 11, fontWeight: '700', color: '#FFF' },
  avatarSmall:    { width: 20, height: 20, borderRadius: 10, backgroundColor: '#888', alignItems: 'center', justifyContent: 'center', marginRight: 5 },
  avatarTextSmall:{ fontSize: 9, fontWeight: '700', color: '#FFF' },

  authorName: { fontSize: 13, fontWeight: '600', color: C.textPrimary },
  metaText:   { fontSize: 12, color: C.textTertiary },

  inlineReply: { marginTop: 12, backgroundColor: C.bg, borderRadius: 10, padding: 10 },
  inlineInput: { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10, fontSize: 13, color: C.textPrimary, minHeight: 44 },

  commentBar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: C.border,
    backgroundColor: C.card,
  },
  commentInput: {
    backgroundColor: C.bg, borderRadius: 20, paddingHorizontal: 14,
    paddingVertical: 9, fontSize: 14, color: C.textPrimary,
    borderWidth: 1, borderColor: C.border, maxHeight: 80,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    marginLeft: 8,
  },

  // ── Action sheet ──
  sheetOverlay:      { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:             { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34, overflow: 'hidden' },
  sheetConfirmText:  { fontSize: 14, color: C.textSecondary, textAlign: 'center', paddingHorizontal: 24, paddingVertical: 20, lineHeight: 21 },
  sheetItem:         { paddingVertical: 17, paddingHorizontal: 24, alignItems: 'center' },
  sheetItemText:     { fontSize: 16, fontWeight: '500', color: C.textPrimary },
  sheetCancel:       { marginTop: 8, borderTopWidth: 8, borderTopColor: C.bg },

  // ── Edit modal ──
  editHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  editInput: {
    backgroundColor: C.card, borderWidth: 1, borderColor: C.border,
    borderRadius: 10, padding: 12, fontSize: 14, color: C.textPrimary,
  },
});
