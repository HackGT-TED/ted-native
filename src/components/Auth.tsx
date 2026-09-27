import { useRef, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";
import { Button } from "./ui";

export default function Auth({ onRegisterChange }: { onRegisterChange?: (register: boolean) => void }) {
  const [register, setRegister] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const pending = useRef(false);

  async function submit() {
    if (!supabase || pending.current) return;
    setError("");
    setNotice("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Enter a valid email.");
      return;
    }
    if (!password || (register && password.length < 8)) {
      setError(
        register
          ? "Use at least 8 characters for your password."
          : "Enter your password.",
      );
      return;
    }
    if (register && !displayName.trim()) {
      setError("Enter your name.");
      return;
    }
    pending.current = true;
    setLoading(true);
    try {
      const credentials = { email: email.trim(), password };
      const { data, error: authError } = register
        ? await supabase.auth.signUp({
            ...credentials,
            options: { data: { display_name: displayName.trim() } },
          })
        : await supabase.auth.signInWithPassword(credentials);
      if (authError) throw authError;
      setPassword("");
      if (register && !data.session) {
        setNotice(
          "Check your email to confirm your account, then return here to sign in.",
        );
        setRegister(false);
        onRegisterChange?.(false);
      }
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Could not connect. Please try again.",
      );
    } finally {
      pending.current = false;
      setLoading(false);
    }
  }

  return (
    <View>
      <Text className="text-[14px] leading-5 tracking-[-0.2px] text-muted">
        {register ? "Create your TedTime account." : "Welcome back to TedTime."}
      </Text>
      {register && (
        <>
          <Text className="mb-1.5 mt-4 text-[13px] leading-4 tracking-[-0.15px] text-ink">Name</Text>
          <TextInput
            accessibilityLabel="Name"
            value={displayName}
            onChangeText={setDisplayName}
            autoComplete="name"
            maxLength={80}
            editable={!loading}
            className="min-h-[52px] rounded-[10px] border border-line bg-paper px-4 text-[15px] tracking-[-0.2px] text-ink"
          />
        </>
      )}
      <Text className="mb-1.5 mt-4 text-[13px] leading-4 tracking-[-0.15px] text-ink">Email</Text>
      <TextInput
        accessibilityLabel="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        editable={!loading}
        placeholder="you@example.com"
        className="placeholder:text-muted min-h-[52px] rounded-[10px] border border-line bg-paper px-4 text-[15px] tracking-[-0.2px] text-ink"
      />
      <Text className="mb-1.5 mt-4 text-[13px] leading-4 tracking-[-0.15px] text-ink">Password</Text>
      <TextInput
        accessibilityLabel="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={register ? "new-password" : "current-password"}
        editable={!loading}
        onSubmitEditing={() => {
          void submit();
        }}
        className="min-h-[52px] rounded-[10px] border border-line bg-paper px-4 text-[15px] tracking-[-0.2px] text-ink"
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          className="my-3 text-[13px] leading-[18px] tracking-[-0.15px] text-rust"
        >
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-3 text-[13px] leading-[18px] tracking-[-0.15px] text-muted"
        >
          {notice}
        </Text>
      ) : null}
      <Button
        title={
          loading ? "Please wait…" : register ? "Create account" : "Sign in"
        }
        disabled={loading || !supabase}
        onPress={() => {
          void submit();
        }}
        className="mt-4"
      />
      <Pressable
        accessibilityRole="button"
        disabled={loading}
        onPress={() => {
          setRegister(!register);
          onRegisterChange?.(!register);
          setError("");
          setNotice("");
        }}
        className="min-h-[54px] items-center justify-center"
      >
        <Text className="text-[13px] text-ink">
          {register ? "Already have an account? Sign in" : "Create an account"}
        </Text>
      </Pressable>
    </View>
  );
}
