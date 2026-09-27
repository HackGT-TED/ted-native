import { useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { ActivityIndicator, Text, View } from 'react-native';
import { Shell } from '../components/shell';
import { InboxList } from '../components/inbox-list';
import { Body, Button, colors, Heading } from '../components/ui';
import { useStudio } from '../context/studio';

/** Stories family and friends sent you, newest first. */
export default function Family() {
  const { inbox } = useStudio();
  const refreshInbox = inbox.refresh;
  // Catch anything sent since the last visit.
  useFocusEffect(useCallback(() => { void refreshInbox(); }, [refreshInbox]));
  return <Shell>
    <View className="w-full max-w-[700px] self-center pb-8 pt-9">
      <View className="flex-row items-baseline justify-between gap-3">
        <Heading>Family</Heading>
        {inbox.unheard ? <Text className="text-[13px] font-medium text-rust">{inbox.unheard} new</Text> : null}
      </View>
      <Body className="mb-6 mt-2">Stories your family and friends sent you.</Body>
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
