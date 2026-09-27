import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { useStudio } from '../context/studio';
import { personName, searchPeople, type Person } from '../services/story-shares';
import { colors, Icon } from './ui';

/** "Send to" picker: search people by name or username and collect them as chips. */
export function StoryRecipients({ selected, onChange, disabled = false }: {
  selected: Person[]; onChange: (people: Person[]) => void; disabled?: boolean;
}) {
  const { family } = useStudio();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Person[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const request = useRef(0);

  useEffect(() => {
    const text = query.trim();
    if (text.length < 2) return;
    const version = ++request.current;
    // Wait for a pause in typing before searching.
    const timer = setTimeout(() => {
      setSearching(true);
      searchPeople(text).then(people => {
        if (version === request.current) { setResults(people); setError(''); }
      }).catch((cause: unknown) => {
        if (version === request.current) setError(cause instanceof Error ? cause.message : 'Could not search for people.');
      }).finally(() => {
        if (version === request.current) setSearching(false);
      });
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const type = (value: string) => {
    setQuery(value);
    if (value.trim().length < 2) { request.current++; setResults([]); setSearching(false); setError(''); }
  };
  const chosen = new Set(selected.map(person => person.id));
  const matches = results.filter(person => !chosen.has(person.id));
  // Family members are one tap away; everyone else is found by search.
  const relatives: Person[] = (family.family?.members ?? [])
    .filter(member => !member.is_me && !chosen.has(member.id))
    .map(({ id, username, full_name }) => ({ id, username, full_name }));

  return <View className="gap-2">
    <Text nativeID="send-to-label" className="text-[13px] text-ink">Send to family & friends</Text>
    {relatives.length ? <View className="gap-1.5">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] text-muted">{family.family?.name}</Text>
        {relatives.length > 1 ? <Pressable accessibilityRole="button" disabled={disabled}
          onPress={() => onChange([...selected, ...relatives])} className="min-h-9 justify-center pl-3">
          <Text className="text-[12px] font-medium text-cocoa">Send to everyone</Text>
        </Pressable> : null}
      </View>
      <View className="flex-row flex-wrap gap-2">
        {relatives.map(person => <Pressable key={person.id} accessibilityRole="button"
          accessibilityLabel={`Send to ${personName(person)}`} disabled={disabled}
          onPress={() => onChange([...selected, person])}
          className="min-h-9 flex-row items-center gap-1 rounded-full border border-line bg-cream pl-2.5 pr-3.5">
          <Text className="text-[15px] text-cocoa">+</Text>
          <Text className="text-[13px] text-ink">{personName(person)}</Text>
        </Pressable>)}
      </View>
    </View> : null}
    {selected.length ? <View className="flex-row flex-wrap gap-2">
      {selected.map(person => <Pressable key={person.id} accessibilityRole="button"
        accessibilityLabel={`Remove ${personName(person)}`} disabled={disabled}
        onPress={() => onChange(selected.filter(item => item.id !== person.id))}
        className="min-h-9 flex-row items-center gap-1.5 rounded-full bg-cocoa pl-3.5 pr-2.5">
        <Text className="text-[13px] font-medium text-paper">{personName(person)}</Text>
        <Icon name="close" size={16} color={colors.paper} />
      </Pressable>)}
    </View> : null}
    <View className="flex-row items-center gap-2 rounded-[10px] border border-line bg-paper px-3">
      <Icon name="search" size={18} color={colors.muted} />
      <TextInput accessibilityLabel="Search people to send to" accessibilityLabelledBy="send-to-label"
        value={query} onChangeText={type} editable={!disabled}
        placeholder="Search by name or username" placeholderTextColor={colors.muted}
        autoCapitalize="none" autoCorrect={false}
        className="min-h-11 flex-1 text-[14px] text-ink" />
      {searching ? <ActivityIndicator color={colors.cocoa} /> : null}
    </View>
    {error ? <Text accessibilityRole="alert" className="text-[12px] text-rust">{error}</Text> : null}
    {query.trim().length >= 2 && !searching && !error ? <View className="overflow-hidden rounded-[10px] border border-line">
      {matches.length ? matches.map(person => <Pressable key={person.id} accessibilityRole="button"
        accessibilityLabel={`Send to ${personName(person)}`} disabled={disabled}
        onPress={() => { onChange([...selected, person]); type(''); }}
        className="min-h-11 flex-row items-center justify-between border-b border-line px-3.5 py-2 active:bg-cream">
        <View className="flex-1">
          <Text className="text-[14px] text-ink">{personName(person)}</Text>
          {person.username ? <Text className="text-[11px] text-muted">@{person.username}</Text> : null}
        </View>
        <Text className="text-[12px] font-medium text-cocoa">Add</Text>
      </Pressable>) : <Text className="px-3.5 py-3 text-[12px] text-muted">No one found. Try their name or username.</Text>}
    </View> : null}
  </View>;
}
