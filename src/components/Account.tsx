import { useEffect, useRef, useState } from "react";
import { Text, TextInput, View } from "react-native";
import { supabase } from "../lib/supabase";
import { Button } from "./ui";

export default function Account({
  userId,
  email,
  displayName = "",
}: {
  userId: string;
  email?: string;
  displayName?: string;
}) {
  const [username, setUsername] = useState(displayName);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [attempt, setAttempt] = useState(0);
  const pending = useRef(false);

  useEffect(() => {
    const client = supabase;
    if (!client) return;
    let live = true;
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setReady(false);
      setError("");
      try {
        const { data, error: profileError } = await client!
          .from("profiles")
          .select("username")
          .eq("id", userId)
          .abortSignal(controller.signal)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!live) return;
        if (data) {
          setUsername(data.username ?? "");
        }
        setReady(true);
      } catch {
        if (live)
          setError("Your profile could not be loaded. Please try again.");
      } finally {
        if (live) setLoading(false);
      }
    }
    void load();
    return () => {
      live = false;
      controller.abort();
    };
  }, [userId, attempt]);

  async function save() {
    if (!supabase || !ready || pending.current) return;
    if (!username.trim()) {
      setError("Enter a username.");
      return;
    }
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: profileError } = await supabase.from("profiles").upsert({
        id: userId,
        username: username.trim(),
        updated_at: new Date().toISOString(),
      });
      if (profileError) throw profileError;
      const { error: metadataError } = await supabase.auth.updateUser({
        data: { display_name: username.trim() },
      });
      if (metadataError) {
        setError(
          "Profile saved, but your display name could not sync. Try saving again.",
        );
      } else setNotice("Profile saved.");
    } catch {
      setError("Your profile could not be saved. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function signOut() {
    if (!supabase || pending.current) return;
    pending.current = true;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const { error: signOutError } = await supabase.auth.signOut({
        scope: "local",
      });
      if (signOutError) throw signOutError;
    } catch {
      setError("Could not sign out. Please try again.");
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  return (
    <View>
      <Text className="mb-2.5 mt-6 text-[13px] text-ink">Email</Text>
      <TextInput
        accessibilityLabel="Account email"
        value={email ?? ""}
        editable={false}
        className="min-h-[52px] rounded-[10px] border border-line bg-cream px-4 text-[15px] text-muted"
      />
      <Text className="mb-2.5 mt-6 text-[13px] text-ink">Username</Text>
      <TextInput
        accessibilityLabel="Username"
        value={username}
        onChangeText={setUsername}
        editable={ready && !busy}
        maxLength={80}
        className="min-h-[52px] rounded-[10px] border border-line bg-paper px-4 text-[15px] text-ink"
      />
      {error ? (
        <Text
          accessibilityRole="alert"
          className="my-3 text-[13px] leading-5 text-rust"
        >
          {error}
        </Text>
      ) : null}
      {notice ? (
        <Text
          accessibilityLiveRegion="polite"
          className="mt-3.5 text-[13px] leading-5 text-muted"
        >
          {notice}
        </Text>
      ) : null}
      {loading ? (
        <Text className="mt-3.5 text-[13px] leading-5 text-muted">
          Loading profile…
        </Text>
      ) : ready ? (
        <Button
          title={busy ? "Please wait…" : "Save profile"}
          disabled={busy}
          onPress={() => {
            void save();
          }}
          className="mt-5"
        />
      ) : (
        <Button
          title="Retry loading profile"
          secondary
          disabled={busy}
          onPress={() => setAttempt((value) => value + 1)}
          className="mt-5"
        />
      )}
      <Button
        title="Sign out"
        secondary
        disabled={busy}
        onPress={() => {
          void signOut();
        }}
        className="mt-5"
      />
    </View>
  );
}
