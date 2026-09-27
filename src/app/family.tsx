import { LoadingSkeleton } from '../components/loading-skeleton';
import { useCallback, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { RefreshControl, Text, View } from 'react-native';
import { Shell } from '../components/shell';
import { InboxList } from '../components/inbox-list';
import { FamilyCard } from '../components/family-card';
import { Body, Button, Heading } from '../components/ui';
import { useStudio } from '../context/studio';

/** Stories family and friends sent you, newest first. */
export default function Family() {
  const { inbox, family } = useStudio();
  const refreshInbox = inbox.refresh;
  const refreshFamily = family.refresh;
  const [refreshing, setRefreshing] = useState(false);
  const refreshPending = useRef(false);
  const onRefresh = useCallback(async () => {
    if (refreshPending.current) return;
    refreshPending.current = true;
    setRefreshing(true);
    try {
      // Each hook shows its own errors; keep the indicator until both finish.
      await Promise.allSettled([refreshFamily(), refreshInbox()]);
    } finally {
      refreshPending.current = false;
      setRefreshing(false);
    }
  }, [refreshFamily, refreshInbox]);
  // Catch stories sent and people who joined since the last visit.
  useFocusEffect(useCallback(() => { void refreshInbox(); void refreshFamily(); }, [refreshInbox, refreshFamily]));
  return <Shell refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}>
    <View className="w-full max-w-[700px] self-center pb-8 pt-9">
      <Heading>Family</Heading>
      <Body className="mb-6 mt-2">Your family, and the stories they send you.</Body>
      <FamilyCard />

      <View className="mb-4 mt-10 flex-row items-baseline justify-between gap-3">
        <Text accessibilityRole="header" className="text-[20px] font-medium text-ink">Sent to you</Text>
        {inbox.unheard ? <Text className="text-[13px] font-medium text-rust">{inbox.unheard} new</Text> : null}
      </View>
      {inbox.error ? <View className="gap-3">
        <Text accessibilityRole="alert" className="text-[13px] text-rust">{inbox.error}</Text>
        <Button title="Retry" secondary onPress={() => { void inbox.refresh(); }} />
      </View> : inbox.loading && !inbox.items.length ? <LoadingSkeleton label="Loading stories sent to you" />
        : inbox.items.length ? <InboxList items={inbox.items} />
          : <View className="rounded-[18px] border border-dashed border-line p-5">
            <Text className="text-[14px] font-medium text-ink">No stories yet</Text>
            <Text className="mt-1 text-[13px] leading-[19px] text-muted">
              When someone sends you a story, it’ll show up here. Send one yourself from Create with “Send to family & friends”.
            </Text>
          </View>}
    </View>
  </Shell>;
}
