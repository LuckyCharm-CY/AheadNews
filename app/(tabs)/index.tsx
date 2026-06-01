import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Modal,
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
import { discoverStories, getFeaturedStoryByCategory } from "@/src/features/discover/data";
import { useSavedStories } from "@/src/features/discover/SavedStoriesContext";
import type { DiscoverCategoryId, DiscoverStory } from "@/src/features/discover/types";
import { newStartups, type NewStartup } from "@/src/features/home/newStartups";
import { startupOfDay, startupOfDayUpdatedAt } from "@/src/features/home/startupOfDay";
import { techReleases, type TechRelease } from "@/src/features/home/techReleases";
import { useInterests } from "@/src/features/interests/InterestsContext";

// ─── Web drag-to-scroll ───────────────────────────────────────────────────────

function HScrollView({ children }: { children: React.ReactNode }) {
  const ref = useRef<ScrollView>(null);

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const node = (ref.current?.getScrollableNode?.() ?? (ref.current as any)?._scrollNode) as HTMLElement | null;
    if (!node) return;
    const state = { down: false, startX: 0, scrollLeft: 0 };
    node.style.cursor = "grab";
    node.style.userSelect = "none";
    const onDown = (e: MouseEvent) => { state.down = true; state.startX = e.pageX; state.scrollLeft = node.scrollLeft; node.style.cursor = "grabbing"; };
    const onUp   = () => { state.down = false; node.style.cursor = "grab"; };
    const onMove = (e: MouseEvent) => { if (!state.down) return; e.preventDefault(); node.scrollLeft = state.scrollLeft - (e.pageX - state.startX); };
    node.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    node.addEventListener("mousemove", onMove);
    return () => { node.removeEventListener("mousedown", onDown); window.removeEventListener("mouseup", onUp); node.removeEventListener("mousemove", onMove); };
  }, []);

  return (
    <ScrollView ref={ref} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollContent}>
      {children}
    </ScrollView>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  "AI / ML":  { bg: "#E6F1FB", text: "#185FA5" },
  Mobile:     { bg: "#EAF3DE", text: "#3B6D11" },
  "Dev Tools":{ bg: "#FAEEDA", text: "#854F0B" },
  Security:   { bg: "#EEEDFE", text: "#534AB7" },
  Hardware:   { bg: "#FAECE7", text: "#993C1D" },
  Web:        { bg: "#E1F5EE", text: "#0F6E56" },
};

const LOGO_SOURCES = [
  (d: string) => `https://logo.clearbit.com/${d}`,
  (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=128`,
  (d: string) => `https://icons.duckduckgo.com/ip3/${d}.ico`,
];

function formatReleaseDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-SG", { month: "short", day: "numeric" });
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function todayLabel() {
  return new Date().toLocaleDateString("en-SG", { weekday: "long", month: "short", day: "numeric" });
}

function updatedLabel(iso: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return "Updated just now";
  if (h < 24) return `Updated ${h}h ago`;
  return `Updated ${new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}`;
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

function CompanyLogo({ domain, initials, bgColor, size = 40 }: { domain?: string; initials: string; bgColor: string; size?: number }) {
  const [srcIdx, setSrcIdx] = useState(0);
  const radius = size * 0.25;
  const allFailed = !domain || srcIdx >= LOGO_SOURCES.length;
  const base = { width: size, height: size, borderRadius: radius, overflow: "hidden" as const, backgroundColor: allFailed ? bgColor : "#FFFFFF", borderWidth: 0.5, borderColor: "#E5E3DC", alignItems: "center" as const, justifyContent: "center" as const };
  if (allFailed) {
    return <View style={base}><Text style={{ fontSize: size * 0.35, fontWeight: "700", color: "#FFFFFF" }}>{initials}</Text></View>;
  }
  return (
    <View style={base}>
      <Image source={{ uri: LOGO_SOURCES[srcIdx](domain!) }} style={{ width: size * 0.7, height: size * 0.7 }} resizeMode="contain" onError={() => setSrcIdx(i => i + 1)} />
    </View>
  );
}

function FadeInView({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  const opacity    = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity,    { toValue: 1, duration: 400, delay, useNativeDriver: true }),
      Animated.timing(translateY, { toValue: 0, duration: 400, delay, useNativeDriver: true }),
    ]).start();
  }, []);
  return <Animated.View style={{ opacity, transform: [{ translateY }] }}>{children}</Animated.View>;
}

function ScaleCard({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: object }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable onPress={onPress} onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()} onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

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
  id: string;
  type: "post_reply" | "comment_reply";
  authorName: string;
  contentPreview: string;
  postTitle: string;
  createdAt: string;
  isUnread: boolean;
};

function useForumNotifications() {
  const { user } = useAuth();
  const [lastSeenAt, setLastSeenAt] = useState<string | null>(null);
  const lastSeenAtRef = useRef<string | null>(null);
  const [items, setItems] = useState<NotifItem[]>([]);

  useEffect(() => {
    readLastSeen().then(val => {
      lastSeenAtRef.current = val;
      setLastSeenAt(val);
    });
  }, []);

  const fetchItems = useCallback(async (userId: string, since: string | null) => {
    // User's posts with titles
    const { data: userPosts } = await supabase
      .from("posts")
      .select("id, title")
      .eq("author_id", userId);
    const postMap = new Map((userPosts ?? []).map((p: { id: string; title: string }) => [p.id, p.title]));
    const postIds = [...postMap.keys()];

    // User's comments
    const { data: userComments } = await supabase
      .from("comments")
      .select("id, post_id")
      .eq("author_id", userId);
    const commentParentMap = new Map((userComments ?? []).map((c: { id: string; post_id: string }) => [c.id, c.post_id]));
    const commentIds = [...commentParentMap.keys()];

    const results: NotifItem[] = [];

    // Comments on user's posts by others
    if (postIds.length > 0) {
      const { data: postReplies } = await supabase
        .from("comments")
        .select("id, post_id, content, created_at, profiles!author_id(username)")
        .in("post_id", postIds)
        .neq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      for (const r of (postReplies ?? []) as any[]) {
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        results.push({
          id: `post-${r.id}`,
          type: "post_reply",
          authorName: profile?.username ?? "Someone",
          contentPreview: r.content?.slice(0, 80) ?? "",
          postTitle: postMap.get(r.post_id) ?? "your post",
          createdAt: r.created_at,
          isUnread: since ? r.created_at > since : false,
        });
      }
    }

    // Replies to user's comments by others
    if (commentIds.length > 0) {
      const { data: commentReplies } = await supabase
        .from("comments")
        .select("id, post_id, parent_id, content, created_at, profiles!author_id(username)")
        .in("parent_id", commentIds)
        .neq("author_id", userId)
        .order("created_at", { ascending: false })
        .limit(20);

      for (const r of (commentReplies ?? []) as any[]) {
        const profile = Array.isArray(r.profiles) ? r.profiles[0] : r.profiles;
        // Look up the post title for this reply's post
        const postTitle = postMap.get(r.post_id) ?? "a post";
        results.push({
          id: `comment-${r.id}`,
          type: "comment_reply",
          authorName: profile?.username ?? "Someone",
          contentPreview: r.content?.slice(0, 80) ?? "",
          postTitle,
          createdAt: r.created_at,
          isUnread: since ? r.created_at > since : false,
        });
      }
    }

    // Sort newest first
    results.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    setItems(results);
  }, []);

  // Re-fetch when user or lastSeenAt changes
  useEffect(() => {
    if (!user?.id) return;
    fetchItems(user.id, lastSeenAt);
  }, [user?.id, lastSeenAt, fetchItems]);

  // Keep fetchItems in a ref so the channel effect never needs it as a dep
  const fetchItemsRef = useRef(fetchItems);
  fetchItemsRef.current = fetchItems;

  // Live updates — unique channel name per mount prevents Supabase reuse errors
  useEffect(() => {
    if (!user?.id) return;
    const userId = user.id;
    const channel = supabase
      .channel(`home:notif:${userId}:${Date.now()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "comments" }, () => {
        fetchItemsRef.current(userId, lastSeenAtRef.current);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user?.id]); // only re-subscribe when user changes

  const unreadCount = items.filter(i => i.isUnread).length;

  const markAllRead = useCallback(async () => {
    const now = new Date().toISOString();
    await writeLastSeen(now);
    lastSeenAtRef.current = now;
    setLastSeenAt(now);
    setItems(prev => prev.map(i => ({ ...i, isUnread: false })));
  }, []);

  return { items, unreadCount, markAllRead };
}

// ─── Notifications popup ──────────────────────────────────────────────────────

function NotificationsPopup({ items, onClose }: { items: NotifItem[]; onClose: () => void }) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      {/* Backdrop */}
      <Pressable style={styles.popupBackdrop} onPress={onClose} />

      {/* Panel */}
      <View style={styles.popupPanel}>
        <View style={styles.popupHeader}>
          <Text style={styles.popupTitle}>Notifications</Text>
          <Pressable onPress={onClose} hitSlop={8}>
            <Ionicons name="close" size={18} color="#888780" />
          </Pressable>
        </View>

        {items.length === 0 ? (
          <View style={styles.popupEmpty}>
            <Ionicons name="notifications-off-outline" size={32} color="#C8C5BA" />
            <Text style={styles.popupEmptyTitle}>Nothing to show</Text>
            <Text style={styles.popupEmptyBody}>You'll see replies to your posts and comments here.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 360 }}>
            {items.map((item, i) => (
              <View key={item.id}>
                <View style={[styles.notifRow, item.isUnread && styles.notifRowUnread]}>
                  {item.isUnread && <View style={styles.notifDot} />}
                  <View style={styles.notifText}>
                    <Text style={styles.notifLine} numberOfLines={2}>
                      <Text style={styles.notifAuthor}>{item.authorName}</Text>
                      {item.type === "post_reply" ? " commented on " : " replied to your comment on "}
                      <Text style={styles.notifPostTitle}>"{item.postTitle}"</Text>
                    </Text>
                    <Text style={styles.notifPreview} numberOfLines={2}>{item.contentPreview}</Text>
                    <Text style={styles.notifTime}>{relativeTime(item.createdAt)}</Text>
                  </View>
                </View>
                {i < items.length - 1 && <View style={styles.notifDivider} />}
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

// ─── Notification bell ────────────────────────────────────────────────────────

function NotificationBell() {
  const { items, unreadCount, markAllRead } = useForumNotifications();
  const [open, setOpen] = useState(false);
  const hasUnread = unreadCount > 0;

  const handleOpen = async () => {
    setOpen(true);
    if (hasUnread) await markAllRead();
  };

  return (
    <>
      <Pressable style={styles.bellButton} hitSlop={8} onPress={handleOpen}>
        <Ionicons
          name={hasUnread ? "notifications" : "notifications-outline"}
          size={22}
          color="#1A1A18"
        />
        {hasUnread && (
          <View style={styles.bellBadge}>
            <Text style={styles.bellBadgeText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
          </View>
        )}
      </Pressable>
      {open && <NotificationsPopup items={items} onClose={() => setOpen(false)} />}
    </>
  );
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ label, onSeeAll, seeAllLabel = "See all →" }: { label: string; onSeeAll?: () => void; seeAllLabel?: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAll}>{seeAllLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Startup of the Day hero card ─────────────────────────────────────────────

function HeroCard({ isSaved, onToggleSave }: { isSaved: boolean; onToggleSave: () => void }) {
  const router = useRouter();
  const [imgFailed, setImgFailed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  const handleHeartPress = () => {
    Animated.sequence([
      Animated.spring(scale, { toValue: 1.35, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1,    useNativeDriver: true }),
    ]).start();
    onToggleSave();
  };

  return (
    <View style={styles.heroCard}>
      {startupOfDay.imageUrl && !imgFailed && (
        <Image
          source={{ uri: startupOfDay.imageUrl }}
          style={StyleSheet.absoluteFillObject}
          resizeMode="cover"
          onError={() => setImgFailed(true)}
        />
      )}
      <View style={[StyleSheet.absoluteFillObject, styles.heroOverlay]} />

      <View style={styles.heroContent}>
        <View style={styles.heroTopRow}>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>{updatedLabel(startupOfDayUpdatedAt)}</Text>
          </View>
          {/* Heart save button */}
          <Pressable onPress={handleHeartPress} hitSlop={10}>
            <Animated.View style={{ transform: [{ scale }] }}>
              <Ionicons
                name={isSaved ? "heart" : "heart-outline"}
                size={24}
                color={isSaved ? "#F87171" : "rgba(255,255,255,0.6)"}
              />
            </Animated.View>
          </Pressable>
        </View>

        <Text style={styles.heroName}>{startupOfDay.name}</Text>

        {startupOfDay.problemSolved ? (
          <Text style={styles.heroDescription} numberOfLines={3}>
            {startupOfDay.problemSolved}
          </Text>
        ) : (
          <Text style={styles.heroDescription} numberOfLines={2}>
            {startupOfDay.oneLiner}
          </Text>
        )}

        <View style={styles.heroMetaRow}>
          {startupOfDay.foundedYear && startupOfDay.foundedYear !== "unknown" && (
            <View style={styles.metaTag}>
              <Text style={styles.metaTagText}>Founded {startupOfDay.foundedYear}</Text>
            </View>
          )}
          <View style={styles.metaTag}>
            <Text style={styles.metaTagText}>Startup of the Day</Text>
          </View>
        </View>

        <Pressable style={styles.btnPrimary} onPress={() => router.push("/story/startup-of-day")}>
          <Text style={styles.btnPrimaryText}>Read full story</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ─── Tech Release card ────────────────────────────────────────────────────────

function TechReleaseCard({ item }: { item: TechRelease }) {
  const router = useRouter();
  const chip = CATEGORY_CHIP_COLORS[item.category] ?? { bg: "#F1EFE8", text: "#5F5E5A" };
  return (
    <ScaleCard style={styles.releaseCard} onPress={() => router.push(`/item/${item.id}`)}>
      <View style={[styles.releaseAccentBar, { backgroundColor: chip.bg }]} />
      <View style={{ padding: 14, flex: 1, justifyContent: "space-between" }}>
        <View>
          <View style={styles.releaseCardTopRow}>
            <CompanyLogo domain={item.domain} initials={item.initials} bgColor={item.iconBg} size={38} />
            <Text style={styles.releaseDate}>{formatReleaseDate(item.releasedDate)}</Text>
          </View>
          <Text style={styles.releaseCardName} numberOfLines={1}>{item.name}</Text>
          <Text style={styles.releaseCardDesc} numberOfLines={4}>{item.description}</Text>
        </View>
        <View style={[styles.chip, { backgroundColor: chip.bg }]}>
          <Text style={[styles.chipText, { color: chip.text }]}>{item.category}</Text>
        </View>
      </View>
    </ScaleCard>
  );
}

// ─── Startups to Watch — auto-advancing carousel ─────────────────────────────

const CARD_MARGIN = 10;
const SCREEN_WIDTH = Dimensions.get("window").width;
const CAROUSEL_CARD_WIDTH = SCREEN_WIDTH - 20 * 2 - CARD_MARGIN * 2; // full bleed minus side padding & peek

function StartupsCarousel({ items }: { items: NewStartup[] }) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const stepWidth = CAROUSEL_CARD_WIDTH + CARD_MARGIN * 2;

  // Auto-advance every 3.5s, pause on manual interaction
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const advance = (next: number) => {
    const idx = next % items.length;
    scrollRef.current?.scrollTo({ x: idx * stepWidth, animated: true });
    setActiveIndex(idx);
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setActiveIndex(prev => {
        const next = (prev + 1) % items.length;
        scrollRef.current?.scrollTo({ x: next * stepWidth, animated: true });
        return next;
      });
    }, 3500);
  };

  useEffect(() => {
    startTimer();
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [items.length]);

  return (
    <View>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={stepWidth}
        decelerationRate="fast"
        contentContainerStyle={styles.carouselContent}
        onScrollBeginDrag={() => { if (timerRef.current) clearInterval(timerRef.current); }}
        onMomentumScrollEnd={e => {
          const idx = Math.round(e.nativeEvent.contentOffset.x / stepWidth);
          setActiveIndex(idx);
          startTimer();
        }}
        scrollEventThrottle={16}
      >
        {items.map((item, i) => (
          <Pressable
            key={item.id}
            style={[styles.carouselCard, i === activeIndex && styles.carouselCardActive]}
            onPress={() => router.push(`/item/${item.id}`)}
          >
            <View style={styles.startupCardHeader}>
              <CompanyLogo domain={item.domain} initials={item.initials} bgColor={item.avatarColor} size={44} />
              <View style={{ flex: 1 }}>
                <Text style={styles.startupCardName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.startupCardStage}>{item.stage} · {item.sector}</Text>
              </View>
            </View>
            <Text style={styles.startupCardDesc} numberOfLines={4}>{item.description}</Text>
            <View style={styles.startupRaisedBadge}>
              <Text style={styles.startupRaisedText}>Raised {item.raisedAmount}</Text>
            </View>
          </Pressable>
        ))}
      </ScrollView>

      {/* Dot indicators */}
      <View style={styles.dotRow}>
        {items.map((_, i) => (
          <Pressable key={i} onPress={() => advance(i)}>
            <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Category colors & labels ─────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
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

const CATEGORY_LABEL: Record<string, string> = {
  "ai-tech":            "AI & Tech",
  "world-news":         "World News",
  "business-finance":   "Business",
  "world-sports":       "Sports",
  "world-life":         "Lifestyle",
  "singapore-news":     "Local SG",
  "singapore-tech":     "SG Tech",
  "singapore-business": "SG Business",
  "singapore-sports":   "SG Sports",
  "singapore-life":     "SG Lifestyle",
};

// ─── For You — vertical list card ────────────────────────────────────────────

function ForYouCard({ story }: { story: DiscoverStory }) {
  const router = useRouter();
  const colors = CATEGORY_COLORS[story.category] ?? { bg: "#F1EFE8", text: "#5F5E5A", accent: "#888780" };
  const label  = CATEGORY_LABEL[story.category]  ?? story.category;
  const [imgFailed, setImgFailed] = useState(false);
  const showImage = !!story.imageUrl && !imgFailed;

  return (
    <ScaleCard
      style={styles.forYouCard}
      onPress={() => router.push({ pathname: "/(tabs)/discover", params: { category: story.category } })}
    >
      <View style={styles.forYouInner}>
        {/* Left: text */}
        <View style={styles.forYouText}>
          <View style={[styles.forYouCatBadge, { backgroundColor: colors.bg }]}>
            <Text style={[styles.forYouCatLabel, { color: colors.text }]}>{label}</Text>
          </View>
          <Text style={styles.forYouHeadline} numberOfLines={3}>{story.headline}</Text>
          <Text style={styles.forYouMeta}>
            {story.source}{story.publishedAt ? `  ·  ${relativeTime(story.publishedAt)}` : ""}
          </Text>
        </View>

        {/* Right: thumbnail */}
        {showImage ? (
          <Image
            source={{ uri: story.imageUrl }}
            style={styles.forYouThumb}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <View style={[styles.forYouThumb, styles.forYouThumbFallback, { backgroundColor: colors.bg }]}>
            <Text style={[styles.forYouThumbInitial, { color: colors.text }]}>{label[0]}</Text>
          </View>
        )}
      </View>
    </ScaleCard>
  );
}

// ─── For You grouped list with expand/collapse ───────────────────────────────

const FOR_YOU_DEFAULT = 3;

function ForYouList({ stories }: { stories: DiscoverStory[] }) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? stories : stories.slice(0, FOR_YOU_DEFAULT);
  const hidden = stories.length - FOR_YOU_DEFAULT;

  return (
    <View style={styles.forYouList}>
      {visible.map((s, i) => (
        <View key={s.id}>
          <ForYouCard story={s} />
          {i < visible.length - 1 && <View style={styles.forYouDivider} />}
        </View>
      ))}
      {hidden > 0 && (
        <>
          <View style={styles.forYouDivider} />
          <Pressable style={styles.forYouToggle} onPress={() => setExpanded(e => !e)}>
            <Text style={styles.forYouToggleText}>
              {expanded ? "Show less" : `Show ${hidden} more`}
            </Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

// ─── Empty For You state ──────────────────────────────────────────────────────

function ForYouEmpty({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={styles.forYouEmpty} onPress={onPress}>
      <Text style={styles.forYouEmptyTitle}>Personalise your feed</Text>
      <Text style={styles.forYouEmptyBody}>Pick topics you care about and we'll surface the most relevant stories here.</Text>
      <Text style={styles.forYouEmptyAction}>Choose topics →</Text>
    </Pressable>
  );
}

// ─── Browse by Topic icon cards ───────────────────────────────────────────────

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const TOPIC_CARDS: {
  id: Exclude<DiscoverCategoryId, "all">;
  label: string;
  icon: IoniconName;
  color: string;
}[] = [
  { id: "ai-tech",            label: "AI & Tech",      icon: "hardware-chip-outline", color: "#2563EB" },
  { id: "world-news",         label: "World",          icon: "globe-outline",         color: "#0F766E" },
  { id: "business-finance",   label: "Finance",        icon: "trending-up-outline",   color: "#15803D" },
  { id: "world-sports",       label: "Sports",         icon: "trophy-outline",        color: "#B91C1C" },
  { id: "world-life",         label: "Life",           icon: "leaf-outline",          color: "#7C3AED" },
  { id: "singapore-news",     label: "Local SG News",  icon: "location-outline",      color: "#C2410C" },
  { id: "singapore-tech",     label: "SG Tech",        icon: "code-slash-outline",    color: "#1D4ED8" },
];

function TopicPillBar() {
  const router = useRouter();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.pillBarContent}
    >
      {TOPIC_CARDS.map(card => (
        <Pressable
          key={card.id}
          style={styles.topicCard}
          onPress={() => router.push({ pathname: "/(tabs)/discover", params: { filter: card.id } })}
        >
          <View style={[styles.topicIconBox, { backgroundColor: `${card.color}14` }]}>
            <Ionicons name={card.icon} size={22} color={card.color} />
          </View>
          <Text style={styles.topicCardLabel}>{card.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

const SG_CATS: DiscoverCategoryId[] = [
  "singapore-news", "singapore-tech", "singapore-business", "singapore-sports", "singapore-life",
];

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { savedIds, toggleSave, registerExtra } = useSavedStories();
  const { interests } = useInterests();

  const heroSaved = savedIds.includes(startupOfDay.id);

  const forYouStories = useMemo<DiscoverStory[]>(() => {
    if (interests.length === 0) return [];
    const seen = new Set<string>();
    const result: DiscoverStory[] = [];
    for (const interest of interests) {
      const cats: DiscoverCategoryId[] = interest === "singapore-news" ? SG_CATS : [interest];
      for (const s of discoverStories) {
        if (cats.includes(s.category) && !seen.has(s.id)) {
          seen.add(s.id);
          result.push(s);
        }
        if (result.length >= 8) break;
      }
      if (result.length >= 8) break;
    }
    return result;
  }, [interests]);

  const firstName = user?.name?.split(" ")[0] ?? "";

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <FadeInView delay={0}>
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting()}{firstName ? `, ${firstName}` : ""}</Text>
            <Text style={styles.dateLine}>{todayLabel()}</Text>
          </View>
          <NotificationBell />
        </View>
      </FadeInView>

      {/* ── Startup of the Day ── */}
      <FadeInView delay={60}>
        <SectionHeader label="Startup of the Day" />
        <HeroCard
          isSaved={heroSaved}
          onToggleSave={() => {
            registerExtra({
              id: startupOfDay.id,
              category: "ai-tech",
              headline: startupOfDay.name,
              summary: startupOfDay.problemSolved || startupOfDay.oneLiner,
              whyItMatters: startupOfDay.oneLiner,
              source: "Startup of the Day",
              readTime: "3 min read",
              imageUrl: startupOfDay.imageUrl,
              publishedAt: startupOfDayUpdatedAt,
            });
            toggleSave(startupOfDay.id);
          }}
        />
      </FadeInView>

      {/* ── For You ── */}
      <FadeInView delay={90}>
        <SectionHeader
          label="For You"
          onSeeAll={() => router.push("/(onboarding)/interests")}
          seeAllLabel="Edit topics →"
        />
        {forYouStories.length === 0 ? (
          <ForYouEmpty onPress={() => router.push("/(onboarding)/interests")} />
        ) : (
          <ForYouList stories={forYouStories} />
        )}
      </FadeInView>

      {/* ── New Tech Releases ── */}
      <FadeInView delay={120}>
        <SectionHeader
          label="New Tech Releases"
          onSeeAll={() => router.push({ pathname: "/(tabs)/discover", params: { category: "ai-tech" } })}
        />
        <HScrollView>
          {techReleases.map(item => <TechReleaseCard key={item.id} item={item} />)}
        </HScrollView>
      </FadeInView>

      {/* ── Startups to Watch ── */}
      <FadeInView delay={150}>
        <SectionHeader label="Startups to Watch" />
        <StartupsCarousel items={newStartups} />
      </FadeInView>

      {/* ── Browse by Topic pill bar ── */}
      <FadeInView delay={180}>
        <SectionHeader
          label="Browse by Topic"
          onSeeAll={() => router.push("/(tabs)/discover")}
        />
        <TopicPillBar />
      </FadeInView>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:   { flex: 1, backgroundColor: "#F8F7F4" },
  content:  { paddingBottom: 48, paddingTop: 56 },

  // ── Header ──
  header: {
    paddingHorizontal: 20,
    marginBottom: 4,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  greeting: {
    fontSize: 22,
    fontWeight: "700",
    color: "#1A1A18",
    letterSpacing: -0.4,
  },
  dateLine: {
    fontSize: 12,
    color: "#888780",
    marginTop: 2,
  },

  // ── Notifications popup ──
  popupBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.25)",
  },
  popupPanel: {
    position: "absolute",
    top: 90,
    right: 16,
    left: 16,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 24,
    elevation: 12,
    overflow: "hidden",
  },
  popupHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E3DC",
  },
  popupTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A18",
  },
  popupEmpty: {
    alignItems: "center",
    paddingVertical: 36,
    paddingHorizontal: 24,
    gap: 8,
  },
  popupEmptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#3A3936",
    marginTop: 4,
  },
  popupEmptyBody: {
    fontSize: 13,
    color: "#888780",
    textAlign: "center",
    lineHeight: 19,
  },
  notifRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 18,
    paddingVertical: 13,
    gap: 10,
  },
  notifRowUnread: {
    backgroundColor: "#FAFAF8",
  },
  notifDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#DC2626",
    marginTop: 5,
    flexShrink: 0,
  },
  notifText: { flex: 1, gap: 3 },
  notifLine: { fontSize: 13, color: "#3A3936", lineHeight: 18 },
  notifAuthor: { fontWeight: "700", color: "#1A1A18" },
  notifPostTitle: { fontWeight: "600", color: "#1A1A18" },
  notifPreview: { fontSize: 12, color: "#888780", lineHeight: 17 },
  notifTime: { fontSize: 11, color: "#B0ADA6", fontWeight: "500" },
  notifDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E3DC",
    marginHorizontal: 18,
  },

  // ── Notification bell ──
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#EFEEE9",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: "#DC2626",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5,
    borderColor: "#F8F7F4",
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 12,
  },

  // ── Section header ──
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    marginTop: 28,
    marginBottom: 12,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    color: "#5F5E5A",
  },
  seeAll: {
    fontSize: 12,
    fontWeight: "600",
    color: "#1A1A18",
  },

  // ── Hero card ──
  heroCard: {
    marginHorizontal: 20,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: "#1A1A18",
    minHeight: 220,
  },
  heroOverlay: {
    backgroundColor: "rgba(15,13,10,0.76)",
    borderRadius: 20,
  },
  heroContent: {
    padding: 20,
  },
  liveBadge: {
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 0.5,
    borderColor: "rgba(255,255,255,0.18)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: "flex-start",
  },
  liveBadgeText: {
    fontSize: 11,
    color: "#C8C5BA",
    fontWeight: "500",
  },
  heroName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#F8F7F4",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  heroDescription: {
    fontSize: 14,
    color: "rgba(255,255,255,0.72)",
    lineHeight: 21,
    marginBottom: 16,
  },
  heroMetaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 18,
  },
  metaTag: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  metaTagText: {
    fontSize: 11,
    color: "#C8C5BA",
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  btnPrimary: {
    flex: 1,
    backgroundColor: "#F8F7F4",
    borderRadius: 12,
    paddingVertical: 11,
    alignItems: "center",
  },
  btnPrimaryText: { color: "#1A1A18", fontSize: 13, fontWeight: "700" },

  // ── Horizontal scroll ──
  hScrollContent: { paddingHorizontal: 20, gap: 10 },

  // ── Tech Release card ──
  releaseCard: {
    width: 185,
    height: 240,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "#E5E3DC",
    overflow: "hidden",
  },
  releaseAccentBar: { height: 5, width: "100%" },
  releaseCardTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  releaseDate: { fontSize: 11, color: "#888780", fontWeight: "500" },
  releaseCardName: { fontSize: 13, fontWeight: "700", color: "#1A1A18", marginBottom: 5 },
  releaseCardDesc: { fontSize: 12, color: "#5F5E5A", lineHeight: 18, marginBottom: 10 },
  chip: { alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: "600" },

  // ── Startups carousel ──
  carouselContent: {
    paddingHorizontal: 20,
  },
  carouselCard: {
    width: CAROUSEL_CARD_WIDTH,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 0.5,
    borderColor: "#E5E3DC",
    padding: 18,
    marginHorizontal: CARD_MARGIN,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  carouselCardActive: {
    shadowOpacity: 0.13,
    shadowRadius: 16,
    elevation: 5,
  },
  dotRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 14,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#D4D2CA",
  },
  dotActive: {
    width: 18,
    backgroundColor: "#1A1A18",
    borderRadius: 3,
  },
  startupCardHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  startupCardName:   { fontSize: 14, fontWeight: "700", color: "#1A1A18" },
  startupCardStage:  { fontSize: 11, color: "#888780", marginTop: 2 },
  startupCardDesc:   { fontSize: 13, color: "#5F5E5A", lineHeight: 19, marginBottom: 14 },
  startupRaisedBadge:{ backgroundColor: "#EAF3DE", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  startupRaisedText: { fontSize: 12, fontWeight: "700", color: "#3B6D11" },

  // ── For You vertical list ──
  forYouList: {
    marginHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "#E5E3DC",
    overflow: "hidden",
  },
  forYouCard: {
    backgroundColor: "#FFFFFF",
  },
  forYouInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    gap: 12,
  },
  forYouText: {
    flex: 1,
    gap: 6,
  },
  forYouCatBadge: {
    alignSelf: "flex-start",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  forYouCatLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
  },
  forYouHeadline: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1A1A18",
    lineHeight: 20,
  },
  forYouMeta: {
    fontSize: 11,
    color: "#888780",
    fontWeight: "500",
  },
  forYouThumb: {
    width: 80,
    height: 72,
    borderRadius: 10,
    flexShrink: 0,
  },
  forYouThumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  forYouThumbInitial: {
    fontSize: 22,
    fontWeight: "800",
  },
  forYouDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#E5E3DC",
    marginHorizontal: 14,
  },
  forYouToggle: {
    paddingVertical: 13,
    alignItems: "center",
  },
  forYouToggleText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#888780",
  },

  // ── Empty For You ──
  forYouEmpty: {
    marginHorizontal: 20,
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 0.5,
    borderColor: "#E5E3DC",
    padding: 20,
    gap: 6,
  },
  forYouEmptyTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1A1A18",
  },
  forYouEmptyBody: {
    fontSize: 13,
    color: "#888780",
    lineHeight: 19,
  },
  forYouEmptyAction: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1A1A18",
    marginTop: 4,
  },

  // ── Browse by Topic icon cards ──
  pillBarContent: {
    paddingHorizontal: 20,
    gap: 10,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  topicCard: {
    alignItems: "center",
    gap: 7,
    width: 68,
  },
  topicIconBox: {
    width: 56,
    height: 56,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  topicCardLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#3A3936",
    textAlign: "center",
  },
});
