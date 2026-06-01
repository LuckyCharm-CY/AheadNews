import { Text, View } from 'react-native';

export default function NotificationTimeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6 dark:bg-black">
      <Text className="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
        Notification Time
      </Text>
      <Text className="mt-2 text-center text-neutral-600 dark:text-neutral-400">
        Time picker placeholder
      </Text>
    </View>
  );
}
