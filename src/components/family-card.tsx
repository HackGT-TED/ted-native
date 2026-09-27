import { useState } from 'react';
import { ActivityIndicator, Pressable, Share, Text, TextInput, View } from 'react-native';
import { useStudio } from '../context/studio';
import type { FamilyMember } from '../hooks/use-family';
import { Button, colors, Icon } from './ui';

function memberName(member: FamilyMember) {
  return member.full_name?.trim() || member.username || 'Family member';
}

/** "Start a family" or "Join with a code" when not in one; otherwise the invite code and members. */
export function FamilyCard() {
  const { family } = useStudio();
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [confirmLeave, setConfirmLeave] = useState(false);

  const act = (action: () => Promise<void>) => {
    setError('');
    action().then(() => { setName(''); setCode(''); setConfirmLeave(false); })
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Something went wrong. Please retry.'));
  };

  if (family.loading && !family.family) {
    return <ActivityIndicator accessibilityLabel="Loading your family" className="my-6" color={colors.cocoa} />;
  }
  if (family.error) {
    return <View className="gap-3 rounded-[20px] bg-cream p-5">
      <Text accessibilityRole="alert" className="text-[13px] text-rust">{family.error}</Text>
      <Button title="Retry" secondary onPress={() => { void family.refresh(); }} />
    </View>;
  }

  const current = family.family;
  if (!current) {
    return <View className="gap-5 rounded-[20px] bg-cream p-5">
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-[17px] font-medium text-ink">Start a family</Text>
        <Text className="text-[13px] leading-[19px] text-muted">Create your family, then share its code so everyone can join.</Text>
        <TextInput accessibilityLabel="Family name" value={name} onChangeText={setName} maxLength={60}
          editable={!family.busy} placeholder="The Rivera family" placeholderTextColor={colors.muted}
          returnKeyType="done" onSubmitEditing={() => act(() => family.create(name))}
          className="min-h-12 rounded-[10px] border border-line bg-paper px-4 text-[15px] text-ink" />
        <Button title={family.busy ? 'Please wait…' : 'Start a family'} disabled={family.busy}
          onPress={() => act(() => family.create(name))} />
      </View>
      <View className="flex-row items-center gap-3">
        <View className="h-px flex-1 bg-line" /><Text className="text-[12px] text-muted">or</Text><View className="h-px flex-1 bg-line" />
      </View>
      <View className="gap-2">
        <Text accessibilityRole="header" className="text-[17px] font-medium text-ink">Join with a code</Text>
        <TextInput accessibilityLabel="Family invite code" value={code}
          onChangeText={value => setCode(value.toUpperCase())} maxLength={8}
          editable={!family.busy} placeholder="ABC234" placeholderTextColor={colors.muted}
          autoCapitalize="characters" autoCorrect={false} returnKeyType="done"
          onSubmitEditing={() => act(() => family.join(code))}
          className="min-h-12 rounded-[10px] border border-line bg-paper px-4 text-[18px] tracking-[4px] text-ink" />
        <Button title={family.busy ? 'Please wait…' : 'Join family'} secondary disabled={family.busy}
          onPress={() => act(() => family.join(code))} />
      </View>
      {error ? <Text accessibilityRole="alert" className="text-[13px] text-rust">{error}</Text> : null}
    </View>;
  }

  const share = () => {
    void Share.share({
      message: `Join my family "${current.name}" on TedTime! Open TedTime, tap Family, and enter this code: ${current.invite_code}`,
    }).catch(() => { /* The code stays on screen to read out or copy. */ });
  };

  return <View className="gap-4 rounded-[20px] bg-cream p-5">
    <View className="flex-row items-center gap-3">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-cocoa">
        <Icon name="family" size={24} color={colors.paper} />
      </View>
      <View className="flex-1">
        <Text accessibilityRole="header" numberOfLines={1} className="text-[18px] font-medium text-ink">{current.name}</Text>
        <Text className="text-[12px] text-muted">{current.members.length} {current.members.length === 1 ? 'member' : 'members'}</Text>
      </View>
    </View>

    <View className="items-center gap-3 rounded-[16px] bg-paper p-4">
      <Text className="text-[12px] text-muted">Invite code</Text>
      <Text selectable accessibilityLabel={`Invite code ${current.invite_code.split('').join(' ')}`}
        className="text-[32px] font-semibold tracking-[8px] text-ink" style={{ fontVariant: ['tabular-nums'] }}>
        {current.invite_code}
      </Text>
      <Button title="Share code" icon="arrow" className="self-stretch" onPress={share} />
      <Text className="text-center text-[12px] leading-[18px] text-muted">
        Family members open TedTime, tap Family, and enter this code to join.
      </Text>
    </View>

    <View className="gap-2">
      <Text className="text-[13px] font-medium text-ink">Members</Text>
      {current.members.map(member => <View key={member.id} className="min-h-10 flex-row items-center gap-3">
        <View className="h-8 w-8 items-center justify-center rounded-full bg-paper">
          <Icon name="person" size={18} color={colors.cocoa} />
        </View>
        <Text className="flex-1 text-[14px] text-ink">{memberName(member)}{member.is_me ? ' (you)' : ''}</Text>
        {member.username ? <Text className="text-[12px] text-muted">@{member.username}</Text> : null}
      </View>)}
    </View>

    <Pressable accessibilityRole="button" disabled={family.busy}
      accessibilityLabel={confirmLeave ? `Confirm leaving ${current.name}` : `Leave ${current.name}`}
      onPress={() => confirmLeave ? act(family.leave) : setConfirmLeave(true)}
      className="min-h-11 items-center justify-center">
      <Text className={`text-[13px] ${confirmLeave ? 'font-semibold text-rust' : 'text-muted'}`}>
        {family.busy ? 'Please wait…' : confirmLeave ? 'Tap again to leave this family' : 'Leave family'}
      </Text>
    </Pressable>
    {error ? <Text accessibilityRole="alert" className="text-[13px] text-rust">{error}</Text> : null}
  </View>;
}
