import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { useSavedStories } from "@/src/features/discover/SavedStoriesContext";
import type { DiscoverStory } from "@/src/features/discover/types";
import { newStartups, type NewStartup } from "@/src/features/home/newStartups";
import { startupOfDay, startupOfDayUpdatedAt } from "@/src/features/home/startupOfDay";
import { techReleases, type TechRelease } from "@/src/features/home/techReleases";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const LOGO_SOURCES = [
  (d: string) => `https://logo.clearbit.com/${d}`,
  (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=128`,
  (d: string) => `https://icons.duckduckgo.com/ip3/${d}.ico`,
];

const CATEGORY_CHIP_COLORS: Record<string, { bg: string; text: string }> = {
  "AI / ML":  { bg: "#E6F1FB", text: "#185FA5" },
  Mobile:     { bg: "#EAF3DE", text: "#3B6D11" },
  "Dev Tools":{ bg: "#FAEEDA", text: "#854F0B" },
  Security:   { bg: "#EEEDFE", text: "#534AB7" },
  Hardware:   { bg: "#FAECE7", text: "#993C1D" },
  Web:        { bg: "#E1F5EE", text: "#0F6E56" },
};

function formatReleaseDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-SG", { month: "short", day: "numeric" });
}

function updatedLabel(iso: string) {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.floor(diff / 3_600_000);
  if (h < 1)  return "Updated just now";
  if (h < 24) return `Updated ${h}h ago`;
  return `Updated ${new Date(iso).toLocaleDateString("en-SG", { day: "numeric", month: "short" })}`;
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

function ScaleCard({ children, onPress, style }: { children: React.ReactNode; onPress?: () => void; style?: object }) {
  const scale = useRef(new Animated.Value(1)).current;
  return (
    <Pressable onPress={onPress} onPressIn={() => Animated.spring(scale, { toValue: 0.97, useNativeDriver: true }).start()} onPressOut={() => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start()}>
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
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

function SectionHeader({ label, onSeeAll }: { label: string; onSeeAll?: () => void }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <Text style={styles.sectionLabel}>{label}</Text>
      {onSeeAll && (
        <Pressable onPress={onSeeAll} hitSlop={8}>
          <Text style={styles.seeAll}>See all →</Text>
        </Pressable>
      )}
    </View>
  );
}

// ─── Startup of the Day hero ──────────────────────────────────────────────────

function HeroCard({ isSaved, onToggleSave }: { isSaved: boolean; onToggleSave: () => void }) {
  const router = useRouter();
  const [imgFailed, setImgFailed] = useState(false);
  const scale = useRef(new Animated.Value(1)).current;

  if (!startupOfDay) return null;

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
        <Image source={{ uri: startupOfDay.imageUrl }} style={StyleSheet.absoluteFillObject} resizeMode="cover" onError={() => setImgFailed(true)} />
      )}
      <View style={[StyleSheet.absoluteFillObject, styles.heroOverlay]} />
      <View style={styles.heroContent}>
        <View style={styles.heroTopRow}>
          <View style={styles.liveBadge}>
            <Text style={styles.liveBadgeText}>{updatedLabel(startupOfDayUpdatedAt)}</Text>
          </View>
          <Pressable onPress={handleHeartPress} hitSlop={10}>
            <Animated.View style={{ transform: [{ scale }] }}>
              <Ionicons name={isSaved ? "heart" : "heart-outline"} size={24} color={isSaved ? "#F87171" : "rgba(255,255,255,0.6)"} />
            </Animated.View>
          </Pressable>
        </View>
        <Text style={styles.heroName}>{startupOfDay.name}</Text>
        <Text style={styles.heroDescription} numberOfLines={3}>
          {startupOfDay.problemSolved || startupOfDay.oneLiner}
        </Text>
        <View style={styles.heroMetaRow}>
          {startupOfDay.foundedYear && (
            <View style={styles.metaTag}><Text style={styles.metaTagText}>Founded {startupOfDay.foundedYear}</Text></View>
          )}
          <View style={styles.metaTag}><Text style={styles.metaTagText}>Startup of the Day</Text></View>
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

// ─── Startups to Watch carousel ───────────────────────────────────────────────

const CARD_MARGIN = 10;
const SCREEN_WIDTH = Dimensions.get("window").width;
const CAROUSEL_CARD_WIDTH = SCREEN_WIDTH - 20 * 2 - CARD_MARGIN * 2;

function StartupsCarousel({ items }: { items: NewStartup[] }) {
  const router = useRouter();
  const scrollRef = useRef<ScrollView>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const stepWidth = CAROUSEL_CARD_WIDTH + CARD_MARGIN * 2;
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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
          <Pressable key={item.id} style={[styles.carouselCard, i === activeIndex && styles.carouselCardActive]} onPress={() => router.push(`/item/${item.id}`)}>
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
      <View style={styles.dotRow}>
        {items.map((_, i) => (
          <Pressable key={i} onPress={() => { scrollRef.current?.scrollTo({ x: i * stepWidth, animated: true }); setActiveIndex(i); }}>
            <View style={[styles.dot, i === activeIndex && styles.dotActive]} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptySection({ label }: { label: string }) {
  return (
    <View style={styles.emptySection}>
      <Text style={styles.emptySectionText}>{label} will appear here once the pipeline runs.</Text>
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function TechScreen() {
  const router = useRouter();
  const { savedIds, toggleSave, registerExtra } = useSavedStories();
  const heroSaved = startupOfDay ? savedIds.includes(startupOfDay.id) : false;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <FadeInView delay={0}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Tech Corner</Text>
          <Text style={styles.headerSub}>Startups, releases & what's shipping</Text>
        </View>
      </FadeInView>

      {/* ── Startup of the Day ── */}
      <FadeInView delay={60}>
        <SectionHeader label="Startup of the Day" />
        {startupOfDay ? (
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
        ) : (
          <EmptySection label="Startup of the Day" />
        )}
      </FadeInView>

      {/* ── New Tech Releases ── */}
      <FadeInView delay={120}>
        <SectionHeader
          label="New Tech Releases"
          onSeeAll={() => router.push({ pathname: "/(tabs)/discover", params: { filter: "ai-tech" } })}
        />
        {techReleases.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hScrollContent}>
            {techReleases.map(item => <TechReleaseCard key={item.id} item={item} />)}
          </ScrollView>
        ) : (
          <EmptySection label="Tech releases" />
        )}
      </FadeInView>

      {/* ── Startups to Watch ── */}
      <FadeInView delay={150}>
        <SectionHeader label="Startups to Watch" />
        {newStartups.length > 0 ? (
          <StartupsCarousel items={newStartups} />
        ) : (
          <EmptySection label="Startups to watch" />
        )}
      </FadeInView>

    </ScrollView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen:  { flex: 1, backgroundColor: "#F8F7F4" },
  content: { paddingBottom: 48, paddingTop: 56 },

  header: { paddingHorizontal: 20, marginBottom: 4 },
  headerTitle: { fontSize: 26, fontWeight: "700", color: "#1A1A18", letterSpacing: -0.6 },
  headerSub:   { fontSize: 12, color: "#888780", marginTop: 3 },

  sectionHeaderRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 20, marginTop: 28, marginBottom: 12,
  },
  sectionLabel: { fontSize: 13, fontWeight: "700", letterSpacing: 0.6, textTransform: "uppercase", color: "#5F5E5A" },
  seeAll:       { fontSize: 12, fontWeight: "600", color: "#1A1A18" },

  hScrollContent: { paddingHorizontal: 20, gap: 10 },

  // Hero
  heroCard:    { marginHorizontal: 20, borderRadius: 20, overflow: "hidden", backgroundColor: "#1A1A18", minHeight: 220 },
  heroOverlay: { backgroundColor: "rgba(15,13,10,0.76)", borderRadius: 20 },
  heroContent: { padding: 20 },
  heroTopRow:  { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 },
  liveBadge:   { backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 0.5, borderColor: "rgba(255,255,255,0.18)", borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" },
  liveBadgeText: { fontSize: 11, color: "#C8C5BA", fontWeight: "500" },
  heroName:    { fontSize: 22, fontWeight: "700", color: "#F8F7F4", letterSpacing: -0.3, marginBottom: 8 },
  heroDescription: { fontSize: 14, color: "rgba(255,255,255,0.72)", lineHeight: 21, marginBottom: 16 },
  heroMetaRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 18 },
  metaTag:     { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  metaTagText: { fontSize: 11, color: "#C8C5BA" },
  btnPrimary:  { backgroundColor: "#F8F7F4", borderRadius: 12, paddingVertical: 11, alignItems: "center" },
  btnPrimaryText: { color: "#1A1A18", fontSize: 13, fontWeight: "700" },

  // Tech Release
  releaseCard:     { width: 185, height: 240, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 0.5, borderColor: "#E5E3DC", overflow: "hidden" },
  releaseAccentBar:{ height: 5, width: "100%" },
  releaseCardTopRow:{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  releaseDate:     { fontSize: 11, color: "#888780", fontWeight: "500" },
  releaseCardName: { fontSize: 13, fontWeight: "700", color: "#1A1A18", marginBottom: 5 },
  releaseCardDesc: { fontSize: 12, color: "#5F5E5A", lineHeight: 18, marginBottom: 10 },
  chip:     { alignSelf: "flex-start", borderRadius: 20, paddingHorizontal: 8, paddingVertical: 3 },
  chipText: { fontSize: 11, fontWeight: "600" },

  // Carousel
  carouselContent:    { paddingHorizontal: 20 },
  carouselCard:       { width: CAROUSEL_CARD_WIDTH, backgroundColor: "#FFFFFF", borderRadius: 20, borderWidth: 0.5, borderColor: "#E5E3DC", padding: 18, marginHorizontal: CARD_MARGIN, shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 },
  carouselCardActive: { shadowOpacity: 0.13, shadowRadius: 16, elevation: 5 },
  dotRow:    { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 14 },
  dot:       { width: 6, height: 6, borderRadius: 3, backgroundColor: "#D4D2CA" },
  dotActive: { width: 18, backgroundColor: "#1A1A18", borderRadius: 3 },

  startupCardHeader:  { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 12 },
  startupCardName:    { fontSize: 14, fontWeight: "700", color: "#1A1A18" },
  startupCardStage:   { fontSize: 11, color: "#888780", marginTop: 2 },
  startupCardDesc:    { fontSize: 13, color: "#5F5E5A", lineHeight: 19, marginBottom: 14 },
  startupRaisedBadge: { backgroundColor: "#EAF3DE", borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4, alignSelf: "flex-start" },
  startupRaisedText:  { fontSize: 12, fontWeight: "700", color: "#3B6D11" },

  // Empty
  emptySection:     { marginHorizontal: 20, backgroundColor: "#FFFFFF", borderRadius: 16, borderWidth: 0.5, borderColor: "#E5E3DC", padding: 20, alignItems: "center" },
  emptySectionText: { fontSize: 13, color: "#ADADAA", textAlign: "center" },
});
