import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { newStartups } from "@/src/features/home/newStartups";
import { techReleases } from "@/src/features/home/techReleases";

// ─── Logo tile (self-contained, no shared dep) ────────────────────────────────

const LOGO_SOURCES = [
  (d: string) => `https://logo.clearbit.com/${d}`,
  (d: string) => `https://www.google.com/s2/favicons?domain=${d}&sz=128`,
];

function LogoTile({
  domain,
  initials,
  bg,
  size = 64,
}: {
  domain: string;
  initials: string;
  bg: string;
  size?: number;
}) {
  const [srcIdx, setSrcIdx] = useState(0);
  const allFailed = !domain || srcIdx >= LOGO_SOURCES.length;
  const radius = size * 0.22;

  const base = {
    width: size,
    height: size,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: "#E8E7E3",
    alignItems: "center" as const,
    justifyContent: "center" as const,
    overflow: "hidden" as const,
  };

  if (allFailed) {
    return (
      <View style={[base, { backgroundColor: bg }]}>
        <Text style={{ fontSize: size * 0.32, fontWeight: "700", color: "#FFF" }}>
          {initials}
        </Text>
      </View>
    );
  }

  return (
    <View style={[base, { backgroundColor: "#FFF" }]}>
      <Image
        source={{ uri: LOGO_SOURCES[srcIdx](domain) }}
        style={{ width: size * 0.65, height: size * 0.65 }}
        resizeMode="contain"
        onError={() => setSrcIdx((i) => i + 1)}
      />
    </View>
  );
}

// ─── Pill badge ───────────────────────────────────────────────────────────────

function Pill({ label }: { label: string }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{label}</Text>
    </View>
  );
}

// ─── Screens ─────────────────────────────────────────────────────────────────

function TechReleaseDetail({ id }: { id: string }) {
  const item = techReleases.find((r) => r.id === id);

  if (!item) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Release not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Hero */}
      <View style={styles.hero}>
        <LogoTile domain={item.domain} initials={item.initials} bg={item.iconBg} size={64} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemMeta}>
            Released {new Date(item.releasedDate).toLocaleDateString("en-SG", {
              day: "numeric", month: "short", year: "numeric",
            })}
          </Text>
        </View>
      </View>

      {/* Category badge */}
      <View style={{ flexDirection: "row", marginBottom: 24 }}>
        <Pill label={item.category} />
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Description */}
      <Text style={styles.sectionLabel}>About</Text>
      <Text style={styles.body}>{item.description}</Text>

      {/* CTA */}
      {item.url ? (
        <Pressable
          style={styles.ctaBtn}
          onPress={() => Linking.openURL(item.url!)}
        >
          <Text style={styles.ctaBtnText}>Read full article →</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

function StartupDetail({ id }: { id: string }) {
  const item = newStartups.find((s) => s.id === id);

  if (!item) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Startup not found.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {/* Hero */}
      <View style={styles.hero}>
        <LogoTile domain={item.domain} initials={item.initials} bg={item.avatarColor} size={64} />
        <View style={{ flex: 1, marginLeft: 14 }}>
          <Text style={styles.itemName}>{item.name}</Text>
          <Text style={styles.itemMeta}>Founded {item.foundedYear}</Text>
        </View>
      </View>

      {/* Badges */}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 24 }}>
        <Pill label={item.stage} />
        <Pill label={item.sector} />
      </View>

      {/* Raised highlight */}
      <View style={styles.raisedBox}>
        <Text style={styles.raisedLabel}>Total raised</Text>
        <Text style={styles.raisedAmount}>{item.raisedAmount}</Text>
      </View>

      {/* Divider */}
      <View style={styles.divider} />

      {/* Description */}
      <Text style={styles.sectionLabel}>What they do</Text>
      <Text style={styles.body}>{item.description}</Text>

      {/* CTA */}
      {item.url ? (
        <Pressable
          style={styles.ctaBtn}
          onPress={() => Linking.openURL(item.url!)}
        >
          <Text style={styles.ctaBtnText}>Read full article →</Text>
        </Pressable>
      ) : null}
    </ScrollView>
  );
}

// ─── Entry point ─────────────────────────────────────────────────────────────

export default function ItemScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();

  const isTech    = id?.startsWith("tech-");
  const isStartup = id?.startsWith("startup-");

  return (
    <>
      <Stack.Screen
        options={{
          title: isTech ? "Tech Release" : "Startup",
          headerTitleAlign: 'center',
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 4 }}>
              <Text style={{ fontSize: 18, color: '#6B6A66', lineHeight: 22 }}>✕</Text>
            </Pressable>
          ),
        }}
      />
      {isTech    && <TechReleaseDetail id={id} />}
      {isStartup && <StartupDetail id={id} />}
      {!isTech && !isStartup && (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Item not found.</Text>
        </View>
      )}
    </>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F6F5F2" },
  content: { padding: 24, paddingTop: 32, paddingBottom: 48 },

  hero: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  itemName: {
    fontSize: 20,
    fontWeight: "700",
    color: "#111110",
    letterSpacing: -0.3,
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: 13,
    color: "#ADADAA",
  },

  pill: {
    borderWidth: 1,
    borderColor: "#E8E7E3",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  pillText: {
    fontSize: 12,
    color: "#6B6A66",
    fontWeight: "500",
  },

  raisedBox: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E8E7E3",
    padding: 16,
    marginBottom: 24,
  },
  raisedLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ADADAA",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  raisedAmount: {
    fontSize: 28,
    fontWeight: "700",
    color: "#111110",
    letterSpacing: -0.5,
  },

  divider: { height: 1, backgroundColor: "#E8E7E3", marginBottom: 24 },

  sectionLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#ADADAA",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  body: {
    fontSize: 15,
    color: "#3A3A38",
    lineHeight: 24,
    marginBottom: 32,
  },

  ctaBtn: {
    backgroundColor: "#111110",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
  },
  ctaBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#FFFFFF",
  },

  empty: { flex: 1, alignItems: "center", justifyContent: "center" },
  emptyText: { fontSize: 14, color: "#ADADAA" },
});
