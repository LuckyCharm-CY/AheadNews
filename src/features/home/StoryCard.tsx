import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Alert, Image, Linking, Pressable, Text, View } from 'react-native';

import type { HomeStory } from './types';

type StoryCardProps = {
  story: HomeStory;
  isSaved: boolean;
  onToggleSave: (storyId: string) => void;
};

export function StoryCard({ story, isSaved, onToggleSave }: StoryCardProps) {
  const handleReadMore = async () => {
    if (!story.articleUrl) return;
    const canOpen = await Linking.canOpenURL(story.articleUrl);
    if (!canOpen) {
      Alert.alert('Unable to open link', 'The full article link is not available.');
      return;
    }
    await Linking.openURL(story.articleUrl);
  };

  return (
    <View className="rounded-2xl border border-neutral-200 bg-white p-4 dark:border-neutral-800 dark:bg-neutral-900">
      {story.imageUrl ? (
        <Image
          source={{ uri: story.imageUrl }}
          className="mb-3 h-44 w-full rounded-xl bg-neutral-200 dark:bg-neutral-800"
          resizeMode="cover"
        />
      ) : null}

      <Text className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{story.headline}</Text>

      <View className="mt-3 flex-row items-center justify-between">
        <Text className="text-sm text-neutral-500 dark:text-neutral-400">{story.source}</Text>

        <View className="flex-row items-center gap-2">
          {story.articleUrl ? (
            <Pressable
              className="flex-row items-center gap-2 rounded-full border border-blue-300 bg-blue-50 px-3 py-2 dark:border-blue-700 dark:bg-blue-900/40"
              onPress={handleReadMore}
            >
              <Text className="text-xs font-semibold text-blue-700 dark:text-blue-200">Read more</Text>
              <FontAwesome name="external-link" size={12} color="#1d4ed8" />
            </Pressable>
          ) : null}
          <Pressable
            className={`h-9 w-9 items-center justify-center rounded-full ${
              isSaved ? 'bg-rose-100 dark:bg-rose-900/40' : 'bg-neutral-200 dark:bg-neutral-700'
            }`}
            onPress={() => onToggleSave(story.id)}
            accessibilityLabel={isSaved ? 'Remove from saved' : 'Save story'}
          >
            <FontAwesome name={isSaved ? 'heart' : 'heart-o'} size={16} color={isSaved ? '#e11d48' : '#525252'} />
          </Pressable>
        </View>
      </View>

      <View className="mt-3 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-950">
        <Text className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
          In short
        </Text>
        <Text className="mt-1 text-sm leading-5 text-emerald-900 dark:text-emerald-100" numberOfLines={4}>
          {story.quickSummary ?? story.summary}
        </Text>
      </View>

      <Text className="mt-3 text-sm leading-6 text-neutral-700 dark:text-neutral-300" numberOfLines={4}>
        {story.summary}
      </Text>

      <View className="mt-3 rounded-xl bg-blue-50 p-3 dark:bg-blue-950">
        <Text className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
          Why it matters
        </Text>
        <Text className="mt-1 text-sm leading-5 text-blue-900 dark:text-blue-100" numberOfLines={3}>
          {story.whyItMatters}
        </Text>
      </View>

    </View>
  );
}
