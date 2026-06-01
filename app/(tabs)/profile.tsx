import { useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { useAuth } from '@/src/features/auth/AuthContext';
import { useSavedStories } from '@/src/features/discover/SavedStoriesContext';
import type { DiscoverStory } from '@/src/features/discover/types';
import { useGroups } from '@/src/features/groups/GroupsContext';

const C = {
  bg:            '#F6F5F2',
  card:          '#FFFFFF',
  border:        '#E8E7E3',
  textPrimary:   '#111110',
  textSecondary: '#6B6A66',
  textTertiary:  '#ADADAA',
  accent:        '#111110',
  danger:        '#C9392C',
  saved:         '#D94F43',
};

function initials(name: string) {
  return name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-SG', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function daysSince(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  return Math.max(1, Math.floor(ms / 86_400_000));
}

// ─── Saved story mini-card ────────────────────────────────────────────────────

function SavedCard({ story, onUnsave }: { story: DiscoverStory; onUnsave: () => void }) {
  const router = useRouter();
  return (
    <Pressable
      onPress={() => story.articleUrl && router.push(`/story/${story.id}`)}
      style={{
        backgroundColor: C.card,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: C.border,
        padding: 14,
        marginBottom: 10,
        flexDirection: 'row',
        alignItems: 'flex-start',
      }}
    >
      <View style={{ flex: 1, marginRight: 12 }}>
        <View style={{
          alignSelf: 'flex-start',
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 20,
          paddingHorizontal: 8,
          paddingVertical: 2,
          marginBottom: 6,
        }}>
          <Text style={{ fontSize: 10, color: C.textTertiary, fontWeight: '500' }}>
            {story.source}
          </Text>
        </View>
        <Text
          numberOfLines={2}
          style={{ fontSize: 13, fontWeight: '600', color: C.textPrimary, lineHeight: 19 }}
        >
          {story.headline}
        </Text>
        {story.publishedAt ? (
          <Text style={{ fontSize: 11, color: C.textTertiary, marginTop: 4 }}>
            {new Date(story.publishedAt).toLocaleDateString('en-SG', {
              day: 'numeric', month: 'short', year: 'numeric',
            })}
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={onUnsave}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={{ fontSize: 18, color: C.saved }}>♥</Text>
      </Pressable>
    </Pressable>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: 24 }}>
      <Text style={{
        fontSize: 11,
        fontWeight: '700',
        color: C.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 1,
        marginBottom: 12,
      }}>
        {title}
      </Text>
      {children}
    </View>
  );
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ value, label }: { value: string | number; label: string }) {
  return (
    <View style={{
      flex: 1,
      backgroundColor: C.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: C.border,
      paddingVertical: 16,
      alignItems: 'center',
    }}>
      <Text style={{ fontSize: 26, fontWeight: '700', color: C.textPrimary, letterSpacing: -0.5 }}>
        {value}
      </Text>
      <Text style={{ fontSize: 11, color: C.textTertiary, marginTop: 2 }}>
        {label}
      </Text>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { savedStories, toggleSave } = useSavedStories();
  const { groups } = useGroups();
  const router = useRouter();

  if (!user) return null;

  async function handleSignOut() {
    await signOut();
    router.replace('/auth/login' as never);
  }

  const memberDays = daysSince(user.memberSince);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      {/* ── Header ── */}
      <View style={{
        paddingTop: 64,
        paddingBottom: 28,
        paddingHorizontal: 24,
        backgroundColor: C.card,
        borderBottomWidth: 1,
        borderBottomColor: C.border,
        alignItems: 'center',
      }}>
        {/* Avatar */}
        <View style={{
          width: 72,
          height: 72,
          borderRadius: 36,
          backgroundColor: C.accent,
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 14,
        }}>
          <Text style={{ fontSize: 24, fontWeight: '700', color: '#fff' }}>
            {initials(user.name)}
          </Text>
        </View>

        <Text style={{
          fontSize: 22,
          fontWeight: '700',
          color: C.textPrimary,
          letterSpacing: -0.4,
          marginBottom: 3,
        }}>
          {user.name}
        </Text>
        <Text style={{ fontSize: 13, color: C.textSecondary, marginBottom: 6 }}>
          {user.email}
        </Text>
        <View style={{
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 20,
          paddingHorizontal: 10,
          paddingVertical: 3,
        }}>
          <Text style={{ fontSize: 11, color: C.textTertiary }}>
            Member since {formatDate(user.memberSince)}
          </Text>
        </View>
      </View>

      <View style={{ paddingHorizontal: 20, paddingTop: 28 }}>

        {/* ── Stats ── */}
        <Section title="Stats">
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <StatTile value={savedStories.length} label="Saved" />
            <StatTile value={groups.length} label={groups.length === 1 ? 'Group' : 'Groups'} />
            <StatTile value={memberDays} label={memberDays === 1 ? 'Day' : 'Days'} />
          </View>
        </Section>

        {/* ── Saved Stories ── */}
        <Section title={`Saved Stories (${savedStories.length})`}>
          {savedStories.length === 0 ? (
            <View style={{
              backgroundColor: C.card,
              borderRadius: 14,
              borderWidth: 1,
              borderColor: C.border,
              paddingVertical: 28,
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 22, marginBottom: 8 }}>♡</Text>
              <Text style={{ fontSize: 13, color: C.textSecondary, fontWeight: '500' }}>
                No saved stories yet
              </Text>
              <Text style={{ fontSize: 12, color: C.textTertiary, marginTop: 4, textAlign: 'center', paddingHorizontal: 24 }}>
                Tap the heart on any story in Discover to save it here.
              </Text>
            </View>
          ) : (
            savedStories.map((story) => (
              <SavedCard
                key={story.id}
                story={story}
                onUnsave={() => toggleSave(story.id)}
              />
            ))
          )}
        </Section>

        {/* ── Account ── */}
        <Section title="Account">
          <View style={{
            backgroundColor: C.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: C.border,
            overflow: 'hidden',
          }}>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 14,
              borderBottomWidth: 1,
              borderBottomColor: C.border,
            }}>
              <Text style={{ fontSize: 14, color: C.textPrimary }}>Email</Text>
              <Text style={{ fontSize: 13, color: C.textTertiary }} numberOfLines={1}>
                {user.email}
              </Text>
            </View>
            <View style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 16,
              paddingVertical: 14,
            }}>
              <Text style={{ fontSize: 14, color: C.textPrimary }}>Display name</Text>
              <Text style={{ fontSize: 13, color: C.textTertiary }} numberOfLines={1}>
                {user.name}
              </Text>
            </View>
          </View>
        </Section>

        {/* ── Sign out ── */}
        <Pressable
          onPress={handleSignOut}
          style={({ pressed }) => ({
            backgroundColor: C.card,
            borderRadius: 14,
            borderWidth: 1,
            borderColor: '#F0CECE',
            paddingVertical: 15,
            alignItems: 'center',
            opacity: pressed ? 0.7 : 1,
          })}
        >
          <Text style={{ fontSize: 15, fontWeight: '600', color: C.danger }}>
            Sign out
          </Text>
        </Pressable>

      </View>
    </ScrollView>
  );
}
