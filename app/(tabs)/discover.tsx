import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import {
  discoverCategories,
  getStoriesForCategory,
} from "@/src/features/discover/data";
import { useSavedStories } from "@/src/features/discover/SavedStoriesContext";
import { summarizeStory, type BiteSummary } from "@/src/features/discover/summarize";
import type { DiscoverCategoryId, DiscoverStory } from "@/src/features/discover/types";
import { useGroups } from "@/src/features/groups/GroupsContext";

// ─── Tokens ───────────────────────────────────────────────────────────────────

const BG   = "#EDE9E1";
const CARD = "#FFFFFF";

// ─── Category metadata ────────────────────────────────────────────────────────

const CAT_META: Record<string, { label: string; color: string; bg: string; dark: string }> = {
  "world-news":          { label: "World",    color: "#1A5BA6", bg: "#E8F1FB", dark: "#0F3D7A" },
  "ai-tech":             { label: "AI",        color: "#5B21B6", bg: "#EDE9FE", dark: "#3B0E91" },
  "business-finance":    { label: "Finance",   color: "#92400E", bg: "#FEF3C7", dark: "#5A2700" },
  "world-sports":        { label: "Sports",    color: "#065F46", bg: "#D1FAE5", dark: "#023D2C" },
  "world-life":          { label: "Life",      color: "#9D174D", bg: "#FCE7F3", dark: "#6B0F35" },
  "singapore-news":      { label: "Singapore", color: "#991B1B", bg: "#FEE2E2", dark: "#6B0000" },
  "singapore-tech":      { label: "SG Tech",   color: "#1E40AF", bg: "#DBEAFE", dark: "#0F2970" },
  "singapore-business":  { label: "SG Biz",    color: "#92400E", bg: "#FEF3C7", dark: "#5A2700" },
  "singapore-sports":    { label: "SG Sports", color: "#065F46", bg: "#D1FAE5", dark: "#023D2C" },
  "singapore-life":      { label: "SG Life",   color: "#9D174D", bg: "#FCE7F3", dark: "#6B0F35" },
};


// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = { id: string; label: string; cats: Exclude<DiscoverCategoryId, "all">[] | null };

const FILTER_TABS: FilterTab[] = [
  { id: "all",       label: "All",       cats: null },
  { id: "ai",        label: "AI & Tech", cats: ["ai-tech"] },
  { id: "world",     label: "World",     cats: ["world-news"] },
  { id: "finance",   label: "Finance",   cats: ["business-finance"] },
  { id: "sports",    label: "Sports",    cats: ["world-sports"] },
  { id: "life",      label: "Life",      cats: ["world-life"] },
  // Singapore = every singapore-* category, nothing else
  { id: "singapore", label: "Local SG News", cats: ["singapore-news", "singapore-tech", "singapore-business", "singapore-sports", "singapore-life"] },
];

const ALL_CAT_IDS: Exclude<DiscoverCategoryId, "all">[] = [
  "world-news", "ai-tech", "business-finance", "world-sports", "world-life",
  "singapore-news", "singapore-tech", "singapore-business", "singapore-sports", "singapore-life",
];

// Maps a full category ID (as used in home/topic pills) to the corresponding filter tab ID
const CAT_TO_FILTER_ID: Record<string, string> = {
  "ai-tech":            "ai",
  "world-news":         "world",
  "business-finance":   "finance",
  "world-sports":       "sports",
  "world-life":         "life",
  "singapore-news":     "singapore",
  "singapore-tech":     "singapore",
  "singapore-business": "singapore",
  "singapore-sports":   "singapore",
  "singapore-life":     "singapore",
};

function resolveFilterId(param: string | undefined): string {
  if (!param) return "all";
  // Already a valid filter tab ID
  if (FILTER_TABS.some(t => t.id === param)) return param;
  // Full category ID → map to filter tab ID
  return CAT_TO_FILTER_ID[param] ?? "all";
}

function getFilteredStories(filterId: string): DiscoverStory[] {
  const tab = FILTER_TABS.find(t => t.id === filterId);
  const ids = tab?.cats ?? ALL_CAT_IDS;
  return ids.flatMap(id => getStoriesForCategory(id));
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

function firstSentence(text: string): string {
  const s = text.split(/(?<=[.!?])\s+/)[0]?.trim() ?? text.slice(0, 100);
  return s.endsWith(".") ? s : s + ".";
}

// ─── Briefing section (shared by swipe card + detail sheet) ──────────────────

function BriefingSection({ label, text, color }: { label: string; text: string; color: string }) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={{ fontSize: 10, fontWeight: "800", color, letterSpacing: 1.1, textTransform: "uppercase", marginBottom: 7 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, color: "#3A3935", lineHeight: 22 }}>{text}</Text>
    </View>
  );
}

// ─── Source logo ──────────────────────────────────────────────────────────────

const SOURCE_DOMAINS: Record<string, string> = {
  "Google News": "news.google.com", "The Verge": "theverge.com",
  VentureBeat: "venturebeat.com", "Hugging Face Blog": "huggingface.co",
  BBC: "bbc.com", NYTimes: "nytimes.com", Reuters: "reuters.com",
  Bloomberg: "bloomberg.com", "Straits Times": "straitstimes.com",
  "Channel NewsAsia": "channelnewsasia.com", TODAY: "todayonline.com",
};

function SourceLogo({ source, size = 13 }: { source: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const domain = SOURCE_DOMAINS[source];
  if (!domain || failed) return null;
  return (
    <Image
      source={{ uri: `https://www.google.com/s2/favicons?domain=${domain}&sz=64` }}
      style={{ width: size, height: size, borderRadius: 2, marginRight: 4, opacity: 0.8 }}
      resizeMode="contain"
      onError={() => setFailed(true)}
    />
  );
}

// ─── Mode switcher ────────────────────────────────────────────────────────────

function ModeSwitcher({
  mode,
  onSwitch,
}: {
  mode: "explore" | "swipe";
  onSwitch: (m: "explore" | "swipe") => void;
}) {
  const anim = useRef(new Animated.Value(mode === "explore" ? 0 : 1)).current;

  const switchTo = (m: "explore" | "swipe") => {
    Animated.spring(anim, { toValue: m === "explore" ? 0 : 1, useNativeDriver: false, speed: 24, bounciness: 0 }).start();
    onSwitch(m);
  };

  const pillLeft = anim.interpolate({ inputRange: [0, 1], outputRange: ["2%", "50%"] });

  return (
    <View style={{ flexDirection: "row", backgroundColor: "#D8D4CB", borderRadius: 14, padding: 3, position: "relative", overflow: "hidden" }}>
      <Animated.View style={{
        position: "absolute", top: 3, bottom: 3, width: "48%",
        left: pillLeft,
        backgroundColor: CARD,
        borderRadius: 11,
        shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 4, elevation: 2,
      }} />
      {(["explore", "swipe"] as const).map(m => (
        <Pressable key={m} onPress={() => switchTo(m)} style={{ flex: 1, paddingVertical: 7, alignItems: "center", zIndex: 1 }}>
          <Text style={{
            fontSize: 13, fontWeight: "700",
            color: mode === m ? "#111110" : "#8A8884",
            letterSpacing: -0.1,
          }}>
            {m === "explore" ? "Explore" : "Swipe"}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

// ─── Category filter pills ────────────────────────────────────────────────────

function CategoryFilter({
  active,
  onSelect,
}: {
  active: string;
  onSelect: (id: string) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingHorizontal: 18, paddingVertical: 10, gap: 8 }}
    >
      {FILTER_TABS.map(tab => {
        const isActive = tab.id === active;
        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelect(tab.id)}
            style={{
              paddingHorizontal: 16,
              paddingVertical: 7,
              borderRadius: 20,
              backgroundColor: isActive ? "#111110" : CARD,
              borderWidth: 1,
              borderColor: isActive ? "#111110" : "#E0DDD6",
            }}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: isActive ? "#fff" : "#6B6A66" }}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Explore grid card ────────────────────────────────────────────────────────

function ExploreCard({
  story,
  onPress,
  featured,
  saved,
  onToggleSave,
}: {
  story: DiscoverStory;
  onPress: () => void;
  featured?: boolean;
  saved: boolean;
  onToggleSave: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  const meta = CAT_META[story.category] ?? { label: "News", color: "#444", bg: "#F5F5F5", dark: "#222" };
  const snippet = story.aiSummary
    ? firstSentence(story.aiSummary.what)
    : story.summary.slice(0, 90) + (story.summary.length > 90 ? "…" : "");

  const imgH = featured ? 140 : 96;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        backgroundColor: CARD,
        borderRadius: 18,
        overflow: "hidden",
        marginBottom: 10,
        shadowColor: "#1A1207",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 10,
        elevation: 3,
        opacity: pressed ? 0.92 : 1,
      })}
    >
      {/* Image / fallback header */}
      <View style={{ height: imgH, backgroundColor: meta.bg, position: "relative" }}>
        {story.imageUrl && !imgFailed && (
          <Image
            source={{ uri: story.imageUrl }}
            style={StyleSheet.absoluteFillObject}
            resizeMode="cover"
            onError={() => setImgFailed(true)}
          />
        )}
        {/* Dark overlay strip */}
        <View style={{
          position: "absolute", bottom: 0, left: 0, right: 0, height: 36,
          backgroundColor: "rgba(0,0,0,0.52)",
          flexDirection: "row", alignItems: "center",
          paddingHorizontal: 10, gap: 6,
        }}>
          <View style={{ backgroundColor: meta.color, borderRadius: 20, paddingHorizontal: 7, paddingVertical: 2 }}>
            <Text style={{ fontSize: 9, fontWeight: "800", color: "#fff", letterSpacing: 0.3 }}>
              {meta.label.toUpperCase()}
            </Text>
          </View>
          <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
            <SourceLogo source={story.source} size={11} />
            <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.7)" }} numberOfLines={1}>
              {story.source}
            </Text>
          </View>
          {story.readTime && (
            <Text style={{ fontSize: 9, color: "rgba(255,255,255,0.5)" }}>{story.readTime}</Text>
          )}
        </View>
      </View>

      {/* Content */}
      <View style={{ padding: 12 }}>
        <Text
          numberOfLines={featured ? 3 : 4}
          style={{
            fontSize: featured ? 15 : 13,
            fontWeight: "700",
            color: "#111110",
            lineHeight: featured ? 21 : 18,
            letterSpacing: -0.3,
            marginBottom: 6,
          }}
        >
          {story.headline}
        </Text>

        <Text
          numberOfLines={2}
          style={{ fontSize: 12, color: "#6B6A66", lineHeight: 17, marginBottom: 8 }}
        >
          {snippet}
        </Text>

        {/* Footer row */}
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          {story.publishedAt && (
            <Text style={{ fontSize: 10, color: "#ADADAA" }}>
              {new Date(story.publishedAt).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}
            </Text>
          )}
          <Pressable onPress={onToggleSave} hitSlop={8} style={{ marginLeft: "auto" }}>
            <Text style={{ fontSize: 15, color: saved ? "#D94F43" : "#DDDBD6" }}>
              {saved ? "♥" : "♡"}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Explore grid (masonry 2-col) ─────────────────────────────────────────────

function ExploreGrid({
  stories,
  savedIds,
  onToggleSave,
}: {
  stories: DiscoverStory[];
  savedIds: string[];
  onToggleSave: (id: string) => void;
}) {
  const [selectedStory, setSelectedStory] = useState<DiscoverStory | null>(null);

  if (stories.length === 0) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 60 }}>
        <Text style={{ fontSize: 14, color: "#ADADAA" }}>No stories found.</Text>
      </View>
    );
  }

  const [featured, ...rest] = stories;
  const leftCol  = rest.filter((_, i) => i % 2 === 0);
  const rightCol = rest.filter((_, i) => i % 2 === 1);

  return (
    <>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 12, paddingBottom: 100 }}>
        {featured && (
          <ExploreCard
            story={featured}
            featured
            saved={savedIds.includes(featured.id)}
            onToggleSave={() => onToggleSave(featured.id)}
            onPress={() => setSelectedStory(featured)}
          />
        )}

        <View style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
          <View style={{ flex: 1 }}>
            {leftCol.map(s => (
              <ExploreCard key={s.id} story={s} saved={savedIds.includes(s.id)} onToggleSave={() => onToggleSave(s.id)} onPress={() => setSelectedStory(s)} />
            ))}
          </View>
          <View style={{ flex: 1 }}>
            {rightCol.map(s => (
              <ExploreCard key={s.id} story={s} saved={savedIds.includes(s.id)} onToggleSave={() => onToggleSave(s.id)} onPress={() => setSelectedStory(s)} />
            ))}
          </View>
        </View>
      </ScrollView>

      <StoryDetailSheet
        story={selectedStory}
        visible={!!selectedStory}
        saved={!!selectedStory && savedIds.includes(selectedStory.id)}
        onClose={() => setSelectedStory(null)}
        onToggleSave={() => selectedStory && onToggleSave(selectedStory.id)}
      />
    </>
  );
}

// ─── Story detail sheet (Explore tap → full AI briefing) ─────────────────────

function StoryDetailSheet({
  story,
  visible,
  saved,
  onClose,
  onToggleSave,
}: {
  story:        DiscoverStory | null;
  visible:      boolean;
  saved:        boolean;
  onClose:      () => void;
  onToggleSave: () => void;
}) {
  const router = useRouter();
  const [aiSummary, setAiSummary] = useState<BiteSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    if (!story || !visible) return;
    setImgFailed(false);
    if (story.aiSummary) { setAiSummary(story.aiSummary); setAiLoading(false); return; }
    setAiSummary(null); setAiLoading(true);
    summarizeStory(story.id, story.headline, story.source, story.summary)
      .then(setAiSummary).catch(() => {}).finally(() => setAiLoading(false));
  }, [story?.id, visible]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!story) return null;

  const meta = CAT_META[story.category] ?? { label: "News", color: "#444", bg: "#F5F5F5", dark: "#222" };
  const tldr = firstSentence(aiSummary?.what ?? story.summary);

  return (
    <>
      <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
        <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)" }} onPress={onClose} />
        <View style={{ backgroundColor: CARD, borderTopLeftRadius: 28, borderTopRightRadius: 28, maxHeight: "91%" }}>
          {/* Handle */}
          <View style={{ width: 36, height: 4, backgroundColor: "#E0DDD6", borderRadius: 2, alignSelf: "center", marginTop: 12 }} />

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 96 }}>
            {/* Hero image */}
            <View style={{ height: 200, backgroundColor: meta.bg, marginTop: 10, position: "relative" }}>
              {story.imageUrl && !imgFailed && (
                <Image source={{ uri: story.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" onError={() => setImgFailed(true)} />
              )}
              <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 52, backgroundColor: "rgba(0,0,0,0.6)", flexDirection: "row", alignItems: "center", paddingHorizontal: 16, gap: 8 }}>
                <View style={{ backgroundColor: meta.color, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 }}>
                  <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.3 }}>{meta.label.toUpperCase()}</Text>
                </View>
                <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                  <SourceLogo source={story.source} size={12} />
                  <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }} numberOfLines={1}>{story.source}</Text>
                </View>
                {story.readTime && <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.5)" }}>{story.readTime}</Text>}
              </View>
            </View>

            <View style={{ padding: 20 }}>
              {/* Headline */}
              <Text style={{ fontSize: 21, fontWeight: "800", color: "#111110", lineHeight: 29, letterSpacing: -0.5, marginBottom: 16 }}>
                {story.headline}
              </Text>

              {/* TL;DR callout */}
              <View style={{ backgroundColor: meta.bg, borderRadius: 12, padding: 14, borderLeftWidth: 3, borderLeftColor: meta.color, marginBottom: 22 }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: meta.color, letterSpacing: 1, marginBottom: 6 }}>TL;DR</Text>
                {aiLoading ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <ActivityIndicator size="small" color={meta.color} />
                    <Text style={{ fontSize: 12, color: meta.color, opacity: 0.7 }}>Generating briefing…</Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 14, color: "#2A2A28", lineHeight: 21, fontWeight: "500" }}>{tldr}</Text>
                )}
              </View>

              {/* Full briefing sections */}
              {aiSummary ? (
                <>
                  <BriefingSection label="What happened"   text={aiSummary.what}    color={meta.color} />
                  <BriefingSection label="Background"      text={aiSummary.context} color={meta.color} />
                  <BriefingSection label="Why it matters"  text={aiSummary.impact}  color={meta.color} />
                </>
              ) : !aiLoading ? (
                <>
                  <BriefingSection label="Summary"         text={story.summary}         color={meta.color} />
                  {story.whyItMatters ? <BriefingSection label="Why it matters" text={story.whyItMatters} color={meta.color} /> : null}
                </>
              ) : null}
            </View>
          </ScrollView>

          {/* Pinned action bar */}
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "rgba(255,255,255,0.97)", borderTopWidth: 1, borderTopColor: "#F0EFEB", gap: 10 }}>
            <Pressable onPress={onToggleSave} style={{ width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center", backgroundColor: saved ? "#FEE2E2" : "#F4F2EC" }}>
              <Text style={{ fontSize: 17, color: saved ? "#D94F43" : "#ADADAA" }}>{saved ? "♥" : "♡"}</Text>
            </Pressable>
            <Pressable onPress={() => setShareOpen(true)} style={{ paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 13, color: "#8A8884", fontWeight: "600" }}>Share</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            {story.articleUrl ? (
              <Pressable
                onPress={() => { onClose(); setTimeout(() => router.push(`/story/${story.id}`), 300); }}
                style={{ backgroundColor: "#111110", borderRadius: 20, paddingHorizontal: 18, paddingVertical: 10 }}
              >
                <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>Full article →</Text>
              </Pressable>
            ) : null}
          </View>
        </View>
      </Modal>

      <ShareGroupModal visible={shareOpen} story={story} onClose={() => setShareOpen(false)} />
    </>
  );
}

// ─── Share to group modal ─────────────────────────────────────────────────────

function ShareGroupModal({ visible, story, onClose }: { visible: boolean; story: DiscoverStory | null; onClose: () => void }) {
  const { groups, shareStory } = useGroups();
  const [sending, setSending] = useState<string | null>(null);
  const [sent,    setSent]    = useState<string | null>(null);

  const handleShare = async (groupId: string) => {
    if (!story || sending) return;
    setSending(groupId);
    try {
      await shareStory(groupId, { headline: story.headline, source: story.source, url: story.articleUrl, summary: story.summary });
      setSent(groupId);
      setTimeout(onClose, 900);
    } finally { setSending(null); }
  };

  const handleClose = () => { setSent(null); onClose(); };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" }} onPress={handleClose}>
        <Pressable style={{ backgroundColor: CARD, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingBottom: 40 }} onPress={() => {}}>
          <View style={{ width: 36, height: 4, backgroundColor: "#E0DDD6", borderRadius: 2, alignSelf: "center", marginTop: 12, marginBottom: 16 }} />
          <Text style={{ fontSize: 15, fontWeight: "700", color: "#111110", paddingHorizontal: 20, marginBottom: 4 }}>Share to group</Text>
          {story && <Text numberOfLines={1} style={{ fontSize: 12, color: "#ADADAA", paddingHorizontal: 20, marginBottom: 16 }}>{story.headline}</Text>}
          {groups.length === 0 ? (
            <View style={{ paddingHorizontal: 20, paddingVertical: 24, alignItems: "center" }}>
              <Text style={{ fontSize: 13, color: "#6B6A66", fontWeight: "600", marginBottom: 4 }}>No groups yet</Text>
              <Text style={{ fontSize: 12, color: "#ADADAA", textAlign: "center" }}>Create one in Forum → Groups tab.</Text>
            </View>
          ) : groups.map(g => (
            <TouchableOpacity key={g.id} onPress={() => handleShare(g.id)} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingVertical: 14, borderTopWidth: 1, borderTopColor: "#E8E7E3" }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#111110", alignItems: "center", justifyContent: "center" }}>
                  <Text style={{ fontSize: 13, fontWeight: "700", color: "#fff" }}>{g.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <Text style={{ fontSize: 14, fontWeight: "600", color: "#111110" }}>{g.name}</Text>
              </View>
              {sent === g.id ? <Text style={{ fontSize: 13, color: "#2D7A4F", fontWeight: "600" }}>Sent ✓</Text>
                : sending === g.id ? <ActivityIndicator size="small" color="#ADADAA" />
                : <Text style={{ fontSize: 13, color: "#ADADAA" }}>Share</Text>}
            </TouchableOpacity>
          ))}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Swipe mode ───────────────────────────────────────────────────────────────

const STACK_PEEK = 20;

function SwipeView({
  categoryId,
  savedIds,
  onToggleSave,
  onBack,
}: {
  categoryId:   DiscoverCategoryId;
  savedIds:     string[];
  onToggleSave: (id: string) => void;
  onBack:       () => void;
}) {
  const router  = useRouter();
  const stories = getStoriesForCategory(categoryId);
  const [index,     setIndex]     = useState(0);
  const [aiSummary, setAiSummary] = useState<BiteSummary | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const position  = useRef(new Animated.ValueXY()).current;
  const THRESHOLD = 90;

  const story = stories[index];
  const meta  = CAT_META[categoryId] ?? { label: "News", color: "#444", bg: "#F5F5F5", dark: "#222" };
  const catLabel = discoverCategories.find(c => c.id === categoryId)?.label ?? "Discover";

  useEffect(() => {
    setImgFailed(false);
    if (!story) return;
    if (story.aiSummary) { setAiSummary(story.aiSummary); setAiLoading(false); return; }
    setAiSummary(null); setAiLoading(true);
    summarizeStory(story.id, story.headline, story.source, story.summary)
      .then(setAiSummary).catch(() => {}).finally(() => setAiLoading(false));
  }, [story?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "ArrowRight") goNext(); if (e.key === "ArrowLeft") goPrev(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index, stories.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const animateTo = (toX: number, fromX: number, next: number) => {
    Animated.timing(position, { toValue: { x: toX, y: 0 }, duration: 210, useNativeDriver: false }).start(() => {
      position.setValue({ x: fromX, y: 0 });
      setIndex(next);
      Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false, speed: 22, bounciness: 4 }).start();
    });
  };

  const goNext = () => { if (index < stories.length - 1) animateTo(-480, 480, index + 1); };
  const goPrev = () => { if (index > 0) animateTo(480, -480, index - 1); };

  const panResponder = useRef(PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > Math.abs(g.dy) && Math.abs(g.dx) > 10,
    onPanResponderMove:   (_, g) => position.setValue({ x: g.dx, y: g.dy * 0.02 }),
    onPanResponderRelease: (_, g) => {
      if (g.dx >  THRESHOLD && index < stories.length - 1) { animateTo(480, -480, index + 1); return; }
      if (g.dx < -THRESHOLD && index > 0)                  { animateTo(-480, 480, index - 1); return; }
      Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    },
  })).current;

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
      if (dx > THRESHOLD && index < stories.length - 1) animateTo(480, -480, index + 1);
      else if (dx < -THRESHOLD && index > 0)            animateTo(-480, 480, index - 1);
      else Animated.spring(position, { toValue: { x: 0, y: 0 }, useNativeDriver: false }).start();
    };
    el.style.cursor = "grab";
    el.addEventListener("mousedown", onDown); window.addEventListener("mousemove", onMove); window.addEventListener("mouseup", onUp);
    return () => { el.removeEventListener("mousedown", onDown); window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [index, stories.length]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!story) {
    return (
      <View style={{ flex: 1, backgroundColor: BG, alignItems: "center", justifyContent: "center" }}>
        <Text style={{ fontSize: 14, color: "#ADADAA", marginBottom: 16 }}>No stories here yet.</Text>
        <Pressable onPress={onBack} style={{ backgroundColor: "#111110", borderRadius: 12, paddingHorizontal: 20, paddingVertical: 10 }}>
          <Text style={{ fontSize: 13, fontWeight: "600", color: "#fff" }}>← Back</Text>
        </Pressable>
      </View>
    );
  }

  const saved    = savedIds.includes(story.id);
  const canPrev  = index > 0;
  const canNext  = index < stories.length - 1;
  const fallback = `${story.summary}${story.whyItMatters ? " " + story.whyItMatters : ""}`;
  const tldr     = firstSentence(aiSummary?.what ?? fallback);
  const cardRotate = position.x.interpolate({ inputRange: [-300, 0, 300], outputRange: ["-3deg", "0deg", "3deg"], extrapolate: "clamp" });

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* Header */}
      <View style={{ paddingTop: 8, paddingHorizontal: 20, paddingBottom: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 10 }}>
          <Pressable onPress={onBack} hitSlop={12} style={{ marginRight: 10 }}>
            <Text style={{ fontSize: 18, color: "#6B6A66" }}>←</Text>
          </Pressable>
          <Text style={{ flex: 1, fontSize: 14, fontWeight: "700", color: "#111110" }}>{catLabel}</Text>
          <Text style={{ fontSize: 11, color: "#ADADAA" }}>{index + 1} / {stories.length}</Text>
        </View>
        <View style={{ flexDirection: "row", gap: 3 }}>
          {stories.slice(0, Math.min(stories.length, 20)).map((_, i) => (
            <View key={i} style={{ flex: 1, height: 2.5, borderRadius: 2, backgroundColor: i <= index ? "#111110" : "#E0DDD6" }} />
          ))}
        </View>
      </View>

      {/* Stack */}
      <View style={{ flex: 1, paddingBottom: STACK_PEEK }}>
        {canNext && stories[index + 2] && <View pointerEvents="none" style={{ position: "absolute", top: 13, left: 30, right: 30, bottom: 0, backgroundColor: "#D8D4CB", borderRadius: 22 }} />}
        {canNext && <View pointerEvents="none" style={{ position: "absolute", top: 6, left: 23, right: 23, bottom: 5, backgroundColor: "#E8E4DB", borderRadius: 22 }} />}

        <Animated.View
          ref={cardRef}
          {...panResponder.panHandlers}
          style={{ position: "absolute", top: 0, left: 18, right: 18, bottom: STACK_PEEK, backgroundColor: CARD, borderRadius: 22, overflow: "hidden", shadowColor: "#1A1207", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.13, shadowRadius: 20, elevation: 10, transform: [{ translateX: position.x }, { rotate: cardRotate }] }}
        >
          {/* Image with overlay */}
          <View style={{ height: 128, backgroundColor: meta.bg }}>
            {story.imageUrl && !imgFailed && (
              <Image source={{ uri: story.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" onError={() => setImgFailed(true)} />
            )}
            <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 52, backgroundColor: "rgba(10,10,10,0.62)", flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 8 }}>
              <View style={{ backgroundColor: meta.color, borderRadius: 20, paddingHorizontal: 9, paddingVertical: 3 }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: "#fff", letterSpacing: 0.3 }}>{meta.label.toUpperCase()}</Text>
              </View>
              <View style={{ flex: 1, flexDirection: "row", alignItems: "center" }}>
                <SourceLogo source={story.source} size={12} />
                <Text style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: "500" }} numberOfLines={1}>{story.source}</Text>
              </View>
              {story.readTime && <Text style={{ fontSize: 10, color: "rgba(255,255,255,0.55)" }}>{story.readTime}</Text>}
            </View>
          </View>

          {/* Body */}
          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 72 }} showsVerticalScrollIndicator={false}>
            <Text style={{ fontSize: 19, fontWeight: "800", color: "#111110", lineHeight: 26, letterSpacing: -0.5, marginBottom: 12 }}>
              {story.headline}
            </Text>

            {/* TL;DR */}
            <View style={{ flexDirection: "row", backgroundColor: meta.bg, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14, borderLeftWidth: 3, borderLeftColor: meta.color }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 10, fontWeight: "800", color: meta.color, letterSpacing: 1, marginBottom: 4 }}>TL;DR</Text>
                {aiLoading ? (
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <ActivityIndicator size="small" color={meta.color} />
                    <Text style={{ fontSize: 11, color: meta.color, opacity: 0.6 }}>Generating briefing…</Text>
                  </View>
                ) : (
                  <Text style={{ fontSize: 13, color: "#2A2A28", lineHeight: 19, fontWeight: "500" }}>{tldr}</Text>
                )}
              </View>
            </View>

            {/* Full briefing sections */}
            {aiSummary ? (
              <>
                <BriefingSection label="What happened"  text={aiSummary.what}    color={meta.color} />
                <BriefingSection label="Background"     text={aiSummary.context} color={meta.color} />
                <BriefingSection label="Why it matters" text={aiSummary.impact}  color={meta.color} />
              </>
            ) : !aiLoading ? (
              <>
                <BriefingSection label="Summary"        text={story.summary}         color={meta.color} />
                {story.whyItMatters ? <BriefingSection label="Why it matters" text={story.whyItMatters} color={meta.color} /> : null}
              </>
            ) : null}

          </ScrollView>

          {/* Action bar */}
          <View style={{ position: "absolute", bottom: 0, left: 0, right: 0, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, backgroundColor: "rgba(255,255,255,0.96)", borderTopWidth: 1, borderTopColor: "#F0EFEB", gap: 10 }}>
            <Pressable onPress={() => onToggleSave(story.id)} hitSlop={8} style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: saved ? "#FEE2E2" : "#F4F2EC" }}>
              <Text style={{ fontSize: 16, color: saved ? "#D94F43" : "#ADADAA" }}>{saved ? "♥" : "♡"}</Text>
            </Pressable>
            <Pressable onPress={() => setShareOpen(true)} hitSlop={8} style={{ paddingHorizontal: 4 }}>
              <Text style={{ fontSize: 12, color: "#8A8884", fontWeight: "600" }}>Share</Text>
            </Pressable>
            <View style={{ flex: 1 }} />
            {story.articleUrl && (
              <Pressable onPress={() => router.push(`/story/${story.id}`)} style={{ backgroundColor: "#111110", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ fontSize: 12, fontWeight: "700", color: "#fff" }}>Full article</Text>
                <Text style={{ fontSize: 12, color: "rgba(255,255,255,0.6)" }}>→</Text>
              </Pressable>
            )}
          </View>
        </Animated.View>
      </View>

      {/* Nav */}
      <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 18, paddingBottom: 20, paddingTop: 2 }}>
        {[{ fn: goPrev, enabled: canPrev, label: "← Prev", dark: false }, { fn: goNext, enabled: canNext, label: "Next →", dark: true }].map(btn => (
          <Pressable
            key={btn.label}
            onPress={btn.fn}
            disabled={!btn.enabled}
            style={({ pressed }) => ({
              flex: 1, height: 44,
              alignItems: "center", justifyContent: "center",
              backgroundColor: btn.enabled ? (btn.dark ? "#111110" : CARD) : "transparent",
              borderWidth: btn.enabled ? (btn.dark ? 0 : 1) : 1,
              borderColor: "#E0DDD6",
              borderRadius: 14,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text style={{ fontSize: 13, fontWeight: "600", color: btn.enabled ? (btn.dark ? "#fff" : "#111110") : "#D8D5CF" }}>
              {btn.label}
            </Text>
          </Pressable>
        ))}
      </View>

      <ShareGroupModal visible={shareOpen} story={story} onClose={() => setShareOpen(false)} />
    </View>
  );
}

// ─── Category picker (used in Swipe mode landing) ─────────────────────────────

function SwipeCategoryPicker({
  activeFilter,
  savedIds,
  onToggleSave,
  onSelectCategory,
}: {
  activeFilter: string;
  savedIds: string[];
  onToggleSave: (id: string) => void;
  onSelectCategory: (id: DiscoverCategoryId) => void;
}) {
  const tab = FILTER_TABS.find(t => t.id === activeFilter);
  const cats = tab?.cats ?? ALL_CAT_IDS;

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 18, paddingBottom: 100, paddingTop: 4 }}>
      <Text style={{ fontSize: 13, color: "#ADADAA", marginBottom: 16 }}>
        Pick a category to start swiping
      </Text>
      {cats.map(catId => {
        const meta    = CAT_META[catId];
        const stories = getStoriesForCategory(catId);
        if (!meta || stories.length === 0) return null;
        const top = stories[0];
        return (
          <Pressable
            key={catId}
            onPress={() => onSelectCategory(catId)}
            style={({ pressed }) => ({
              backgroundColor: CARD,
              borderRadius: 18,
              overflow: "hidden",
              marginBottom: 12,
              shadowColor: "#1A1207",
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.07,
              shadowRadius: 8,
              elevation: 2,
              opacity: pressed ? 0.9 : 1,
              flexDirection: "row",
              alignItems: "center",
            })}
          >
            {/* Color accent bar */}
            <View style={{ width: 5, alignSelf: "stretch", backgroundColor: meta.color }} />
            <View style={{ flex: 1, padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                <View style={{ backgroundColor: meta.bg, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 11, fontWeight: "700", color: meta.color }}>{meta.label}</Text>
                </View>
                <Text style={{ fontSize: 11, color: "#ADADAA" }}>{stories.length} stories</Text>
              </View>
              <Text numberOfLines={2} style={{ fontSize: 14, fontWeight: "700", color: "#111110", lineHeight: 20, letterSpacing: -0.2 }}>
                {top.headline}
              </Text>
            </View>
            <Text style={{ fontSize: 18, color: "#ADADAA", paddingRight: 14 }}>›</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function DiscoverScreen() {
  const params = useLocalSearchParams<{ category?: string; filter?: string }>();
  const { savedIds, toggleSave } = useSavedStories();

  const [viewMode,      setViewMode]      = useState<"explore" | "swipe">("explore");
  const [activeFilter,  setActiveFilter]  = useState("all");
  const [swipeCategory, setSwipeCategory] = useState<DiscoverCategoryId | null>(null);

  const router = useRouter();

  // React to param changes every time the screen is focused with new params
  useEffect(() => {
    if (params.filter) {
      setViewMode("explore");
      setSwipeCategory(null);
      setActiveFilter(resolveFilterId(params.filter));
    } else if (params.category && discoverCategories.some(c => c.id === params.category)) {
      setViewMode("swipe");
      setSwipeCategory(params.category as DiscoverCategoryId);
    }
  }, [params.filter, params.category]);

  const handleModeSwitch = (m: "explore" | "swipe") => {
    setViewMode(m);
    if (m === "explore") setSwipeCategory(null);
  };

  const filteredStories = useMemo(() => getFilteredStories(activeFilter), [activeFilter]);

  // Header (shared between explore and swipe-landing)
  const showHeader = viewMode === "explore" || (viewMode === "swipe" && !swipeCategory);

  return (
    <View style={{ flex: 1, backgroundColor: BG }}>
      {/* ── Shared header ── */}
      {showHeader && (
        <View style={{ paddingTop: 56, paddingHorizontal: 20, paddingBottom: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 16 }}>
            <View>
              <Text style={{ fontSize: 26, fontWeight: "700", color: "#111110", letterSpacing: -0.7, marginBottom: 2 }}>
                Discover
              </Text>
              <Text style={{ fontSize: 12, color: "#ADADAA" }}>
                {viewMode === "explore"
                  ? `${filteredStories.length} stories`
                  : "Choose a category"}
              </Text>
            </View>
            {/* Mode switcher */}
            <View style={{ width: 170 }}>
              <ModeSwitcher mode={viewMode} onSwitch={handleModeSwitch} />
            </View>
          </View>

          {/* Category filter pills */}
          <View style={{ marginHorizontal: -20 }}>
            <CategoryFilter active={activeFilter} onSelect={setActiveFilter} />
          </View>
        </View>
      )}

      {/* ── Explore mode ── */}
      {viewMode === "explore" && (
        <ExploreGrid
          stories={filteredStories}
          savedIds={savedIds}
          onToggleSave={toggleSave}
        />
      )}

      {/* ── Swipe mode: category picker ── */}
      {viewMode === "swipe" && !swipeCategory && (
        <SwipeCategoryPicker
          activeFilter={activeFilter}
          savedIds={savedIds}
          onToggleSave={toggleSave}
          onSelectCategory={id => setSwipeCategory(id)}
        />
      )}

      {/* ── Swipe mode: swipe view ── */}
      {viewMode === "swipe" && swipeCategory && (
        <View style={{ flex: 1 }}>
          {/* Thin mode bar at top of swipe view */}
          <View style={{ paddingTop: 52, paddingHorizontal: 20, paddingBottom: 4 }}>
            <View style={{ width: 170, alignSelf: "flex-end" }}>
              <ModeSwitcher mode={viewMode} onSwitch={handleModeSwitch} />
            </View>
          </View>
          <SwipeView
            categoryId={swipeCategory}
            savedIds={savedIds}
            onToggleSave={toggleSave}
            onBack={() => setSwipeCategory(null)}
          />
        </View>
      )}
    </View>
  );
}
