import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { Shell } from '../components/shell';
import { InboxList } from '../components/inbox-list';
import { FamilyCard } from '../components/family-card';
import { Body, Button, colors, Heading } from '../components/ui';
import { useStudio } from '../context/studio';

/** Stories family and friends sent you, newest first. */
export default function Family() {
  const { inbox, family } = useStudio();
  const refreshInbox = inbox.refresh;
  const refreshFamily = family.refresh;
  // Catch stories sent and people who joined since the last visit.
  useFocusEffect(useCallback(() => { void refreshInbox(); void refreshFamily(); }, [refreshInbox, refreshFamily]));
  return <Shell>
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
      </View> : inbox.loading && !inbox.items.length ? <ActivityIndicator accessibilityLabel="Loading stories sent to you" className="mt-10" color={colors.cocoa} />
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
