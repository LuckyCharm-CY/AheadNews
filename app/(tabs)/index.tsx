import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  FlatList,
  Image,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import * as SecureStore from "expo-secure-store";
import { useAuth } from "@/src/features/auth/AuthContext";
import { supabase } from "@/src/lib/supabase";
import { discoverStories } from "@/src/features/discover/data";
import { useSavedStories } from "@/src/features/discover/SavedStoriesContext";
import { summarizeStory, type BiteSummary } from "@/src/features/discover/summarize";
import type { DiscoverCategoryId, DiscoverStory } from "@/src/features/discover/types";
import { useInterests } from "@/src/features/interests/InterestsContext";
import type { InterestId } from "@/src/features/interests/InterestsContext";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-SG", { weekday: "long", month: "short", day: "numeric" });
}

function relativeTime(iso?: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60)  return `${Math.max(1, mins)}m ago`;
  const h = Math.floor(mins / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

function firstSentence(text: string) {
  const s = text.split(/(?<=[.!?])\s+/)[0]?.trim() ?? text.slice(0, 120);
  return s.endsWith(".") ? s : s + ".";
}

// ─── Category metadata ────────────────────────────────────────────────────────

const CAT_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  "ai-tech":            { bg: "#EDE9FE", text: "#5B21B6", accent: "#7C3AED" },
  "world-news":         { bg: "#E8F1FB", text: "#1A5BA6", accent: "#2563EB" },
  "business-finance":   { bg: "#FEF3C7", text: "#92400E", accent: "#D97706" },
  "world-sports":       { bg: "#FEE2E2", text: "#991B1B", accent: "#DC2626" },
  "world-life":         { bg: "#F0FDF4", text: "#166534", accent: "#16A34A" },
  "singapore-news":     { bg: "#FFF7ED", text: "#9A3412", accent: "#EA580C" },
  "singapore-tech":     { bg: "#EDE9FE", text: "#5B21B6", accent: "#7C3AED" },
  "singapore-business": { bg: "#FEF3C7", text: "#92400E", accent: "#D97706" },
  "singapore-sports":   { bg: "#FEE2E2", text: "#991B1B", accent: "#DC2626" },
  "singapore-life":     { bg: "#F0FDF4", text: "#166534", accent: "#16A34A" },
};

const INTEREST_LABEL: Record<InterestId, string> = {
  "ai-tech":          "AI & Tech",
  "world-news":       "World",
  "business-finance": "Finance",
  "world-sports":     "Sports",
  "world-life":       "Life",
  "singapore-news":   "Local SG",
};

const SG_CATS: DiscoverCategoryId[] = [
  "singapore-news", "singapore-tech", "singapore-business", "singapore-sports", "singapore-life",
];

// ─── Forum notification hook ──────────────────────────────────────────────────

const FORUM_LAST_SEEN_KEY = "forum_last_seen";

async function readLastSeen(): Promise<string | null> {
  try {
    if (Platform.OS === "web") return typeof localStorage !== "undefined" ? localStorage.getItem(FORUM_LAST_SEEN_KEY) : null;
    return await SecureStore.getItemAsync(FORUM_LAST_SEEN_KEY);
  } catch { return null; }
}
async function writeLastSeen(iso: string): Promise<void> {
  try {
    if (Platform.OS === "web") { if (typeof localStorage !== "undefined") localStorage.setItem(FORUM_LAST_SEEN_KEY, iso); return; }
    await SecureStore.setItemAsync(FORUM_LAST_SEEN_KEY, iso);
  } catch {}
}

type NotifItem = {
  id: string; type: "post_reply" | "comment_reply";
  authorName: string; contentPreview: string; postTitle: string; createdAt: string; isUnread: boolean;
};

function useForumNotifications() {
  const { user } = useAuth();
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const lastSeenAtRef = useRef<string | null>(null);
  const [items, setItems] = useState<NotifItem[]>([]);

  useEffect(() => { readLastSeen().then(val => { lastSeenAtRef.current = val; setLastSeenAt(val); }); }, []);

  const fetchItems = useCallback(async (userId: string, since: string | null) => {
    const { data: userPosts } = await supabase.from("posts").select("id, title").eq("author_id", userId);
    const postMap = new Map((userPosts ?? []).map((p: { id: string; title: string }) => [p.id, p.title]));
    const postIds = [...postMap.keys()];
    const { data: userComments } = await supabase.from("comments").select("id, post_id").eq("author_id", userId);
    const commentIds = (userComments ?? []).map((c: { id: string }) => c.id);
    const results: NotifItem[] = [];
    if (postIds.length > 0) {
      const { data: pr } = await supabase.from("comments").select("id, post_id, content, created_at, profiles!author_id(username)").in("post_id", postIds).neq("author_id", userId).order("created_at", { ascending: false }).limit(20);
      for (const r of (pr ?? []) as any[]) {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        results.push({ id: `post-${r.id}`, type: "post_reply", authorName: p?.username ?? "Someone", contentPreview: r.content?.slice(0, 80) ?? "", postTitle: postMap.get(r.post_id) ?? "your post", createdAt: r.created_at, isUnread: since ? r.created_at > since : false });
      }
    }
    if (commentIds.length > 0) {
      const { data: cr } = await supabase.from("comments").select("id, post_id, parent_id, content, created_at, profiles!author_id(username)").in("parent_id", commentIds).neq("author_id", userId).order("created_at", { ascending: false }).limit(20);
      for (const r of (cr ?? []) as any[]) {
        const p = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        results.push({ id: `comment-${r.id}`, type: "comment_reply", authorName: p?.username ?? "Someone", contentPreview: r.content?.slice(0, 80) ?? "", postTitle: postMap.get(r.post_id) ?? "a post", createdAt: r.created_at, isUnread: since ? r.created_at > since : false });
      }
    }
    results.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    setItems(results);
  }, []);

  useEffect(() => { if (!user?.id) return; fetchItems(user.id, lastSeenAt); }, [user?.id, lastSeenAt, fetchItems]);
  const fetchItemsRef = useRef(fetchItems); fetchItemsRef.current = fetchItems;
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    const channel = supabase.channel(`home:notif:${userId}:${Date.now()}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, () => { fetchItemsRef.current(userId, lastSeenAtRef.current); }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]);

  const unreadCount = items.filter(i => i.isUnread).length;
  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    await writeLastSeen(now); lastSeenAtRef.current = now; setLastSeenAt(now);
    setItems(prev => prev.map(i => ({ ...i, isUnread: false })));
  }, []);
  return { items, unreadCount, markAllRead };
}

// ─── Notification bell ────────────────────────────────────────────────────────

function NotificationsPopup({ items, onClose }: { items: NotifItem[]; onClose: () => void }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={S.popupBackdrop} onPress={onClose} />
      <View style={S.popupPanel}>
        <View style={S.popupHeader}>
          <Text style={S.popupTitle}>Notifications</Text>
          <Pressable onPress={onClose} hitSlop={8}><Ionicons name="close" size={18} color="#888780" /></Pressable>
        </View>
        {items.length === 0 ? (
          <View style={S.popupEmpty}>
            <Ionicons name="notifications-off-outline" size={32} color="#C8C5BA" />
            <Text style={S.popupEmptyTitle}>Nothing to show</Text>
            <Text style={S.popupEmptyBody}>Replies to your posts and comments appear here.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
            {items.map((item, i) => (
              <View key={item.id}>
                <View style={[S.notifRow, item.isUnread && S.notifRowUnread]}>
                  {item.isUnread && <View style={S.notifDot} />}
                  <View style={{ flex: 1, gap: 3 }}>
                    <Text style={S.notifLine} numberOfLines={2}>
                      <Text style={{ fontWeight: "700", color: "#1A1A18" }}>{item.authorName}</Text>
                      {item.type === "post_reply" ? " commented on " : " replied to your comment on "}
                      <Text style={{ fontWeight: "600", color: "#1A1A18" }}>"{item.postTitle}"</Text>
                    </Text>
                    <Text style={S.notifPreview} numberOfLines={2}>{item.contentPreview}</Text>
                    <Text style={S.notifTime}>{relativeTime(item.createdAt)}</Text>
                  </View>
                </View>
                {i < items.length - 1 && <View style={S.notifDivider} />}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

function NotificationBell() {
  const { items, unreadCount, markAllRead } = useForumNotifications();
  const [open, setOpen] = useState(false);
  const hasUnread = unreadCount > 0;
  const handleOpen = async () => { setOpen(true); if (hasUnread) await markAllRead(); };
  return (
    <>
      <Pressable style={S.bellButton} hitSlop={8} onPress={handleOpen}>
        <Ionicons name={hasUnread ? "notifications" : "notifications-outline"} size={22} color="#1A1A18" />
        {hasUnread && <View style={S.bellBadge}><Text style={S.bellBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text></View>}
      </Pressable>
      {open && <NotificationsPopup items={items} onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── Topic tabs ───────────────────────────────────────────────────────────────

function TopicTabs({ tabs, active, onSelect }: { tabs: InterestId[]; active: InterestId; onSelect: (id: InterestId) => void }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.tabsContent}>
      {tabs.map(id => {
        const isActive = id === active;
        const c = CAT_COLORS[id] ?? { bg: "#F1EFE8", text: "#5F5E5A", accent: "#888780" };
        return (
          <Pressable key={id} onPress={() => onSelect(id)} style={[S.tab, isActive && { backgroundColor: c.bg, borderColor: c.text + "40" }]}>
            <Text style={[S.tabText, isActive && { color: c.text, fontWeight: "700" }]}>{INTEREST_LABEL[id]}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Compact story card (list view) ──────────────────────────────────────────

function StoryCard({ story, onPress }: { story: DiscoverStory; onPress: () => void }) {
  const [imgFailed, setImgFailed] = useState(false);
  const showImg = !!story.imageUrl && !imgFailed;
  const c = CAT_COLORS[story.category] ?? { bg: "#F1EFE8", text: "#5F5E5A", accent: "#888780" };
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [S.storyCard, pressed && { opacity: 0.85 }]}>
      <View style={S.storyCardInner}>
        <View style={S.storyCardText}>
          <Text style={S.storyHeadline} numberOfLines={3}>{story.headline}</Text>
          <Text style={S.storyMeta}>{story.source}{story.publishedAt ? `  ·  ${relativeTime(story.publishedAt)}` : ""}</Text>
        </View>
        {showImg
          ? <Image source={{ uri: story.imageUrl }} style={S.storyThumb} resizeMode="cover" onError={() => setImgFailed(true)} />
          : <View style={[S.storyThumb, { backgroundColor: c.bg, alignItems: "center", justifyContent: "center" }]}><Text style={{ fontSize: 20, fontWeight: "800", color: c.text }}>{story.source[0]}</Text></View>
        }
      </View>
    </Pressable>
  );
}

// ─── Briefing bottom sheet ────────────────────────────────────────────────────

function StoryBriefingSheet({ story, onClose }: { story: DiscoverStory; onClose: () => void }) {
  const translateY = useRef(new Animated.Value(700)).current;
  const c = CAT_COLORS[story.category] ?? { bg: "#F1EFE8", text: "#5F5E5A", accent: "#888780" };
  const [aiSummary, setAiSummary] = useState<BiteSummary | null>(story.aiSummary ?? null);
  const [aiLoading, setAiLoading] = useState(!story.aiSummary);

  useEffect(() => {
    Animated.spring(translateY, { toValue: 0, damping: 28, stiffness: 280, useNativeDriver: true }).start();
    if (!story.aiSummary) {
      summarizeStory(story.id, story.headline, story.source, story.summary)
        .then(setAiSummary).catch(() => {}).finally(() => setAiLoading(false));
    }
  }, []);

  const handleClose = () => {
    Animated.timing(translateY, { toValue: 700, duration: 220, useNativeDriver: true }).start(onClose);
  };

  const tldr = firstSentence(aiSummary?.what ?? story.summary);

  return (
    <Modal transparent animationType="none" onRequestClose={handleClose}>
      <Pressable style={S.sheetBackdrop} onPress={handleClose} />
      <Animated.View style={[S.sheet, { transform: [{ translateY }] }]}>
        <View style={S.sheetHandle} />
        <View style={S.sheetHeaderRow}>
          <View style={[S.sheetCatBadge, { backgroundColor: c.bg }]}>
            <Text style={[S.sheetCatLabel, { color: c.text }]}>{story.source}</Text>
          </View>
          <Pressable onPress={handleClose} hitSlop={10}><Ionicons name="close" size={20} color="#888780" /></Pressable>
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={S.sheetScroll}>
          <Text style={S.sheetHeadline}>{story.headline}</Text>
          <Text style={S.sheetMeta}>{story.source}{story.publishedAt ? `  ·  ${relativeTime(story.publishedAt)}` : ""}</Text>

          {/* TL;DR */}
          <View style={[S.tldrBox, { backgroundColor: c.bg, borderLeftColor: c.accent }]}>
            <Text style={[S.tldrLabel, { color: c.accent }]}>TL;DR</Text>
            {aiLoading
              ? <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}><ActivityIndicator size="small" color={c.accent} /><Text style={{ fontSize: 12, color: c.text }}>Generating briefing…</Text></View>
              : <Text style={S.tldrText}>{tldr}</Text>
            }
          </View>

          {aiSummary ? (
            <>
              {aiSummary.what     && <BriefingBlock label="WHAT HAPPENED"   text={aiSummary.what}    accent={c.accent} />}
              {aiSummary.context  && <BriefingBlock label="CONTEXT"         text={aiSummary.context} accent={c.accent} />}
              {aiSummary.impact   && <BriefingBlock label="WHY IT MATTERS"  text={aiSummary.impact}  accent={c.accent} />}
            </>
          ) : !aiLoading && story.summary ? (
            <Text style={S.sheetSummary}>{story.summary}</Text>
          ) : null}
        </ScrollView>

        <View style={S.sheetActions}>
          {story.articleUrl && (
            <Pressable style={S.sheetBtnSecondary} onPress={() => { if (story.articleUrl) Linking.openURL(story.articleUrl); }}>
              <Ionicons name="open-outline" size={15} color="#5F5E5A" />
              <Text style={S.sheetBtnSecondaryText}>Read article</Text>
            </Pressable>
          )}
        </View>
      </Animated.View>
    </Modal>
  );
}

function BriefingBlock({ label, text, accent }: { label: string; text: string; accent: string }) {
  return (
    <View style={S.briefingBlock}>
      <Text style={[S.briefingLabel, { color: accent }]}>{label}</Text>
      <Text style={S.briefingText}>{text}</Text>
    </View>
  );
}

// ─── Home swipe mode ──────────────────────────────────────────────────────────

function HomeSwipeView({ stories, tabLabel, onClose }: { stories: DiscoverStory[]; tabLabel: string; onClose: () => void }) {
  const { savedIds, toggleSave } = useSavedStories();
  const [index, setIndex]           = useState(0);
  const [aiSummary, setAiSummary]   = useState<BiteSummary | null>(null);
  const [aiLoading, setAiLoading]   = useState(false);
  const [imgFailed, setImgFailed]   = useState(false);
  const position = useRef(new Animated.ValueXY()).current;
  const THRESHOLD = 90;
  const STACK_PEEK = 20;

  const story = stories[index];
  const c = story ? (CAT_COLORS[story.category] ?? { bg: "#EDE9FE", text: "#5B21B6", accent: "#7C3AED" }) : { bg: "#EDE9FE", text: "#5B21B6", accent: "#7C3AED" };

  useEffect(() => {
    if (!story) return;
    setImgFailed(false);
    if (story.aiSummary) { setAiSummary(story.aiSummary); setAiLoading(false); return; }
    setAiSummary(null); setAiLoading(true);
    summarizeStory(story.id, story.headline, story.source, story.summary)
      .then(setAiSummary).catch(() => {}).finally(() => setAiLoading(false));
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const animateTo = (toX: number, fromX: number, next: number) => {
    Animated.timing(position, { toValue: { x: toX, y: 0 }, duration: 210, useNativeDriver: false }).start(() => {
      position.setValue({ x: fromX, y: 0 });
      setIndex(next);
      Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false, speed: 22, bounciness: 4 }).start();
    });
  };

  const canPrev = index > 0;
  const canNext = index < stories.length - 1;
  const goNext  = () => { if (canNext) animateTo(-480, 480, index + 1); };
  const goPrev  = () => { if (canPrev) animateTo(480, -480, index - 1); };

  // Keyboard navigation (web)
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, stories.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 10,
    onPanResponderMove:   (_, g) => position.setValue({ x: g.dx, y: g.dy * 0.02 }),
    onPanResponderRelease:(_, g) => {
      if (g.dx >  THRESHOLD && canNext) { animateTo( 480, -480, index + 1); return; }
      if (g.dx < -THRESHOLD && canPrev) { animateTo(-480,  480, index - 1); return; }
      Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  })).current;

  // Web drag
  const cardRef = useRef<View>(null);
  const mouseDown = useRef(false); const mouseStart = useRef(0);
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const el = cardRef.current as unknown as HTMLElement;
    if (!el) return;
    const onDown = (e: MouseEvent) => { mouseDown.current = true; mouseStart.current = e.clientX; el.style.cursor = "grabbing"; e.preventDefault(); };
    const onMove = (e: MouseEvent) => { if (!mouseDown.current) return; position.setValue({ x: e.clientX - mouseStart.current, y: 0 }); };
    const onUp   = (e: MouseEvent) => {
      if (!mouseDown.current) return; mouseDown.current = false; el.style.cursor = "grab";
      const dx = e.clientX - mouseStart.current;
      if      (dx >  THRESHOLD && canNext) animateTo( 480, -480, index + 1);
      else if (dx < -THRESHOLD && canPrev) animateTo(-480,  480, index - 1);
      else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    };
    el.style.cursor = "grab";
    el.addEventListener("mousedown", onDown); window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    return () => { el.removeEventListener("mousedown", onDown); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [index, stories.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const cardRotate = position.x.interpolate({ inputRange: [-300, 0, 300], outputRange: ["-3deg", "0deg", "3deg"], extrapolate: "clamp" });
  const saved = story ? savedIds.includes(story.id) : false;
  const tldr  = firstSentence(aiSummary?.what ?? (story?.summary ?? ""));

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <View style={SW.screen}>
        {/* Header */}
        <View style={SW.header}>
          <Pressable onPress={onClose} hitSlop={12} style={SW.backBtn}>
            <Ionicons name="close" size={20} color="#3A3936" />
          </Pressable>
          <Text style={SW.headerTitle}>{tabLabel}</Text>
          <Text style={SW.counter}>{index + 1} / {stories.length}</Text>
        </View>

        {/* Progress bars */}
        <View style={SW.progressRow}>
          {stories.slice(0, Math.min(stories.length, 20)).map((_, i) => (
            <View key={i} style={[SW.progressBar, { backgroundColor: i <= index ? "#1A1A18" : "#E0DDD6" }]} />
          ))}
        </View>

        {/* Card stack */}
        <View style={{ flex: 1, paddingBottom: STACK_PEEK }}>
          {canNext && stories[index + 2] && <View pointerEvents="none" style={SW.stackBack2} />}
          {canNext && <View pointerEvents="none" style={SW.stackBack1} />}

          {story && (
            <Animated.View
              ref={cardRef}
              {...panResponder.panHandlers}
              style={[SW.card, { transform: [{ translateX: position.x }, { rotate: cardRotate }] }]}
            >
              {/* Image */}
              <View style={[SW.cardImg, { backgroundColor: c.bg }]}>
                {story.imageUrl && !imgFailed && (
                  <Image source={{ uri: story.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" onError={() => setImgFailed(true)} />
                )}
                <View style={SW.cardImgOverlay}>
                  <View style={[SW.catBadge, { backgroundColor: c.accent }]}>
                    <Text style={SW.catBadgeText}>{story.source.toUpperCase()}</Text>
                  </View>
                  {story.readTime && <Text style={SW.readTime}>{story.readTime}</Text>}
                </View>
              </View>

              {/* Body */}
              <ScrollView style={{ flex: 1 }} contentContainerStyle={SW.cardBody} showsVerticalScrollIndicator={false}>
                <Text style={SW.headline}>{story.headline}</Text>
                {story.publishedAt && <Text style={SW.metaText}>{relativeTime(story.publishedAt)}</Text>}

                {/* TL;DR */}
                <View style={[SW.tldrBox, { backgroundColor: c.bg, borderLeftColor: c.accent }]}>
                  <Text style={[SW.tldrLabel, { color: c.accent }]}>TL;DR</Text>
                  {aiLoading
                    ? <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}><ActivityIndicator size="small" color={c.accent} /><Text style={{ fontSize: 11, color: c.text }}>Generating briefing…</Text></View>
                    : <Text style={SW.tldrText}>{tldr}</Text>
                  }
                </View>

                {aiSummary ? (
                  <>
                    {aiSummary.what    && <SwipeBriefingSection label="What happened"  text={aiSummary.what}    color={c.accent} />}
                    {aiSummary.context && <SwipeBriefingSection label="Background"     text={aiSummary.context} color={c.accent} />}
                    {aiSummary.impact  && <SwipeBriefingSection label="Why it matters" text={aiSummary.impact}  color={c.accent} />}
                  </>
                ) : !aiLoading ? (
                  <>
                    {story.summary      && <SwipeBriefingSection label="Summary"        text={story.summary}        color={c.accent} />}
                    {story.whyItMatters && <SwipeBriefingSection label="Why it matters" text={story.whyItMatters}   color={c.accent} />}
                  </>
                ) : null}
              </ScrollView>

              {/* Action bar */}
              <View style={SW.actionBar}>
                <Pressable onPress={() => toggleSave(story.id)} style={[SW.actionIconBtn, saved && { backgroundColor: "#FEE2E2" }]}>
                  <Text style={{ fontSize: 18, color: saved ? "#D94F43" : "#ADADAA" }}>{saved ? "♥" : "♡"}</Text>
                </Pressable>
                {story.articleUrl && (
                  <Pressable onPress={() => { if (story.articleUrl) Linking.openURL(story.articleUrl); }} style={[SW.actionPrimaryBtn, { backgroundColor: c.accent }]}>
                    <Text style={SW.actionPrimaryText}>Read full article</Text>
                    <Ionicons name="open-outline" size={14} color="#fff" />
                  </Pressable>
                )}
              </View>
            </Animated.View>
          )}
        </View>

        {/* Prev / Next */}
        <View style={SW.navRow}>
          <Pressable onPress={goPrev} disabled={!canPrev} style={[SW.navBtn, !canPrev && SW.navBtnDisabled]}>
            <Ionicons name="arrow-back" size={18} color={canPrev ? "#1A1A18" : "#D8D5CF"} />
            <Text style={[SW.navBtnText, !canPrev && { color: "#D8D5CF" }]}>Previous</Text>
          </Pressable>
          <Pressable onPress={goNext} disabled={!canNext} style={[SW.navBtn, SW.navBtnPrimary, !canNext && SW.navBtnDisabled]}>
            <Text style={[SW.navBtnText, { color: canNext ? "#fff" : "#D8D5CF" }]}>Next</Text>
            <Ionicons name="arrow-forward" size={18} color={canNext ? "#fff" : "#D8D5CF"} />
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function SwipeBriefingSection({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <View style={{ marginBottom: 16 }}>
      <Text style={{ fontSize: 10, fontWeight: "800", letterSpacing: 1.1, color, textTransform: "uppercase", marginBottom: 5 }}>{label}</Text>
      <Text style={{ fontSize: 13, color: "#3A3936", lineHeight: 20 }}>{text}</Text>
    </View>
  );
}

// ─── Browse by topic pill bar ─────────────────────────────────────────────────

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];
const TOPIC_CARDS: { id: Exclude<DiscoverCategoryId, "all">; label: string; icon: IoniconName; color: string }[] = [
  { id: "ai-tech",            label: "AI & Tech",     icon: "hardware-chip-outline", color: "#2563EB" },
  { id: "world-news",         label: "World",         icon: "globe-outline",         color: "#0F766E" },
  { id: "business-finance",   label: "Finance",       icon: "trending-up-outline",   color: "#15803D" },
  { id: "world-sports",       label: "Sports",        icon: "trophy-outline",        color: "#B91C1C" },
  { id: "world-life",         label: "Life",          icon: "leaf-outline",          color: "#7C3AED" },
  { id: "singapore-news",     label: "Local SG News", icon: "location-outline",      color: "#C2410C" },
  { id: "singapore-tech",     label: "SG Tech",       icon: "code-slash-outline",    color: "#1D4ED8" },
];

function TopicPillBar() {
  const router = useRouter();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={S.pillBarContent}>
      {TOPIC_CARDS.map(card => (
        <Pressable key={card.id} style={S.topicCard} onPress={() => router.push({ pathname: "/(tabs)/discover", params: { filter: card.id } })}>
          <View style={[S.topicIconBox, { backgroundColor: `${card.color}14` }]}>
            <Ionicons name={card.icon} size={22} color={card.color} />
          </View>
          <Text style={S.topicCardLabel}>{card.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyTopics({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={S.emptyCard} onPress={onPress}>
      <Ionicons name="newspaper-outline" size={36} color="#C8C5BA" />
      <Text style={S.emptyTitle}>Personalise your feed</Text>
      <Text style={S.emptyBody}>Pick topics you care about and we'll surface the most relevant stories here.</Text>
      <Text style={S.emptyAction}>Choose topics →</Text>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function HomeScreen() {
  const router  = useRouter();
  const { user } = useAuth();
  const { interests } = useInterests();

  const [activeTab, setActiveTab]         = useState<InterestId | null>(null);
  const [selectedStory, setSelectedStory] = useState<DiscoverStory | null>(null);
  const [swipeMode, setSwipeMode]         = useState(false);

  useEffect(() => {
    if (interests.length > 0 && !activeTab) setActiveTab(interests[0]);
  }, [interests]);

  // All stories for the active tab
  const tabStories = useMemo<DiscoverStory[]>(() => {
    if (!activeTab) return [];
    const cats: DiscoverCategoryId[] = activeTab === "singapore-news" ? SG_CATS : [activeTab];
    return discoverStories.filter(s => cats.includes(s.category));
  }, [activeTab]);

  const firstName = user?.name?.split(" ")[0] ?? "";
  const activeLabel = activeTab ? INTEREST_LABEL[activeTab] : "";

  return (
    <View style={S.screen}>

      {/* ── Header ── */}
      <View style={S.header}>
        <View>
          <Text style={S.greeting}>{greeting()}{firstName ? `, ${firstName}` : ""}</Text>
          <Text style={S.dateLine}>{todayLabel()}</Text>
        </View>
        <NotificationBell />
      </View>

      {interests.length === 0 ? (
        <ScrollView contentContainerStyle={{ padding: 20 }}>
          <EmptyTopics onPress={() => router.push("/(onboarding)/interests")} />
        </ScrollView>
      ) : (
        <>
          {/* ── Topic tabs + swipe button ── */}
          <View style={S.tabsRow}>
            <View style={{ flex: 1 }}>
              <TopicTabs tabs={interests} active={activeTab ?? interests[0]} onSelect={id => { setActiveTab(id); }} />
            </View>
            <Pressable
              style={S.swipeBtn}
              onPress={() => setSwipeMode(true)}
            >
              <Ionicons name="play-circle-outline" size={15} color="#FFFFFF" />
              <Text style={S.swipeBtnText}>Swipe</Text>
            </Pressable>
            <Pressable onPress={() => router.push("/(onboarding)/interests")} hitSlop={8} style={S.editTopicsBtn}>
              <Ionicons name="options-outline" size={18} color="#888780" />
            </Pressable>
          </View>

          {/* ── Story list — ALL stories for this tab ── */}
          {tabStories.length === 0 ? (
            <View style={S.tabEmpty}>
              <Text style={S.tabEmptyText}>No stories yet for this topic.</Text>
            </View>
          ) : (
            <FlatList
              data={tabStories}
              keyExtractor={s => s.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={S.feedContent}
              ItemSeparatorComponent={() => <View style={S.storyDivider} />}
              renderItem={({ item }) => (
                <StoryCard story={item} onPress={() => setSelectedStory(item)} />
              )}
              ListHeaderComponent={<View style={S.listTop} />}
              ListFooterComponent={
                <View style={S.browseSection}>
                  <View style={S.browseSectionHeader}>
                    <Text style={S.browseSectionLabel}>Browse by Topic</Text>
                    <Pressable onPress={() => router.push("/(tabs)/discover")} hitSlop={8}>
                      <Text style={S.browseSectionLink}>See all →</Text>
                    </Pressable>
                  </View>
                  <TopicPillBar />
                  <View style={{ height: 32 }} />
                </View>
              }
            />
          )}
        </>
      )}

      {/* ── Briefing sheet ── */}
      {selectedStory && (
        <StoryBriefingSheet story={selectedStory} onClose={() => setSelectedStory(null)} />
      )}

      {/* ── Swipe mode ── */}
      {swipeMode && activeTab && tabStories.length > 0 && (
        <HomeSwipeView
          stories={tabStories}
          tabLabel={activeLabel}
          onClose={() => setSwipeMode(false)}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const S = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: "#F8F7F4" },
  header:  { paddingHorizontal: 20, paddingTop: 56, paddingBottom: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  greeting:{ fontSize: 22, fontWeight: "700", color: "#1A1A18", letterSpacing: -0.4 },
  dateLine:{ fontSize: 12, color: "#888780", marginTop: 2 },

  bellButton:   { width: 38, height: 38, borderRadius: 19, backgroundColor: "#EFEEE9", alignItems: "center", justifyContent: "center" },
  bellBadge:    { position: "absolute", top: 4, right: 4, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#DC2626", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: "#F8F7F4" },
  bellBadgeText:{ fontSize: 9, fontWeight: "800", color: "#FFFFFF", lineHeight: 12 },

  popupBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.25)" },
  popupPanel:    { position: "absolute", top: 90, right: 16, left: 16, backgroundColor: "#FFFFFF", borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.12, shadowRadius: 24, elevation: 12, overflow: "hidden" },
  popupHeader:   { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 18, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E3DC" },
  popupTitle:    { fontSize: 15, fontWeight: "700", color: "#1A1A18" },
  popupEmpty:    { alignItems: "center", paddingVertical: 36, paddingHorizontal: 24, gap: 8 },
  popupEmptyTitle:{ fontSize: 15, fontWeight: "700", color: "#3A3936", marginTop: 4 },
  popupEmptyBody: { fontSize: 13, color: "#888780", textAlign: "center", lineHeight: 19 },
  notifRow:       { flexDirection: "row", alignItems: "flex-start", paddingHorizontal: 18, paddingVertical: 13, gap: 10 },
  notifRowUnread: { backgroundColor: "#FAFAF8" },
  notifDot:       { width: 7, height: 7, borderRadius: 4, backgroundColor: "#DC2626", marginTop: 5, flexShrink: 0 },
  notifLine:      { fontSize: 13, color: "#3A3936", lineHeight: 18 },
  notifPreview:   { fontSize: 12, color: "#888780", lineHeight: 17 },
  notifTime:      { fontSize: 11, color: "#B0ADA6", fontWeight: "500" },
  notifDivider:   { height: StyleSheet.hairlineWidth, backgroundColor: "#E5E3DC", marginHorizontal: 18 },

  tabsRow:       { flexDirection: "row", alignItems: "center", borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#E5E3DC" },
  tabsContent:   { paddingHorizontal: 12, paddingVertical: 10, gap: 7, alignItems: "center" },
  tab:           { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: "#E5E3DC", backgroundColor: "#FFFFFF" },
  tabText:       { fontSize: 13, fontWeight: "500", color: "#888780" },
  swipeBtn:      { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 12, paddingVertical: 8, marginRight: 6, backgroundColor: "#1A1A18", borderRadius: 20, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.15, shadowRadius: 4, elevation: 3 },
  swipeBtnText:  { fontSize: 12, fontWeight: "700", color: "#FFFFFF", letterSpacing: 0.2 },
  editTopicsBtn: { paddingRight: 12, paddingLeft: 2 },

  feedContent:   { paddingHorizontal: 16 },
  listTop:       { height: 10 },
  storyCard:     { backgroundColor: "#FFFFFF" },
  storyCardInner:{ flexDirection: "row", alignItems: "center", padding: 14, gap: 12, backgroundColor: "#FFFFFF" },
  storyCardText: { flex: 1, gap: 5 },
  storyHeadline: { fontSize: 14, fontWeight: "700", color: "#1A1A18", lineHeight: 20 },
  storyMeta:     { fontSize: 11, color: "#888780", fontWeight: "500" },
  storyThumb:    { width: 76, height: 68, borderRadius: 10, flexShrink: 0 },
  storyDivider:  { height: StyleSheet.hairlineWidth, backgroundColor: "#E5E3DC", marginHorizontal: 14 },

  tabEmpty:      { flex: 1, alignItems: "center", justifyContent: "center", padding: 40 },
  tabEmptyText:  { fontSize: 13, color: "#ADADAA", textAlign: "center" },

  // Briefing sheet
  sheetBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet:         { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: "#FFFFFF", borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: "85%", shadowColor: "#000", shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.1, shadowRadius: 20, elevation: 20 },
  sheetHandle:   { width: 36, height: 4, borderRadius: 2, backgroundColor: "#D4D2CA", alignSelf: "center", marginTop: 12, marginBottom: 4 },
  sheetHeaderRow:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: "#F0EFEB" },
  sheetCatBadge: { borderRadius: 5, paddingHorizontal: 8, paddingVertical: 3 },
  sheetCatLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 0.5, textTransform: "uppercase" },
  sheetScroll:   { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  sheetHeadline: { fontSize: 18, fontWeight: "700", color: "#1A1A18", lineHeight: 26, letterSpacing: -0.3, marginBottom: 5 },
  sheetMeta:     { fontSize: 12, color: "#888780", marginBottom: 16 },
  sheetSummary:  { fontSize: 14, color: "#3A3936", lineHeight: 22 },
  tldrBox:       { borderRadius: 12, padding: 14, borderLeftWidth: 3, marginBottom: 18 },
  tldrLabel:     { fontSize: 10, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 5 },
  tldrText:      { fontSize: 14, color: "#2A2A28", lineHeight: 21, fontWeight: "500" },
  briefingBlock: { marginBottom: 16 },
  briefingLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 5 },
  briefingText:  { fontSize: 14, color: "#3A3936", lineHeight: 22 },
  sheetActions:  { flexDirection: "row", gap: 10, padding: 16, paddingBottom: 32, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#F0EFEB" },
  sheetBtnSecondary:    { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 13, borderRadius: 14, backgroundColor: "#F1EFE8", borderWidth: 0.5, borderColor: "#E5E3DC" },
  sheetBtnSecondaryText:{ fontSize: 14, fontWeight: "600", color: "#5F5E5A" },

  // Empty
  emptyCard:  { marginTop: 32, backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 0.5, borderColor: "#E5E3DC", padding: 28, alignItems: "center", gap: 8 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: "#1A1A18", marginTop: 8 },
  emptyBody:  { fontSize: 13, color: "#888780", textAlign: "center", lineHeight: 20 },
  emptyAction:{ fontSize: 14, fontWeight: "700", color: "#1A1A18", marginTop: 8 },

  // Browse by topic
  browseSection:      { marginTop: 24 },
  browseSectionHeader:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 4, marginBottom: 12 },
  browseSectionLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: "#5F5E5A" },
  browseSectionLink:  { fontSize: 12, fontWeight: "600", color: "#1A1A18" },
  pillBarContent:     { gap: 10, flexDirection: "row", alignItems: "flex-start" },
  topicCard:          { alignItems: "center", gap: 7, width: 68 },
  topicIconBox:       { width: 56, height: 56, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  topicCardLabel:     { fontSize: 11, fontWeight: "600", color: "#3A3936", textAlign: "center" },
});

// ─── Swipe mode styles ────────────────────────────────────────────────────────

const SW = StyleSheet.create({
  screen:     { flex: 1, backgroundColor: "#EDE9E1" },
  header:     { flexDirection: "row", alignItems: "center", paddingHorizontal: 20, paddingTop: 56, paddingBottom: 10 },
  backBtn:    { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(0,0,0,0.07)", alignItems: "center", justifyContent: "center", marginRight: 10 },
  headerTitle:{ flex: 1, fontSize: 15, fontWeight: "700", color: "#1A1A18" },
  counter:    { fontSize: 12, color: "#888780" },
  progressRow:{ flexDirection: "row", gap: 3, paddingHorizontal: 20, marginBottom: 10 },
  progressBar:{ flex: 1, height: 2.5, borderRadius: 2 },
  stackBack2: { position: "absolute", top: 13, left: 30, right: 30, bottom: 0, backgroundColor: "#D8D4CB", borderRadius: 22 },
  stackBack1: { position: "absolute", top: 6,  left: 22, right: 22, bottom: 5, backgroundColor: "#E8E4DB", borderRadius: 22 },
  card:       { position: "absolute", top: 0, left: 18, right: 18, bottom: 20, backgroundColor: "#FFFFFF", borderRadius: 22, overflow: "hidden", shadowColor: "#000", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.12, shadowRadius: 20, elevation: 10 },
  cardImg:    { height: 130 },
  cardImgOverlay: { position: "absolute", bottom: 0, left: 0, right: 0, height: 46, backgroundColor: "rgba(10,10,10,0.6)", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8 },
  catBadge:   { borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 },
  catBadgeText:{ fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.3 },
  readTime:   { marginLeft: "auto" as any, fontSize: 9, color: "rgba(255,255,255,0.5)" },
  cardBody:   { paddingTop: 14, paddingHorizontal: 16, paddingBottom: 80 },
  headline:   { fontSize: 19, fontWeight: "800", color: "#1A1A18", lineHeight: 26, letterSpacing: -0.5, marginBottom: 6 },
  metaText:   { fontSize: 11, color: "#888780", marginBottom: 14 },
  tldrBox:    { borderRadius: 10, padding: 12, borderLeftWidth: 3, marginBottom: 16 },
  tldrLabel:  { fontSize: 10, fontWeight: "800", letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 4 },
  tldrText:   { fontSize: 13, color: "#2A2A28", lineHeight: 19, fontWeight: "500" },
  actionBar:  { position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(255,255,255,0.96)", borderTopWidth: 1, borderTopColor: "#F0EFEB", gap: 10 },
  actionIconBtn:    { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: "#F4F2EC" },
  actionPrimaryBtn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, paddingVertical: 10, borderRadius: 20 },
  actionPrimaryText:{ fontSize: 13, fontWeight: "700", color: "#fff" },
  navRow:     { flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingBottom: 28, paddingTop: 4 },
  navBtn:     { flex: 1, height: 46, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#FFFFFF", borderWidth: 1, borderColor: "#E0DDD6", borderRadius: 14 },
  navBtnPrimary: { backgroundColor: "#1A1A18", borderColor: "#1A1A18" },
  navBtnDisabled:{ backgroundColor: "transparent", borderColor: "#E0DDD6" },
  navBtnText: { fontSize: 13, fontWeight: "600", color: "#1A1A18" },
});
