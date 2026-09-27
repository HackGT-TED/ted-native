import { View, type ViewStyle } from 'react-native';
import Skeleton, { type ISkeletonProps } from 'react-native-reanimated-skeleton';
import { useReducedMotion } from 'react-native-reanimated';
import { colors } from './ui';

type Layout = NonNullable<ISkeletonProps['layout']>;
type Variant = 'screen' | 'grid' | 'rows' | 'cards' | 'form' | 'family' | 'player' | 'workspace' | 'field' | 'cover' | 'inline';

const line = (width: ViewStyle['width'], height = 14): Layout[number] => ({ width, height, borderRadius: 7 });
const column = (children: Layout, style: ViewStyle = {}): Layout[number] => ({ gap: 12, ...style, children });
const fields = (count: number): Layout => Array.from({ length: count }, (_, key) => ({ key, ...column([
  line('28%', 12), { width: '100%', height: 52, borderRadius: 10 },
], { marginBottom: 16 }) }));
const rows: Layout = Array.from({ length: 3 }, (_, key) => ({
  key, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12,
  padding: 12, borderWidth: 1, borderColor: colors.line, borderRadius: 18,
  children: [
    { width: 56, height: 56, borderRadius: 12 },
    column([line('80%', 16), line('55%', 12)], { flex: 1 }),
    { width: 32, height: 32, borderRadius: 16 },
  ],
}));
const cards: Layout = Array.from({ length: 3 }, (_, key) => ({
  key, padding: 20, marginBottom: 12, borderRadius: 18, borderWidth: 1, borderColor: colors.line,
  children: [column([line('65%', 20), line('45%', 12), line('30%', 12)])],
}));
const layouts: Record<Variant, Layout> = {
  inline: [{ width: 24, height: 24, borderRadius: 12 }],
  field: [{ width: '100%', height: 56, borderRadius: 12 }],
  cover: [{ width: '100%', height: '100%', borderRadius: 20 }],
  rows,
  cards,
  grid: [{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', children:
    Array.from({ length: 4 }, (_, key) => ({ key, width: '48%', marginBottom: 20, gap: 10, children: [
      { width: '100%', aspectRatio: 1, height: undefined, borderRadius: 16 },
      line('85%', 16), line('60%', 12),
    ] })),
  }],
  form: [...fields(3), { width: '100%', height: 50, borderRadius: 10 }],
  family: [column([
    line('60%', 22), line('80%', 13), { width: '100%', height: 50, borderRadius: 10 }, ...rows.slice(0, 2),
  ], { padding: 20, borderRadius: 20, borderWidth: 1, borderColor: colors.line })],
  player: [column([
    { width: '100%', aspectRatio: 1, height: undefined, borderRadius: 24 },
    line('75%', 28), line('45%', 13), line('100%', 6),
    { width: 80, height: 80, borderRadius: 40, alignSelf: 'center', marginTop: 12 },
  ], { width: '100%', maxWidth: 340, alignSelf: 'center', gap: 20 })],
  workspace: [line('45%', 40), column([
    { width: '100%', aspectRatio: 1, height: undefined, borderRadius: 20 },
  ], { width: '100%', maxWidth: 280, alignSelf: 'center', marginVertical: 20 }), ...fields(1), ...rows.slice(0, 2)],
  screen: [
    { width: '42%', height: 28, borderRadius: 8, marginBottom: 36 },
    { width: '75%', height: 42, borderRadius: 10, marginBottom: 14 },
    { ...line('90%'), marginBottom: 28 },
    { width: '100%', height: 116, borderRadius: 20, marginBottom: 32 },
    { ...line('60%', 22), marginBottom: 20 }, ...rows,
  ],
};

/** Shared warm placeholders. Announce one loading region, not individual bones. */
export function LoadingSkeleton({ variant = 'rows', label = 'Loading', className = '', style }: {
  variant?: Variant; label?: string; className?: string; style?: ViewStyle;
}) {
  const reducedMotion = useReducedMotion();
  return <View accessible accessibilityLabel={label} accessibilityRole="progressbar"
    accessibilityState={{ busy: true }} pointerEvents="none" className={className} style={style}>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={variant === 'cover' ? { height: '100%' } : undefined}>
      <Skeleton isLoading layout={layouts[variant]} animationType={reducedMotion ? 'none' : 'shiver'}
        boneColor={colors.line} highlightColor={colors.cream} duration={1500}
        containerStyle={variant === 'inline' ? { width: 24, height: 24 } : { width: '100%', ...(variant === 'cover' ? { height: '100%' } : {}) }} />
    </View>
  </View>;
}
