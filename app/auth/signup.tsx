import { useRouter } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
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
  autoCapitalize?: 'none' | 'words';
  autoComplete?: 'email' | 'new-password' | 'name';
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

export default function SignupScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name,            setName]            = useState('');
  const [email,           setEmail]           = useState('');
  const [password,        setPassword]        = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState('');
  const [emailSent, setEmailSent] = useState(false);

  async function handleSignUp() {
    setError('');
    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('Please fill in all fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const { needsEmailConfirm } = await signUp(name.trim(), email.trim(), password);
      if (needsEmailConfirm) {
        setEmailSent(true);
      } else {
        router.replace('/(onboarding)/interests' as never);
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Sign up failed.');
    } finally {
      setLoading(false);
    }
  }

  if (emailSent) {
    return (
      <View style={{ flex: 1, backgroundColor: C.bg, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 32 }}>
        <Text style={{ fontSize: 22, fontWeight: '700', color: C.textPrimary, letterSpacing: -0.5, marginBottom: 10, textAlign: 'center' }}>
          Check your email
        </Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 32 }}>
          We sent a confirmation link to {email}. Click it to activate your account, then sign in.
        </Text>
        <Pressable onPress={() => router.replace('/auth/login' as never)} style={{
          backgroundColor: C.accent, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32,
        }}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Go to sign in</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: C.bg }}
    >
      <ScrollView
        contentContainerStyle={{
          flexGrow: 1,
          justifyContent: 'center',
          paddingHorizontal: 28,
          paddingVertical: 64,
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
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
          Create account
        </Text>
        <Text style={{ fontSize: 14, color: C.textSecondary, marginBottom: 36 }}>
          Join the AheadNews community.
        </Text>

        {/* Form */}
        <Input
          placeholder="Full name"
          value={name}
          onChangeText={setName}
          autoCapitalize="words"
          autoComplete="name"
        />
        <Input
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoComplete="email"
        />
        <Input
          placeholder="Password (min 6 characters)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="new-password"
        />
        <Input
          placeholder="Confirm password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          secureTextEntry
          autoComplete="new-password"
        />

        {error ? (
          <Text style={{ fontSize: 13, color: C.error, marginBottom: 14, marginTop: 2 }}>
            {error}
          </Text>
        ) : (
          <View style={{ height: 14 }} />
        )}

        <Pressable
          onPress={handleSignUp}
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
            : <Text style={{ fontSize: 15, fontWeight: '600', color: '#fff' }}>Create account</Text>
          }
        </Pressable>

        <Pressable onPress={() => router.back()} style={{ alignItems: 'center' }}>
          <Text style={{ fontSize: 13, color: C.textSecondary }}>
            Already have an account?{'  '}
            <Text style={{ color: C.textPrimary, fontWeight: '600' }}>Sign in →</Text>
          </Text>
        </Pressable>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}
