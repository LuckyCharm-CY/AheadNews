import { Text, View } from 'react-native';

export default function WelcomeScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white px-6 dark:bg-black">
      <Text className="text-3xl font-bold text-neutral-900 dark:text-neutral-100">AheadToday</Text>
      <Text className="mt-2 text-center text-neutral-600 dark:text-neutral-400">
        Welcome screen placeholder
      </Text>
    </View>
  );
}
