import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Creation, useStudio } from '../context/studio';
import { colors, Icon, serif } from './ui';
export function Cover({
  item,
  tall = false
}: {
  item: Creation;
  tall?: boolean;
}) {
  const narrow = useWindowDimensions().width < 700 && !tall;
  return <View style={[s.cover, {
    backgroundColor: item.color,
    aspectRatio: tall ? 0.85 : narrow ? 1.05 : 1.45
  }]}>{item.illustrated ? <><Image source={require('../../assets/images/tedtime/storybook.png')} style={StyleSheet.absoluteFill} contentFit="cover" /><View style={s.imageLabel}><Text style={[s.imageTitle, narrow && {
          fontSize: 16
        }]}>{item.title.replace('\n', ' ')}</Text></View></> : <View style={s.bookBorder}><Text style={s.bookTop}>THE TEDTIME COLLECTION</Text><Text style={[s.coverTitle, narrow && {
        fontSize: 19,
        lineHeight: 21
      }, tall && {
        fontSize: 38,
        lineHeight: 42
      }]}>{item.title}</Text><Text style={[s.flower, narrow && {
        fontSize: 24,
        lineHeight: 25
      }]}>{item.category === 'Prints' ? '❦' : '❧'}</Text><Text style={[s.bookBottom, narrow && {
        fontSize: 9
      }]}>{item.subtitle}</Text></View>}</View>;
}
export function CreationCard({
  item,
  compact = false
}: {
  item: Creation;
  compact?: boolean;
}) {
  const {
    saved,
    toggleSave
  } = useStudio();
  const isSaved = saved.includes(item.id);
  return <View><Pressable accessibilityRole="link" accessibilityLabel={`View ${item.title.replace('\n', ' ')}`} onPress={() => router.push({
      pathname: '/item/[id]',
      params: {
        id: item.id
      }
    })} style={({
      pressed
    }) => ({
      opacity: pressed ? 0.8 : 1
    })}><Cover item={item} /></Pressable><View style={s.meta}><Text style={s.category}>{item.category.toUpperCase()}</Text><Text style={s.price}>{item.price}</Text></View><Pressable accessibilityRole="link" onPress={() => router.push({
      pathname: '/item/[id]',
      params: {
        id: item.id
      }
    })}><Text style={[s.title, compact && {
        fontSize: 21
      }]}>{item.title.replace('\n', ' ')}</Text></Pressable><View style={s.authorRow}><Text style={s.author} numberOfLines={1}>by {item.author}</Text><Pressable accessibilityRole="button" accessibilityLabel={`${isSaved ? 'Unsave' : 'Save'} ${item.title.replace('\n', ' ')}`} accessibilityState={{
        selected: isSaved
      }} onPress={() => toggleSave(item.id)} hitSlop={8} style={s.save}><Icon name={isSaved ? 'check' : 'heart'} size={18} color={isSaved ? colors.rust : colors.muted} /></Pressable></View></View>;
}
const s = StyleSheet.create({
  cover: {
    borderRadius: 4,
    overflow: 'hidden',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bookBorder: {
    borderWidth: 1,
    borderColor: '#B6B09B',
    width: '100%',
    height: '100%',
    padding: 12,
    alignItems: 'center',
    justifyContent: 'center'
  },
  bookTop: {
    fontSize: 6,
    letterSpacing: 1.6,
    color: '#74755F',
    textAlign: 'center'
  },
  coverTitle: {
    fontFamily: serif,
    fontSize: 27,
    lineHeight: 29,
    color: '#4C5340',
    textAlign: 'center',
    marginTop: 9
  },
  flower: {
    color: '#788061',
    fontSize: 33,
    lineHeight: 38
  },
  bookBottom: {
    fontFamily: serif,
    fontStyle: 'italic',
    fontSize: 11,
    color: '#74755F',
    textAlign: 'center'
  },
  imageLabel: {
    position: 'absolute',
    bottom: 13,
    alignSelf: 'center',
    backgroundColor: '#F7F3E8ED',
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: '#AAA78C',
    maxWidth: '92%'
  },
  imageTitle: {
    fontFamily: serif,
    fontSize: 20,
    color: colors.ink,
    textAlign: 'center'
  },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 15
  },
  category: {
    fontSize: 8,
    color: colors.muted,
    letterSpacing: 1.5
  },
  price: {
    fontSize: 11,
    color: colors.green
  },
  title: {
    fontFamily: serif,
    fontSize: 24,
    color: colors.ink,
    marginTop: 5
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4
  },
  author: {
    fontSize: 10,
    color: colors.muted,
    flex: 1
  },
  save: {
    minWidth: 40,
    minHeight: 40,
    alignItems: 'flex-end',
    justifyContent: 'center'
  }
});
