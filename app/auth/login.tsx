import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { useAuth } from '@/src/features/auth/AuthContext';

const C = {
  bg:            '#F6F5F2',
  card:          '#FFFFFF',
  border:        '#E8E7E3',
  textPrimary:   '#111110',
  textSecondary: '#6B6A66',
  textTertiary:  '#ADADAA',
  accent:        '#111110',
  error:         '#C9392C',
};

function Input({
  placeholder,
  value,
  onChangeText,
  secureTextEntry,
  keyboardType,
  autoCapitalize,
  autoComplete,
}: {
  placeholder: string;
  value: string;
  onChangeText: (v: string) => void;
  secureTextEntry?: boolean;
  keyboardType?: 'email-address' | 'default';
  autoCapitalize?: 'none' | 'sentences';
  autoComplete?: 'email' | 'current-password' | 'name' | 'new-password';
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = secureTextEntry === true;

  return (
    <View style={{ marginBottom: 10 }}>
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={C.textTertiary}
        value={value}
        onChangeText={onChangeText}
        secureTextEntry={isPassword && !visible}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize ?? 'none'}
        autoComplete={autoComplete}
        style={{
          backgroundColor: C.card,
          borderWidth: 1,
          borderColor: C.border,
          borderRadius: 12,
          paddingHorizontal: 16,
          paddingVertical: 14,
          paddingRight: isPassword ? 48 : 16,
          fontSize: 15,
          color: C.textPrimary,
        }}
      />
      {isPassword && (
        <TouchableOpacity
          onPress={() => setVisible(v => !v)}
          style={{ position: 'absolute', right: 14, top: 0, bottom: 0, justifyContent: 'center' }}
          hitSlop={8}
        >
          <Text style={{ fontSize: 12, color: C.textTertiary, fontWeight: '600' }}>
            {visible ? 'HIDE' : 'SHOW'}
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');

  async function handleSignIn() {
    setError('');
    if (!email.trim() || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      router.replace('/(tabs)/' as never);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign in failed.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 28 }}>

        {/* Brand */}
        <Text style={{
          fontSize: 11,
          fontWeight: '700',
          letterSpacing: 3.5,
          color: C.textTertiary,
          textTransform: 'uppercase',
          marginBottom: 44,
        }}>
          AheadNews
        </Text>

        <Text style={{
          fontSize: 30,
          fontWeight: '700',
          color: C.textPrimary,
          letterSpacing: -0.8,
          marginBottom: 6,
        }}>
          Welcome back
        </Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, marginBottom: 36 }}>
          Stay ahead of the news.
        </Text>

        {/* Form */}
        <Input
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Input
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
        />

        {error ? (
          <Text style={{ fontSize: 13, color: C.error, marginBottom: 14, marginTop: 2 }}>
            {error}
          </Text>
        ) : (
          <View style={{ height: 14 }} />
        )}

        <Pressable
          onPress={handleSignIn}
          disabled={loading}
          style={{
            backgroundColor: C.accent,
            borderRadius: 12,
            paddingVertical: 15,
            alignItems: 'center',
            marginBottom: 20,
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Sign in</Text>
          }
        </Pressable>

        <Pressable onPress={() => router.push('/auth/signup')} style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: C.textSecondary }}>
            New here?{'  '}
            <Text style={{ color: C.textPrimary, fontWeight: '600' }}>Create account →</Text>
          </Text>
        </Pressable>

      </View>
    </KeyboardAvoidingView>
  );
}
