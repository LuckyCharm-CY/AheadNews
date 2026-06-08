import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, TouchableOpacity, View } from 'react-native';

import { type InterestId, useInterests } from '@/src/features/interests/InterestsContext';

const TOPICS: { id: InterestId; label: string; desc: string; color: string; text: string }[] = [
  { id: 'ai-tech',          label: 'AI & Tech',      desc: 'Models, tools, developer news',  color: '#EDE9FE', text: '#5B21B6' },
  { id: 'world-news',       label: 'World',          desc: 'Global events & geopolitics',    color: '#E8F1FB', text: '#1A5BA6' },
  { id: 'business-finance', label: 'Finance',        desc: 'Markets, economy & deals',       color: '#FEF3C7', text: '#92400E' },
  { id: 'world-sports',     label: 'Sports',         desc: 'Scores, transfers & matches',    color: '#FEE2E2', text: '#991B1B' },
  { id: 'world-life',       label: 'Life',           desc: 'Culture, health & society',      color: '#F0FDF4', text: '#166534' },
  { id: 'singapore-news',   label: 'Local SG News',  desc: 'Singapore & Southeast Asia',     color: '#FFF7ED', text: '#9A3412' },
];

const C = {
  bg:          '#F6F5F2',
  card:        '#FFFFFF',
  border:      '#E8E7E3',
  textPrimary: '#111110',
  textSec:     '#6B6A66',
  textTert:    '#ADADAA',
  accent:      '#111110',
};

export default function InterestsScreen() {
  const router = useRouter();
  const { interests: saved, completeOnboarding } = useInterests();

  const [selected, setSelected] = useState<Set<InterestId>>(
    new Set(saved.length > 0 ? saved : []),
  );

  function toggle(id: InterestId) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleContinue() {
    const ids = [...selected] as InterestId[];
    await completeOnboarding(ids);
    router.replace('/(tabs)/' as never);
  }

  async function handleSkip() {
    const all = TOPICS.map(t => t.id) as InterestId[];
    await completeOnboarding(all);
    router.replace('/(tabs)/' as never);
  }

  const canContinue = selected.size > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: C.bg }}
      contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 64, paddingBottom: 48 }}
      showsVerticalScrollIndicator={false}
    >
      {/* Brand */}
      <Text style={{
        fontSize: 11, fontWeight: '700', letterSpacing: 3.5,
        color: C.textTert, textTransform: 'uppercase', marginBottom: 44,
      }}>
        AheadNews
      </Text>

      <Text style={{ fontSize: 30, fontWeight: '700', color: C.textPrimary, letterSpacing: -0.8, marginBottom: 8 }}>
        What do you follow?
      </Text>
      <Text style={{ fontSize: 14, color: C.textSec, lineHeight: 22, marginBottom: 36 }}>
        Pick topics to personalise your feed. You can change these any time.
      </Text>

      {/* Topic grid — 2 columns */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 }}>
        {TOPICS.map(t => {
          const on = selected.has(t.id);
          return (
            <TouchableOpacity
              key={t.id}
              onPress={() => toggle(t.id)}
              activeOpacity={0.75}
              style={{
                width: '47.5%',
                backgroundColor: on ? t.color : C.card,
                borderRadius: 14,
                borderWidth: on ? 1.5 : 1,
                borderColor: on ? t.text : C.border,
                padding: 16,
                minHeight: 88,
                justifyContent: 'space-between',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <Text style={{
                  fontSize: 14, fontWeight: '700',
                  color: on ? t.text : C.textPrimary,
                  flex: 1, marginRight: 6,
                }}>
                  {t.label}
                </Text>
                {on && (
                  <View style={{
                    width: 18, height: 18, borderRadius: 9,
                    backgroundColor: t.text,
                    alignItems: 'center', justifyContent: 'center',
                  }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>✓</Text>
                  </View>
                )}
              </View>
              <Text style={{ fontSize: 12, color: on ? t.text : C.textTert, marginTop: 6, lineHeight: 17 }}>
                {t.desc}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {!canContinue && (
        <Text style={{ fontSize: 12, color: C.textTert, textAlign: 'center', marginBottom: 14 }}>
          Select at least one topic to continue
        </Text>
      )}

      <Pressable
        onPress={handleContinue}
        disabled={!canContinue}
        style={{
          backgroundColor: canContinue ? C.accent : '#D4D3CF',
          borderRadius: 14,
          paddingVertical: 16,
          alignItems: 'center',
        }}
      >
        <Text style={{ fontSize: 15, fontWeight: '700', color: '#fff' }}>
          {saved.length > 0 ? 'Save preferences' : 'Get started'}
        </Text>
      </Pressable>

      <Pressable onPress={handleSkip} style={{ alignItems: 'center', marginTop: 16 }}>
        <Text style={{ fontSize: 13, color: C.textTert }}>Skip for now</Text>
      </Pressable>
    </ScrollView>
  );
}
