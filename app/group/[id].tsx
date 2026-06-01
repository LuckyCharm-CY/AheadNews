import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@/src/features/auth/AuthContext';
import { useGroups } from '@/src/features/groups/GroupsContext';
import type { GroupMessage } from '@/src/features/groups/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1)  return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short' });
}

function initials(name: string) {
  return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

// ─── Story card with inline comment thread ────────────────────────────────────

function StoryCard({ message }: { message: GroupMessage }) {
  return (
    <TouchableOpacity
      onPress={() => message.storyUrl && Linking.openURL(message.storyUrl)}
      style={styles.storyWrap}
      activeOpacity={0.85}
    >
      <View style={styles.sourcePill}>
        <Text style={styles.sourceText}>{message.storySource ?? 'News'}</Text>
      </View>
      <Text style={styles.storyHeadline}>{message.storyHeadline}</Text>
      {message.storySummary ? (
        <Text numberOfLines={2} style={styles.storySummary}>{message.storySummary}</Text>
      ) : null}
      {message.storyUrl ? (
        <Text style={styles.storyReadLink}>Read article →</Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Text message bubble ──────────────────────────────────────────────────────

function MessageBubble({
  message,
  isSelf,
}: {
  message: GroupMessage;
  isSelf:  boolean;
}) {
  if (message.messageType === 'story') {
    return (
      <View style={[styles.bubbleRow, isSelf && styles.bubbleRowSelf]}>
        {!isSelf && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials(message.author)}</Text>
          </View>
        )}
        <View style={[styles.bubbleWrap, isSelf && styles.bubbleWrapSelf, { maxWidth: '90%' }]}>
          {!isSelf && <Text style={styles.senderName}>{message.author}</Text>}
          <StoryCard message={message} />
          <Text style={[styles.timestamp, isSelf && { textAlign: 'right' }]}>
            {relativeTime(message.createdAt)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.bubbleRow, isSelf && styles.bubbleRowSelf]}>
      {!isSelf && (
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials(message.author)}</Text>
        </View>
      )}
      <View style={[styles.bubbleWrap, isSelf && styles.bubbleWrapSelf]}>
        {!isSelf && <Text style={styles.senderName}>{message.author}</Text>}
        <View style={[styles.bubble, isSelf && styles.bubbleSelf]}>
          <Text style={[styles.bubbleText, isSelf && styles.bubbleTextSelf]}>
            {message.content}
          </Text>
        </View>
        <Text style={[styles.timestamp, isSelf && { textAlign: 'right' }]}>
          {relativeTime(message.createdAt)}
        </Text>
      </View>
    </View>
  );
}

// ─── Add member sheet ─────────────────────────────────────────────────────────

function AddMemberSheet({ visible, groupId, onClose }: { visible: boolean; groupId: string; onClose: () => void }) {
  const { addMember } = useGroups();
  const [email,   setEmail]   = useState('');
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState('');
  const [success, setSuccess] = useState('');

  const handleAdd = async () => {
    if (!email.trim()) return;
    setLoading(true); setError(''); setSuccess('');
    try {
      await addMember(groupId, email.trim());
      setSuccess(`${email.trim()} added!`);
      setEmail('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add member.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.addSheet} onPress={() => {}}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#111110', marginBottom: 14 }}>Add member</Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <TextInput
              value={email} onChangeText={setEmail}
              placeholder="Email address" placeholderTextColor="#ADADAA"
              keyboardType="email-address" autoCapitalize="none"
              style={styles.addInput} onSubmitEditing={handleAdd} returnKeyType="done"
            />
            <TouchableOpacity
              onPress={handleAdd} disabled={loading}
              style={{ backgroundColor: '#111110', borderRadius: 10, paddingHorizontal: 16, justifyContent: 'center' }}
            >
              {loading ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontWeight: '700' }}>Add</Text>}
            </TouchableOpacity>
          </View>
          {error   && <Text style={{ fontSize: 12, color: '#C9392C', marginTop: 8 }}>{error}</Text>}
          {success && <Text style={{ fontSize: 12, color: '#2D7A4F', marginTop: 8 }}>{success}</Text>}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Group chat screen ────────────────────────────────────────────────────────

export default function GroupScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router  = useRouter();
  const { user } = useAuth();
  const {
    groups, messagesByGroup, membersByGroup,
    loadMessages, loadMembers, sendMessage, subscribeToGroup, leaveGroup,
  } = useGroups();

  const group    = groups.find(g => g.id === id);
  const messages = messagesByGroup[id ?? ''] ?? [];
  const members  = membersByGroup[id ?? ''] ?? [];

  const [text,           setText]           = useState('');
  const [sending,        setSending]        = useState(false);
  const [sendError,      setSendError]      = useState('');
  const [addMemberOpen,  setAddMemberOpen]  = useState(false);
  const [menuOpen,       setMenuOpen]       = useState(false);
  const [leaveConfirm,   setLeaveConfirm]   = useState(false);
  const [leaving,        setLeaving]        = useState(false);
  const [loading,        setLoading]        = useState(false);

  const flatRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    Promise.all([loadMessages(id), loadMembers(id)]).finally(() => setLoading(false));
    const unsub = subscribeToGroup(id);
    return unsub;
  }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => flatRef.current?.scrollToEnd({ animated: true }), 80);
    }
  }, [messages.length]);

  const handleLeave = async () => {
    setLeaving(true);
    try {
      await leaveGroup(id!);
      router.replace('/(tabs)/forum' as never);
    } catch {
      setLeaving(false);
      setLeaveConfirm(false);
    }
  };

  const handleSend = async () => {
    if (!text.trim() || sending) return;
    setSending(true);
    setSendError('');
    try {
      await sendMessage(id!, text.trim());
      setText('');
    } catch (e: unknown) {
      setSendError(e instanceof Error ? e.message : 'Failed to send.');
    } finally {
      setSending(false);
    }
  };

  if (!group && !loading) {
    return (
      <>
        <Stack.Screen options={{ title: 'Group' }} />
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F6F5F2' }}>
          <Text style={{ color: '#ADADAA' }}>Group not found.</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: group?.name ?? 'Group',
          headerTitleAlign: 'center',
          headerBackTitle: 'Groups',
          headerRight: () => (
            <TouchableOpacity onPress={() => setMenuOpen(true)} hitSlop={10} style={{ marginRight: 4 }}>
              <Text style={{ fontSize: 22, color: '#6B6A66', lineHeight: 26 }}>⋯</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: '#F6F5F2' }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={90}
      >
        {members.length > 0 && (
          <View style={styles.membersBar}>
            <Text style={{ fontSize: 11, color: '#6B6A66', fontWeight: '600', marginRight: 4 }}>
              {members.length} member{members.length !== 1 ? 's' : ''}
            </Text>
            <Text style={{ fontSize: 11, color: '#ADADAA' }} numberOfLines={1}>
              {members.slice(0, 3).map(m => m.username).join(', ')}
              {members.length > 3 ? ` and ${members.length - 3} more` : ''}
            </Text>
          </View>
        )}

        {loading ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator color="#ADADAA" />
          </View>
        ) : messages.length === 0 ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 }}>
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#111110', marginBottom: 6 }}>Start the conversation</Text>
            <Text style={{ fontSize: 13, color: '#ADADAA', textAlign: 'center' }}>
              Share a thought or a news story with the group.
            </Text>
          </View>
        ) : (
          <FlatList
            ref={flatRef}
            data={messages}
            keyExtractor={m => m.id}
            renderItem={({ item }) => (
              <MessageBubble message={item} isSelf={item.authorId === user?.id} />
            )}
            contentContainerStyle={{ padding: 12, paddingBottom: 8, gap: 10 }}
            showsVerticalScrollIndicator={false}
            onContentSizeChange={() => flatRef.current?.scrollToEnd({ animated: false })}
          />
        )}

        {/* ── Send error ── */}
        {sendError ? (
          <View style={{ backgroundColor: '#FEF0EF', paddingHorizontal: 16, paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F0CECE' }}>
            <Text style={{ fontSize: 12, color: '#C9392C' }}>{sendError}</Text>
          </View>
        ) : null}

        {/* ── Text input bar ── */}
        <View style={styles.inputBar}>
          <TextInput
            value={text} onChangeText={setText}
            placeholder="Message…" placeholderTextColor="#ADADAA"
            style={styles.textInput} multiline
          />
          <TouchableOpacity
            onPress={handleSend}
            disabled={!text.trim() || sending}
            style={[styles.sendBtn, (!text.trim() || sending) && { backgroundColor: '#E8E7E3' }]}
          >
            {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={{ color: '#fff', fontSize: 16 }}>↑</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>

      <AddMemberSheet visible={addMemberOpen} groupId={id!} onClose={() => setAddMemberOpen(false)} />

      {/* ── Group menu ── */}
      <Modal visible={menuOpen} transparent animationType="fade" onRequestClose={() => setMenuOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setMenuOpen(false)}>
          <Pressable style={styles.addSheet} onPress={() => {}}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111110', marginBottom: 16 }}>
              {group?.name ?? 'Group'}
            </Text>
            <TouchableOpacity
              onPress={() => { setMenuOpen(false); setAddMemberOpen(true); }}
              style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#E8E7E3' }}
            >
              <Text style={{ fontSize: 15, color: '#111110' }}>+ Add member</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => { setMenuOpen(false); setLeaveConfirm(true); }}
              style={{ paddingVertical: 14, borderTopWidth: 1, borderTopColor: '#E8E7E3' }}
            >
              <Text style={{ fontSize: 15, color: '#C9392C' }}>Leave group</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>

      {/* ── Leave confirm ── */}
      <Modal visible={leaveConfirm} transparent animationType="fade" onRequestClose={() => setLeaveConfirm(false)}>
        <Pressable style={styles.overlay} onPress={() => !leaving && setLeaveConfirm(false)}>
          <Pressable style={styles.addSheet} onPress={() => {}}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111110', marginBottom: 8 }}>Leave group?</Text>
            <Text style={{ fontSize: 13, color: '#6B6A66', marginBottom: 20 }}>
              You'll stop receiving messages from "{group?.name}". You can be re-added later.
            </Text>
            <TouchableOpacity
              onPress={handleLeave}
              disabled={leaving}
              style={{ backgroundColor: '#C9392C', borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginBottom: 10 }}
            >
              {leaving
                ? <ActivityIndicator color="#fff" size="small" />
                : <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Leave</Text>
              }
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setLeaveConfirm(false)}
              disabled={leaving}
              style={{ paddingVertical: 13, alignItems: 'center' }}
            >
              <Text style={{ fontSize: 15, color: '#6B6A66' }}>Cancel</Text>
            </TouchableOpacity>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  membersBar: {
    backgroundColor: '#F0EFEB', paddingHorizontal: 16, paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: '#E8E7E3',
    flexDirection: 'row', alignItems: 'center',
  },

  bubbleRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  bubbleRowSelf: { flexDirection: 'row-reverse' },
  bubbleWrap:    { maxWidth: '75%' },
  bubbleWrapSelf:{ alignItems: 'flex-end' },

  avatar:     { width: 28, height: 28, borderRadius: 14, backgroundColor: '#111110', alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  avatarText: { fontSize: 10, fontWeight: '700', color: '#fff' },

  senderName: { fontSize: 11, fontWeight: '600', color: '#ADADAA', marginBottom: 3, marginLeft: 2 },

  bubble:         { backgroundColor: '#FFFFFF', borderRadius: 18, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#E8E7E3' },
  bubbleSelf:     { backgroundColor: '#111110', borderBottomLeftRadius: 18, borderBottomRightRadius: 4, borderWidth: 0 },
  bubbleText:     { fontSize: 14, color: '#111110', lineHeight: 20 },
  bubbleTextSelf: { color: '#FFFFFF' },
  timestamp:      { fontSize: 10, color: '#ADADAA', marginTop: 3, marginHorizontal: 4 },

  // ── Story card ──
  storyWrap: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#E8E7E3',
    padding: 14,
  },
  sourcePill:    { alignSelf: 'flex-start', backgroundColor: '#F0EFEB', borderRadius: 4, paddingHorizontal: 7, paddingVertical: 2, marginBottom: 8 },
  sourceText:    { fontSize: 10, fontWeight: '700', color: '#6B6A66', textTransform: 'uppercase', letterSpacing: 0.5 },
  storyHeadline: { fontSize: 14, fontWeight: '700', color: '#111110', lineHeight: 20, marginBottom: 6 },
  storySummary:  { fontSize: 12, color: '#5A5955', lineHeight: 17, marginBottom: 8 },
  storyReadLink: { fontSize: 12, color: '#4A7EC7', fontWeight: '600' },

  // ── Chat input ──
  inputBar: {
    flexDirection: 'row', alignItems: 'flex-end',
    paddingHorizontal: 12, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: '#E8E7E3',
    backgroundColor: '#FFFFFF', gap: 8,
  },
  textInput: {
    flex: 1, backgroundColor: '#F6F5F2', borderRadius: 20,
    paddingHorizontal: 14, paddingVertical: 9,
    fontSize: 14, color: '#111110',
    borderWidth: 1, borderColor: '#E8E7E3', maxHeight: 100,
  },
  sendBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#111110', alignItems: 'center', justifyContent: 'center',
  },

  // ── Add member ──
  overlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  addSheet: { backgroundColor: '#FFFFFF', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24, paddingBottom: 40 },
  addInput: {
    flex: 1, backgroundColor: '#F6F5F2', borderRadius: 10,
    borderWidth: 1, borderColor: '#E8E7E3',
    paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: '#111110',
  },
});
