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
import type { Group, GroupMember, GroupMessage } from './types';

// ─── Row shapes ───────────────────────────────────────────────────────────────

type MessageRow = {
  id:             string;
  group_id:       string;
  author_id:      string;
  parent_id?:     string | null;
  message_type:   string;
  content:        string | null;
  story_headline?: string;
  story_source?:   string;
  story_url?:      string;
  story_summary?:  string;
  created_at:     string;
  profiles:       { username: string } | { username: string }[];
};

const MSG_SELECT =
  'id, group_id, author_id, parent_id, message_type, content, story_headline, story_source, story_url, story_summary, created_at, profiles!author_id(username)';

// ─── Mappers ──────────────────────────────────────────────────────────────────

function resolveUsername(embed: { username: string } | { username: string }[]): string {
  return (Array.isArray(embed) ? embed[0] : embed)?.username ?? 'Unknown';
}

function mapMessage(row: MessageRow): GroupMessage {
  return {
    id:            row.id,
    groupId:       row.group_id,
    authorId:      row.author_id,
    parentId:      row.parent_id ?? undefined,
    author:        resolveUsername(row.profiles),
    messageType:   row.message_type as 'text' | 'story',
    content:       row.content,
    storyHeadline: row.story_headline,
    storySource:   row.story_source,
    storyUrl:      row.story_url,
    storySummary:  row.story_summary,
    createdAt:     row.created_at,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

type GroupsCtx = {
  groups:           Group[];
  isLoading:        boolean;
  messagesByGroup:  Record<string, GroupMessage[]>;  // top-level only
  repliesByMessage: Record<string, GroupMessage[]>;  // keyed by parent message id
  membersByGroup:   Record<string, GroupMember[]>;
  createGroup:      (name: string, memberEmails: string[]) => Promise<Group>;
  addMember:        (groupId: string, email: string) => Promise<void>;
  leaveGroup:       (groupId: string) => Promise<void>;
  loadMessages:     (groupId: string) => Promise<void>;
  loadMembers:      (groupId: string) => Promise<void>;
  sendMessage:      (groupId: string, content: string) => Promise<void>;
  sendReply:        (groupId: string, parentId: string, content: string) => Promise<void>;
  shareStory:       (groupId: string, story: { headline: string; source: string; url?: string; summary?: string }) => Promise<void>;
  subscribeToGroup: (groupId: string) => () => void;
};

const GroupsContext = createContext<GroupsCtx | null>(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export function GroupsProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();

  const [groups,            setGroups]            = useState<Group[]>([]);
  const [isLoading,         setIsLoading]         = useState(false);
  const [messagesByGroup,   setMessagesByGroup]   = useState<Record<string, GroupMessage[]>>({});
  const [repliesByMessage,  setRepliesByMessage]  = useState<Record<string, GroupMessage[]>>({});
  const [membersByGroup,    setMembersByGroup]    = useState<Record<string, GroupMember[]>>({});

  // ── Fetch user's groups ───────────────────────────────────────────────────

  const fetchGroups = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    try {
      const { data } = await supabase
        .from('group_members')
        .select('group_id, role, joined_at, groups(id, name, created_by, created_at)')
        .eq('user_id', user.id)
        .order('joined_at', { ascending: false });

      if (!data) return;
      const mapped: Group[] = data
        .map((row: any) => {
          const g = Array.isArray(row.groups) ? row.groups[0] : row.groups;
          if (!g) return null;
          return { id: g.id, name: g.name, createdBy: g.created_by, createdAt: g.created_at };
        })
        .filter(Boolean) as Group[];
      setGroups(mapped);
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    fetchGroups();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Create group ─────────────────────────────────────────────────────────

  const createGroup = useCallback(async (name: string, memberEmails: string[]): Promise<Group> => {
    if (!user) throw new Error('Not signed in.');

    const { error: insertErr } = await supabase
      .from('groups')
      .insert({ name: name.trim(), created_by: user.id });
    if (insertErr) throw new Error(insertErr.message);

    const { data: groupData, error: fetchErr } = await supabase
      .from('groups')
      .select('id, name, created_by, created_at')
      .eq('created_by', user.id)
      .eq('name', name.trim())
      .order('created_at', { ascending: false })
      .limit(1)
      .single();
    if (fetchErr || !groupData) throw new Error(fetchErr?.message ?? 'Could not find created group.');

    const group: Group = {
      id: groupData.id, name: groupData.name,
      createdBy: groupData.created_by, createdAt: groupData.created_at,
    };

    await supabase.from('group_members')
      .insert({ group_id: group.id, user_id: user.id, role: 'owner' });

    for (const email of memberEmails.filter(Boolean)) {
      try { await _addMemberByEmail(group.id, email); } catch { /* skip */ }
    }

    setGroups(prev => [group, ...prev]);
    return group;
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Add member by email ──────────────────────────────────────────────────

  async function _addMemberByEmail(groupId: string, email: string) {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, username')
      .eq('email', email.toLowerCase().trim())
      .single();
    if (error || !profile) throw new Error(`No account found for ${email}.`);
    const { error: memberErr } = await supabase.from('group_members')
      .insert({ group_id: groupId, user_id: profile.id, role: 'member' });
    if (memberErr && !memberErr.message.includes('duplicate'))
      throw new Error(memberErr.message);
  }

  const addMember = useCallback(async (groupId: string, email: string) => {
    await _addMemberByEmail(groupId, email);
    await loadMembers(groupId);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const leaveGroup = useCallback(async (groupId: string) => {
    if (!user) return;
    await supabase.from('group_members').delete()
      .eq('group_id', groupId).eq('user_id', user.id);
    setGroups(prev => prev.filter(g => g.id !== groupId));
  }, [user]);

  // ── Load members ─────────────────────────────────────────────────────────

  const loadMembers = useCallback(async (groupId: string) => {
    const { data } = await supabase
      .from('group_members')
      .select('group_id, user_id, role, joined_at, profiles!user_id(username)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true });
    if (!data) return;
    const mapped: GroupMember[] = data.map((row: any) => {
      const p = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles;
      return { groupId: row.group_id, userId: row.user_id, username: p?.username ?? 'Unknown', role: row.role, joinedAt: row.joined_at };
    });
    setMembersByGroup(prev => ({ ...prev, [groupId]: mapped }));
  }, []);

  // ── Load messages (top-level) + replies, split them ──────────────────────

  const loadMessages = useCallback(async (groupId: string) => {
    const { data } = await supabase
      .from('group_messages')
      .select(MSG_SELECT)
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(300);

    if (!data) return;
    const all = (data as MessageRow[]).map(mapMessage);

    const topLevel = all.filter(m => !m.parentId);
    const replies  = all.filter(m => !!m.parentId);

    setMessagesByGroup(prev => ({ ...prev, [groupId]: topLevel }));

    const repliesMap: Record<string, GroupMessage[]> = {};
    for (const r of replies) {
      if (!r.parentId) continue;
      repliesMap[r.parentId] = [...(repliesMap[r.parentId] ?? []), r];
    }
    setRepliesByMessage(prev => ({ ...prev, ...repliesMap }));
  }, []);

  // ── Real-time subscription ────────────────────────────────────────────────

  const subscribeToGroup = useCallback((groupId: string) => {
    const channel = supabase
      .channel(`group-chat:${groupId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'group_messages',
        filter: `group_id=eq.${groupId}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('group_messages')
          .select(MSG_SELECT)
          .eq('id', payload.new.id)
          .single();
        if (!data) return;
        const msg = mapMessage(data as MessageRow);
        // _pushMessage / _pushReply deduplicate so this is safe to call
        // even when the sender already added the message optimistically.
        if (msg.parentId) {
          setRepliesByMessage(prev => {
            const list = prev[msg.parentId!] ?? [];
            if (list.some(m => m.id === msg.id)) return prev;
            return { ...prev, [msg.parentId!]: [...list, msg] };
          });
        } else {
          setMessagesByGroup(prev => {
            const list = prev[groupId] ?? [];
            if (list.some(m => m.id === msg.id)) return prev;
            return { ...prev, [groupId]: [...list, msg] };
          });
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  // ── Local-state helpers ───────────────────────────────────────────────────

  // Add a top-level message; deduplicate by id so Realtime doesn't double it.
  function _pushMessage(groupId: string, msg: GroupMessage) {
    setMessagesByGroup(prev => {
      const list = prev[groupId] ?? [];
      if (list.some(m => m.id === msg.id)) return prev;
      return { ...prev, [groupId]: [...list, msg] };
    });
  }

  // Add a reply; deduplicate.
  function _pushReply(parentId: string, msg: GroupMessage) {
    setRepliesByMessage(prev => {
      const list = prev[parentId] ?? [];
      if (list.some(m => m.id === msg.id)) return prev;
      return { ...prev, [parentId]: [...list, msg] };
    });
  }

  // ── Send text message ────────────────────────────────────────────────────

  const sendMessage = useCallback(async (groupId: string, content: string) => {
    if (!user) throw new Error('Not signed in.');
    const { data, error } = await supabase
      .from('group_messages')
      .insert({ group_id: groupId, author_id: user.id, message_type: 'text', content: content.trim() })
      .select('id, created_at')
      .single();
    if (error) throw new Error(error.message);
    if (data) {
      _pushMessage(groupId, {
        id: data.id, groupId, authorId: user.id, author: user.name,
        messageType: 'text', content: content.trim(),
        createdAt: data.created_at,
      });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Reply to a story message ─────────────────────────────────────────────

  const sendReply = useCallback(async (groupId: string, parentId: string, content: string) => {
    if (!user) throw new Error('Not signed in.');
    const { data, error } = await supabase
      .from('group_messages')
      .insert({ group_id: groupId, author_id: user.id, parent_id: parentId, message_type: 'text', content: content.trim() })
      .select('id, created_at')
      .single();
    if (error) throw new Error(error.message);
    if (data) {
      _pushReply(parentId, {
        id: data.id, groupId, authorId: user.id, author: user.name,
        parentId, messageType: 'text', content: content.trim(),
        createdAt: data.created_at,
      });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Share a news story ───────────────────────────────────────────────────

  const shareStory = useCallback(async (
    groupId: string,
    story: { headline: string; source: string; url?: string; summary?: string },
  ) => {
    if (!user) throw new Error('Not signed in.');
    const { data, error } = await supabase
      .from('group_messages')
      .insert({
        group_id: groupId, author_id: user.id,
        message_type: 'story', content: null,
        story_headline: story.headline,
        story_source:   story.source,
        story_url:      story.url,
        story_summary:  story.summary,
      })
      .select('id, created_at')
      .single();
    if (error) throw new Error(error.message);
    if (data) {
      _pushMessage(groupId, {
        id: data.id, groupId, authorId: user.id, author: user.name,
        messageType: 'story', content: null,
        storyHeadline: story.headline,
        storySource:   story.source,
        storyUrl:      story.url,
        storySummary:  story.summary,
        createdAt:     data.created_at,
      });
    }
  }, [user]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─────────────────────────────────────────────────────────────────────────

  const value = useMemo(() => ({
    groups, isLoading, messagesByGroup, repliesByMessage, membersByGroup,
    createGroup, addMember, leaveGroup,
    loadMessages, loadMembers, sendMessage, sendReply, shareStory, subscribeToGroup,
  }), [groups, isLoading, messagesByGroup, repliesByMessage, membersByGroup,
       createGroup, addMember, leaveGroup,
       loadMessages, loadMembers, sendMessage, sendReply, shareStory, subscribeToGroup]);

  return <GroupsContext.Provider value={value}>{children}</GroupsContext.Provider>;
}

export function useGroups() {
  const ctx = useContext(GroupsContext);
  if (!ctx) throw new Error('useGroups must be inside GroupsProvider');
  return ctx;
}
