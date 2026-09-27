import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { useStudio } from '../context/studio';
import { colors, Icon } from './ui';

export function CreateModeSwitch({ mode, disabled = false }: { mode: 'voice' | 'written'; disabled?: boolean }) {
  const { storyOpen } = useStudio();
  const choose = (next: 'voice' | 'written') => {
    if (disabled || next === mode) return;
    if (next === 'written') router.push('/share');
    else router.replace(storyOpen ? '/create' : '/');
  };
  const options = [
    { id: 'voice' as const, label: 'Voice story', icon: 'mic' as const },
    { id: 'written' as const, label: 'Written', icon: 'create' as const },
  ];
  return (
    <View className="mt-4 flex-row gap-2">
      {options.map(option => {
        const selected = mode === option.id;
        return (
          <Pressable
            key={option.id}
            accessibilityRole="button"
            accessibilityState={{ selected, disabled }}
            disabled={disabled}
            onPress={() => choose(option.id)}
            className={`min-h-[52px] flex-1 flex-row items-center justify-center gap-2 rounded-[12px] border px-3 ${selected ? 'border-cocoa bg-cocoa' : 'border-line bg-cream'} ${disabled ? 'opacity-50' : ''}`}
          >
            <Icon name={option.icon} size={18} color={selected ? colors.paper : colors.ink} />
            <Text className={`text-[14px] font-medium ${selected ? 'text-paper' : 'text-ink'}`}>{option.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
