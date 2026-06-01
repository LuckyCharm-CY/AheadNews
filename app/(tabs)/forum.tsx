import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
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
import type { Post, PostCategory, SortMode } from '@/src/features/forum/types';
import { useGroups } from '@/src/features/groups/GroupsContext';
import type { Group } from '@/src/features/groups/types';

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
  'Singapore':     { bg: '#F1EDFB', text: '#5B3FA0' },
  'Sports':        { bg: '#FAF0F4', text: '#9E3060' },
  'Life':          { bg: '#E8F8F3', text: '#1F7A5B' },
};

// Short labels for the filter bar
const CATEGORY_SHORT: Record<string, string> = {
  'All':          'All',
  'World News':   'World',
  'Tech & AI':    'AI & Tech',
  'Business':     'Business',
  'Local SG News':'Local SG',
  'Sports':       'Sports',
  'Life':         'Life',
};

const ALL_CATEGORIES: PostCategory[] = [
  'World News', 'Tech & AI', 'Business', 'Local SG News', 'Sports', 'Life',
];

const SORT_MODES: SortMode[] = ['Hot', 'New', 'Top'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 60)  return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24)  return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function hotScore(p: Post) {
  const age = (Date.now() - new Date(p.createdAt).getTime()) / 3_600_000;
  return p.votes / Math.pow(age + 2, 1.5);
}

// ─── Micro-components ─────────────────────────────────────────────────────────

function CategoryPill({ category }: { category: string }) {
  const s = CATEGORY_STYLE[category] ?? { bg: '#F1EFE8', text: '#5F5E5A' };
  return (
    <View style={{ backgroundColor: s.bg, borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2 }}>
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

// ─── Vote controls ────────────────────────────────────────────────────────────

function VoteRow({
  baseVotes, voteDir, onUp, onDown, commentCount, onComment,
}: {
  baseVotes:    number;
  voteDir:      0 | 1 | -1;
  onUp:         () => void;
  onDown:       () => void;
  commentCount?: number;
  onComment?:   () => void;
}) {
  const score = baseVotes + voteDir;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
      <View style={styles.votePill}>
        <Pressable onPress={onUp} hitSlop={6} style={styles.voteBtn}>
          <Ionicons name="arrow-up" size={14} color={voteDir === 1 ? C.upvote : C.textTertiary} />
        </Pressable>
        <Text style={[styles.voteScore, voteDir === 1 ? { color: C.upvote } : voteDir === -1 ? { color: '#4A7EC7' } : {}]}>
          {score}
        </Text>
        <Pressable onPress={onDown} hitSlop={6} style={styles.voteBtn}>
          <Ionicons name="arrow-down" size={14} color={voteDir === -1 ? '#4A7EC7' : C.textTertiary} />
        </Pressable>
      </View>

      {commentCount !== undefined && (
        <Pressable onPress={onComment} style={styles.commentBtn}>
          <Ionicons name="chatbubble-outline" size={13} color={C.textTertiary} />
          <Text style={styles.commentCount}>{commentCount}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Post action sheet ────────────────────────────────────────────────────────

function PostActionSheet({ visible, onClose, onEdit, onDelete }: {
  visible: boolean; onClose: () => void; onEdit: () => void; onDelete: () => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const handleClose = () => { setConfirming(false); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.sheetOverlay} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          {confirming ? (
            <>
              <Text style={styles.sheetConfirmText}>Delete this post? This cannot be undone.</Text>
              <TouchableOpacity style={[styles.sheetItem, { borderTopWidth: 1, borderTopColor: C.border }]} onPress={() => { handleClose(); onDelete(); }}>
                <Text style={[styles.sheetItemText, { color: C.error }]}>Yes, delete</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetItem, { borderTopWidth: 1, borderTopColor: C.border }]} onPress={() => setConfirming(false)}>
                <Text style={styles.sheetItemText}>Cancel</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={styles.sheetItem} onPress={() => { handleClose(); onEdit(); }}>
                <Text style={styles.sheetItemText}>Edit post</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetItem, { borderTopWidth: 1, borderTopColor: C.border }]} onPress={() => setConfirming(true)}>
                <Text style={[styles.sheetItemText, { color: C.error }]}>Delete post</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.sheetItem, styles.sheetCancel]} onPress={handleClose}>
                <Text style={[styles.sheetItemText, { color: C.textTertiary }]}>Cancel</Text>
              </TouchableOpacity>
            </>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Post card ────────────────────────────────────────────────────────────────

function PostCard({ post, onEdit }: { post: Post; onEdit: (post: Post) => void }) {
  const router = useRouter();
  const { user } = useAuth();
  const { postVotes, castPostVote, deletePost } = useForum();
  const dir = (postVotes[post.id] ?? 0) as 0 | 1 | -1;
  const scale = useRef(new Animated.Value(1)).current;
  const canManage = !!user && (user.id === post.authorId || user.name === post.author);
  const [sheetOpen, setSheetOpen] = useState(false);

  return (
    <>
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <Pressable
          onPress={() => router.push(`/post/${post.id}`)}
          onPressIn={() => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start()}
          onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}
        >
          {post.isStickied && (
            <View style={styles.stickyBanner}>
              <Text style={styles.stickyText}>Pinned</Text>
            </View>
          )}
          <Text style={styles.postTitle} numberOfLines={2}>{post.title}</Text>
          {post.content ? <Text style={styles.postPreview} numberOfLines={2}>{post.content}</Text> : null}

          <View style={styles.metaRow}>
            <CategoryPill category={post.category} />
            <Text style={styles.metaText}>{post.author}</Text>
            {post.authorBadge === 'mod' && <ModBadge />}
            <Text style={styles.metaDot}>·</Text>
            <Text style={styles.metaText}>{relativeTime(post.createdAt)}</Text>
          </View>
        </Pressable>

        <View style={styles.cardActions}>
          <VoteRow
            baseVotes={post.votes}
            voteDir={dir}
            onUp={() => castPostVote(post.id, 1)}
            onDown={() => castPostVote(post.id, -1)}
            commentCount={post.commentCount}
            onComment={() => router.push(`/post/${post.id}`)}
          />
          {canManage && (
            <TouchableOpacity onPress={() => setSheetOpen(true)} hitSlop={12} style={{ padding: 4 }}>
              <Ionicons name="ellipsis-horizontal" size={18} color={C.textTertiary} />
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      <PostActionSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onEdit={() => { setSheetOpen(false); onEdit(post); }}
        onDelete={() => { setSheetOpen(false); deletePost(post.id); }}
      />
    </>
  );
}

// ─── Post form sheet ──────────────────────────────────────────────────────────

function PostFormSheet({
  visible, title: headerTitle, initialTitle, initialContent, initialCategory,
  submitLabel, onSubmit, onClose,
}: {
  visible: boolean; title: string; initialTitle?: string; initialContent?: string;
  initialCategory?: PostCategory; submitLabel: string;
  onSubmit: (draft: { title: string; content: string; category: PostCategory }) => Promise<void>;
  onClose: () => void;
}) {
  const [postTitle,  setPostTitle]  = useState(initialTitle   ?? '');
  const [content,    setContent]    = useState(initialContent ?? '');
  const [category,   setCategory]   = useState<PostCategory>(initialCategory ?? 'World News');
  const [submitting, setSubmitting] = useState(false);
  const [submitError,setSubmitError]= useState('');

  const canSubmit = postTitle.trim().length > 0 && content.trim().length > 0 && !submitting;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setSubmitting(true); setSubmitError('');
    try {
      await onSubmit({ title: postTitle.trim(), content: content.trim(), category });
      onClose();
    } catch (e: unknown) {
      setSubmitError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally { setSubmitting(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheetHeader}>
          <Pressable onPress={onClose} hitSlop={10}><Text style={{ fontSize: 14, color: C.textTertiary }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.textPrimary }}>{headerTitle}</Text>
          <Pressable onPress={handleSubmit} disabled={!canSubmit}>
            {submitting
              ? <ActivityIndicator size="small" color={C.accent} />
              : <Text style={{ fontSize: 14, fontWeight: '700', color: canSubmit ? C.accent : C.textTertiary }}>{submitLabel}</Text>
            }
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={{ padding: 20, gap: 14 }} keyboardShouldPersistTaps="handled">
          {submitError ? (
            <View style={{ backgroundColor: '#FEF0EF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#F0CECE' }}>
              <Text style={{ fontSize: 13, color: C.error, lineHeight: 19 }}>{submitError}</Text>
            </View>
          ) : null}

          {!initialCategory && (
            <View>
              <Text style={styles.fieldLabel}>Category</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 6 }}>
                {ALL_CATEGORIES.map((c) => (
                  <Pressable key={c} onPress={() => setCategory(c)}
                    style={[styles.categoryBtn, category === c && { backgroundColor: C.accent, borderColor: C.accent }]}>
                    <Text style={{ fontSize: 13, color: category === c ? '#FFF' : C.textPrimary, fontWeight: '500' }}>{c}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          )}

          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Text style={styles.fieldLabel}>Title</Text>
              <Text style={{ fontSize: 11, color: postTitle.length > 140 ? C.error : C.textTertiary }}>{postTitle.length} / 150</Text>
            </View>
            <TextInput value={postTitle} onChangeText={t => setPostTitle(t.slice(0, 150))}
              placeholder="What do you want to discuss?" placeholderTextColor={C.textTertiary}
              style={[styles.input, { marginTop: 6 }]} multiline />
          </View>

          <View>
            <Text style={styles.fieldLabel}>Content</Text>
            <TextInput value={content} onChangeText={setContent}
              placeholder="Share your thoughts, analysis, or questions…" placeholderTextColor={C.textTertiary}
              style={[styles.input, { marginTop: 6, height: 140, textAlignVertical: 'top' }]} multiline />
          </View>

          <Text style={{ fontSize: 11, color: C.textTertiary, textAlign: 'center' }}>
            Posts are reviewed for harmful content before publishing.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── Groups ───────────────────────────────────────────────────────────────────

function CreateGroupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { createGroup } = useGroups();
  const [name, setName]             = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emails, setEmails]         = useState<string[]>([]);
  const [saving, setSaving]         = useState(false);
  const [error, setError]           = useState('');

  const addEmail = () => {
    const e = emailInput.trim().toLowerCase();
    if (!e || !e.includes('@')) return;
    if (!emails.includes(e)) setEmails(prev => [...prev, e]);
    setEmailInput('');
  };

  const handleCreate = async () => {
    if (!name.trim()) { setError('Please enter a group name.'); return; }
    setSaving(true); setError('');
    try {
      await createGroup(name.trim(), emails);
      setName(''); setEmailInput(''); setEmails([]); onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create group.');
    } finally { setSaving(false); }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheetHeader}>
          <Pressable onPress={onClose} hitSlop={10}><Text style={{ fontSize: 14, color: C.textTertiary }}>Cancel</Text></Pressable>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.textPrimary }}>New Group</Text>
          <TouchableOpacity onPress={handleCreate} disabled={saving}>
            {saving ? <ActivityIndicator size="small" color={C.accent} />
                    : <Text style={{ fontSize: 14, fontWeight: '700', color: name.trim() ? C.accent : C.textTertiary }}>Create</Text>}
          </TouchableOpacity>
        </View>
        <ScrollView contentContainerStyle={{ padding: 20, gap: 16 }} keyboardShouldPersistTaps="handled">
          {error ? <View style={{ backgroundColor: '#FEF0EF', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#F0CECE' }}>
            <Text style={{ fontSize: 13, color: C.error }}>{error}</Text></View> : null}
          <View>
            <Text style={styles.fieldLabel}>Group Name</Text>
            <TextInput value={name} onChangeText={setName} placeholder="e.g. SG Tech Friends"
              placeholderTextColor={C.textTertiary} style={[styles.input, { marginTop: 6 }]} />
          </View>
          <View>
            <Text style={styles.fieldLabel}>Invite by Email (optional)</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
              <TextInput value={emailInput} onChangeText={setEmailInput} placeholder="friend@email.com"
                placeholderTextColor={C.textTertiary} keyboardType="email-address" autoCapitalize="none"
                style={[styles.input, { flex: 1 }]} onSubmitEditing={addEmail} returnKeyType="done" />
              <TouchableOpacity onPress={addEmail}
                style={{ backgroundColor: C.accent, borderRadius: 10, paddingHorizontal: 14, justifyContent: 'center' }}>
                <Text style={{ color: '#fff', fontWeight: '700', fontSize: 18 }}>+</Text>
              </TouchableOpacity>
            </View>
            {emails.length > 0 && (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {emails.map(e => (
                  <TouchableOpacity key={e} onPress={() => setEmails(prev => prev.filter(x => x !== e))}
                    style={{ backgroundColor: C.border, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 12, color: C.textSecondary }}>{e}</Text>
                    <Text style={{ fontSize: 12, color: C.textTertiary }}>✕</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <Text style={{ fontSize: 11, color: C.textTertiary, marginTop: 8 }}>Tap a tag to remove.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function GroupCard({ group }: { group: Group }) {
  const router = useRouter();
  return (
    <TouchableOpacity onPress={() => router.push(`/group/${group.id}` as never)} style={styles.groupCard} activeOpacity={0.75}>
      <View style={styles.groupAvatar}>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#fff' }}>{group.name.slice(0, 2).toUpperCase()}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: '700', color: C.textPrimary }}>{group.name}</Text>
        <Text style={{ fontSize: 12, color: C.textTertiary, marginTop: 2 }}>Created {relativeTime(group.createdAt)} ago</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={C.textTertiary} />
    </TouchableOpacity>
  );
}

function GroupsModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { groups, isLoading } = useGroups();
  const [createOpen, setCreateOpen] = useState(false);

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: C.bg }}>
        <View style={styles.sheetHeader}>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={{ fontSize: 14, color: C.textTertiary }}>Done</Text>
          </Pressable>
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.textPrimary }}>Groups</Text>
          <TouchableOpacity onPress={() => setCreateOpen(true)}>
            <Ionicons name="add" size={22} color={C.accent} />
          </TouchableOpacity>
        </View>

        {isLoading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color={C.textTertiary} />
          </View>
        ) : groups.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Ionicons name="people-outline" size={40} color={C.textTertiary} />
            <Text style={{ fontSize: 15, fontWeight: '600', color: C.textPrimary, marginTop: 14, marginBottom: 6 }}>No groups yet</Text>
            <Text style={{ fontSize: 13, color: C.textTertiary, textAlign: 'center', lineHeight: 19 }}>
              Create a private group to share news with friends.
            </Text>
            <TouchableOpacity onPress={() => setCreateOpen(true)}
              style={{ marginTop: 20, backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Create your first group</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <FlatList
            data={groups}
            keyExtractor={g => g.id}
            renderItem={({ item }) => <GroupCard group={item} />}
            contentContainerStyle={{ padding: 12, gap: 10, paddingBottom: 40 }}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>
      <CreateGroupSheet visible={createOpen} onClose={() => setCreateOpen(false)} />
    </Modal>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function ForumScreen() {
  const { posts, postVotes, isLoadingPosts, addPost, editPost } = useForum();
  const [sortMode,       setSortMode]       = useState<SortMode>('Hot');
  const [activeCategory, setActiveCategory] = useState<PostCategory | 'All'>('All');
  const [composeOpen,    setComposeOpen]    = useState(false);
  const [editingPost,    setEditingPost]    = useState<Post | null>(null);
  const [groupsOpen,     setGroupsOpen]     = useState(false);

  const sorted = useMemo(() => {
    const stickied = posts.filter(p => p.isStickied);
    let rest = posts.filter(p => !p.isStickied);
    if (activeCategory !== 'All') rest = rest.filter(p => p.category === activeCategory);
    if (sortMode === 'Hot') rest = [...rest].sort((a, b) => hotScore(b) - hotScore(a));
    if (sortMode === 'New') rest = [...rest].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    if (sortMode === 'Top') rest = [...rest].sort((a, b) =>
      (b.votes + (postVotes[b.id] ?? 0)) - (a.votes + (postVotes[a.id] ?? 0)));
    return [...stickied, ...rest];
  }, [posts, sortMode, activeCategory, postVotes]);

  return (
    <View style={styles.screen}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSub}>{posts.length} discussion{posts.length !== 1 ? 's' : ''}</Text>
        </View>
        <TouchableOpacity onPress={() => setGroupsOpen(true)} style={styles.groupsBtn}>
          <Ionicons name="people-outline" size={18} color={C.textPrimary} />
          <Text style={styles.groupsBtnText}>Groups</Text>
        </TouchableOpacity>
      </View>

      {/* ── Single filter row: categories + sort ── */}
      <View style={styles.filterRow}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterScroll}
        >
          {(['All', ...ALL_CATEGORIES] as const).map(c => {
            const active = activeCategory === c;
            const catStyle = CATEGORY_STYLE[c];
            return (
              <Pressable
                key={c}
                onPress={() => setActiveCategory(c)}
                style={[
                  styles.filterPill,
                  active && (catStyle
                    ? { backgroundColor: catStyle.bg, borderColor: catStyle.text + '50' }
                    : styles.filterPillActive),
                ]}
              >
                <Text style={[
                  styles.filterPillText,
                  active && (catStyle ? { color: catStyle.text, fontWeight: '700' } : styles.filterPillTextActive),
                ]}>
                  {CATEGORY_SHORT[c] ?? c}
                </Text>
              </Pressable>
            );
          })}

          {/* Sort toggle at end of row */}
          <View style={styles.sortDivider} />
          {SORT_MODES.map(m => (
            <Pressable
              key={m}
              onPress={() => setSortMode(m)}
              style={[styles.sortPill, sortMode === m && styles.sortPillActive]}
            >
              <Text style={[styles.sortPillText, sortMode === m && styles.sortPillTextActive]}>{m}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* ── Post list ── */}
      {isLoadingPosts ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator color={C.textTertiary} />
          <Text style={{ fontSize: 13, color: C.textTertiary, marginTop: 10 }}>Loading…</Text>
        </View>
      ) : sorted.length === 0 ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
          <Ionicons name="chatbubbles-outline" size={40} color={C.textTertiary} />
          <Text style={{ fontSize: 15, fontWeight: '700', color: C.textPrimary, marginTop: 14, marginBottom: 6 }}>No posts yet</Text>
          <Text style={{ fontSize: 13, color: C.textTertiary, textAlign: 'center', lineHeight: 19, marginBottom: 20 }}>
            {activeCategory === 'All' ? 'Be the first to start a discussion.' : `No posts in ${activeCategory} yet.`}
          </Text>
          <Pressable onPress={() => setComposeOpen(true)}
            style={{ backgroundColor: C.accent, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#fff' }}>Write a post</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={sorted}
          keyExtractor={p => p.id}
          renderItem={({ item }) => <PostCard post={item} onEdit={setEditingPost} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* ── FAB ── */}
      <Pressable style={styles.fab} onPress={() => setComposeOpen(true)}>
        <Ionicons name="add" size={26} color="#FFF" />
      </Pressable>

      {/* ── Modals ── */}
      <PostFormSheet
        visible={composeOpen} title="New Post" submitLabel="Post"
        onSubmit={draft => addPost(draft)} onClose={() => setComposeOpen(false)}
      />
      {editingPost && (
        <PostFormSheet
          visible={!!editingPost} title="Edit Post" submitLabel="Save"
          initialTitle={editingPost.title} initialContent={editingPost.content}
          initialCategory={editingPost.category}
          onSubmit={draft => editPost(editingPost.id, draft)}
          onClose={() => setEditingPost(null)}
        />
      )}
      <GroupsModal visible={groupsOpen} onClose={() => setGroupsOpen(false)} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },

  header: {
    paddingHorizontal: 20, paddingTop: 60, paddingBottom: 14,
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
  },
  headerTitle: { fontSize: 26, fontWeight: '700', color: C.textPrimary, letterSpacing: -0.6 },
  headerSub:   { fontSize: 12, color: C.textTertiary, marginTop: 2 },
  groupsBtn:   { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.card, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 7, borderWidth: 1, borderColor: C.border },
  groupsBtnText: { fontSize: 13, fontWeight: '600', color: C.textPrimary },

  // ── Single filter row ──
  filterRow:    { borderBottomWidth: 1, borderBottomColor: C.border, backgroundColor: C.bg },
  filterScroll: { paddingHorizontal: 16, paddingVertical: 10, gap: 7, alignItems: 'center' },
  filterPill:   { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: C.border, backgroundColor: C.card },
  filterPillActive:     { backgroundColor: C.accent, borderColor: C.accent },
  filterPillText:       { fontSize: 12, color: C.textSecondary },
  filterPillTextActive: { color: '#FFF', fontWeight: '600' },

  sortDivider: { width: 1, height: 20, backgroundColor: C.border, marginHorizontal: 4 },
  sortPill:         { paddingHorizontal: 11, paddingVertical: 5, borderRadius: 20, borderWidth: 1, borderColor: 'transparent' },
  sortPillActive:   { borderColor: C.border, backgroundColor: C.card },
  sortPillText:     { fontSize: 12, color: C.textTertiary, fontWeight: '500' },
  sortPillTextActive: { color: C.textPrimary, fontWeight: '700' },

  list: { padding: 12, paddingBottom: 100, gap: 10 },

  card:         { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 16 },
  stickyBanner: { backgroundColor: '#FFF8E7', borderRadius: 5, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 10, alignSelf: 'flex-start', borderWidth: 1, borderColor: '#F0D890' },
  stickyText:   { fontSize: 10, color: '#7D5A1F', fontWeight: '700', letterSpacing: 0.3, textTransform: 'uppercase' },
  postTitle:    { fontSize: 15, fontWeight: '700', color: C.textPrimary, lineHeight: 22, marginBottom: 5 },
  postPreview:  { fontSize: 13, color: C.textSecondary, lineHeight: 19, marginBottom: 10 },
  metaRow:      { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6, flexWrap: 'wrap' },
  metaText:     { fontSize: 12, color: C.textTertiary },
  metaDot:      { fontSize: 12, color: C.textTertiary },
  cardActions:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 12 },

  votePill:   { flexDirection: 'row', alignItems: 'center', backgroundColor: C.bg, borderRadius: 20, borderWidth: 1, borderColor: C.border, overflow: 'hidden' },
  voteBtn:    { paddingHorizontal: 10, paddingVertical: 7 },
  voteScore:  { fontSize: 12, fontWeight: '700', color: C.textSecondary, minWidth: 20, textAlign: 'center' },
  commentBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: C.bg, borderRadius: 20, borderWidth: 1, borderColor: C.border },
  commentCount:{ fontSize: 12, color: C.textTertiary, fontWeight: '600' },

  fab: {
    position: 'absolute', bottom: 28, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center',
    shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.18, shadowRadius: 6, elevation: 6,
  },

  sheetHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingVertical: 16,
    borderBottomWidth: 1, borderBottomColor: C.border,
  },
  fieldLabel:  { fontSize: 11, fontWeight: '700', color: C.textTertiary, textTransform: 'uppercase', letterSpacing: 0.7 },
  input:       { backgroundColor: C.card, borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 12, fontSize: 14, color: C.textPrimary },
  categoryBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1, borderColor: C.border, marginRight: 7, backgroundColor: C.card },

  groupCard:   { backgroundColor: C.card, borderRadius: 16, borderWidth: 1, borderColor: C.border, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  groupAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center' },

  sheetOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  sheet:        { backgroundColor: C.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 34, overflow: 'hidden' },
  sheetConfirmText: { fontSize: 14, color: C.textSecondary, textAlign: 'center', paddingHorizontal: 24, paddingVertical: 20, lineHeight: 21 },
  sheetItem:    { paddingVertical: 17, paddingHorizontal: 24, alignItems: 'center' },
  sheetItemText:{ fontSize: 16, fontWeight: '500', color: C.textPrimary },
  sheetCancel:  { marginTop: 8, borderTopWidth: 8, borderTopColor: C.bg },
});
