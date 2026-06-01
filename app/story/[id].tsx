import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  Image,
  Linking,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";

import { getDiscoverStoryById } from "@/src/features/discover/data";
import { startupOfDay } from "@/src/features/home/startupOfDay";

function HeroImage({ uri }: { uri?: string | null }) {
  const [errored, setErrored] = useState(false);

  if (!uri || errored) return null;

  return (
    <Image
      source={{ uri }}
      style={{
        width: "100%",
        height: 220,
        borderRadius: 16,
        marginBottom: 20,
      }}
      resizeMode="cover"
      onError={() => setErrored(true)}
    />
  );
}

export default function StoryReaderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const startupStory = id === startupOfDay.id ? startupOfDay : null;
  const discoverStory = id ? getDiscoverStoryById(id) : null;

  return (
    <>
      <Stack.Screen
        options={{
          title: "Story",
          headerTitleAlign: 'center',
          headerRight: () => (
            <Pressable onPress={() => router.back()} hitSlop={12} style={{ marginRight: 4 }}>
              <Text style={{ fontSize: 18, color: '#6B6A66', lineHeight: 22 }}>✕</Text>
            </Pressable>
          ),
        }}
      />
      <ScrollView
        className="flex-1 bg-white dark:bg-black"
        contentContainerClassName="px-6 pb-12 pt-16"
      >
        {startupStory ? (
          <>
            {/* ── Startup of the Day ── */}
            <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {startupStory.storyTitle}
            </Text>
            <Text className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {startupStory.name} • Founded {startupStory.foundedYear}
            </Text>

            {/* What the startup does — shown immediately so readers understand before the story */}
            {startupStory.problemSolved ? (
              <View style={{
                marginTop: 16,
                marginBottom: 4,
                backgroundColor: '#F4F2EC',
                borderRadius: 12,
                padding: 14,
                borderLeftWidth: 3,
                borderLeftColor: '#111110',
              }}>
                <Text style={{ fontSize: 10, fontWeight: '700', color: '#888780', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>
                  What they do
                </Text>
                <Text style={{ fontSize: 14, color: '#2A2A28', lineHeight: 22, fontWeight: '500' }}>
                  {startupStory.problemSolved}
                </Text>
              </View>
            ) : null}

            <Text className="mt-4 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {startupStory.storyParagraphs[0]}
            </Text>
            <Text className="mt-4 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {startupStory.storyParagraphs[1]}
            </Text>
            <Text className="mt-4 text-sm leading-6 text-neutral-700 dark:text-neutral-300">
              {startupStory.storyParagraphs[2]}
            </Text>
          </>
        ) : discoverStory ? (
          <>
            {/* ── Discover story — hero image at top ── */}
            <HeroImage uri={discoverStory.imageUrl} />

            <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
              {discoverStory.headline}
            </Text>
            <Text className="mt-2 text-sm text-neutral-500 dark:text-neutral-400">
              {discoverStory.source} • {discoverStory.readTime}
            </Text>
            <Text className="mt-4 text-base leading-7 text-neutral-700 dark:text-neutral-300">
              {discoverStory.summary}
            </Text>
            <View className="mt-4 rounded-xl bg-blue-50 p-4 dark:bg-blue-950">
              <Text className="text-sm font-semibold text-blue-700 dark:text-blue-200">
                Why it matters
              </Text>
              <Text className="mt-1 text-sm leading-6 text-blue-900 dark:text-blue-100">
                {discoverStory.whyItMatters}
              </Text>
            </View>
            {discoverStory.articleUrl ? (
              <Pressable
                className="mt-5 self-start rounded-full bg-neutral-900 px-4 py-2 dark:bg-neutral-100"
                onPress={() => Linking.openURL(discoverStory.articleUrl!)}
              >
                <Text className="text-xs font-semibold text-white dark:text-black">
                  Open original article
                </Text>
              </Pressable>
            ) : null}
          </>
        ) : (
          <>
            <Text className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              Story unavailable
            </Text>
            <Text className="mt-2 text-neutral-600 dark:text-neutral-400">
              We could not find a story for id {id ?? "unknown"}.
            </Text>
          </>
        )}
      </ScrollView>
    </>
  );
}
