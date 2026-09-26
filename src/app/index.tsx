import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { Shell } from '../components/shell';
import { Body, Button, colors, Heading, Icon, Label, Ornament, serif } from '../components/ui';
import { CreationCard } from '../components/creation-card';
import { useStudio } from '../context/studio';
export default function Home() {
  const {
    width
  } = useWindowDimensions();
  const mobile = width < 700;
  const {
    creations
  } = useStudio();
  return <Shell><View style={[s.hero, mobile && s.mobileHero]}><View style={[s.heroText, mobile && {
        width: '100%',
        alignItems: 'center'
      }]}><Label style={{
          color: colors.gold
        }}>A LITTLE WONDER, EVERY DAY</Label><Heading style={[s.title, mobile && s.mobileTitle]}>Good things take{'\n'}a little <Text style={{
            fontStyle: 'italic'
          }}>TedTime.</Text></Heading><Body style={[s.description, mobile && {
          textAlign: 'center',
          maxWidth: 290
        }]}>A gathering place for curious minds and creative souls. Discover little treasures. Make something meaningful.</Body>{!mobile && <View style={s.actions}><Button title="Explore the marketplace" icon="arrow" onPress={() => router.push('/marketplace')} /><Pressable accessibilityRole="link" onPress={() => router.push('/create')} style={s.makeLink}><Text style={s.makeText}>Or, make a little magic</Text><Icon name="create" size={16} /></Pressable></View>}{!mobile && <View style={s.note}><Icon name="leaf" size={16} color={colors.muted} /><Text style={s.noteText}>Thoughtfully made. Wonderfully yours.</Text></View>}</View><View style={[s.artFrame, mobile && s.mobileArt]}><View style={s.innerFrame}><Image source={require('../../assets/images/tedtime/storybook.png')} style={s.art} contentFit="cover" accessibilityLabel="A teddy bear and rabbit sharing a book beneath an old oak tree" /></View><View style={s.artCaption}><Text style={s.captionText}>There’s a little story in everything.</Text><Text style={{
            color: colors.gold
          }}>✧</Text></View></View>{mobile && <View style={s.mobileActions}><Button title="Explore the marketplace" icon="arrow" onPress={() => router.push('/marketplace')} style={{
          width: '100%'
        }} /><Pressable accessibilityRole="link" onPress={() => router.push('/create')} style={s.makeLink}><Text style={s.makeText}>Or, make a little magic</Text><Icon name="create" size={16} /></Pressable></View>}</View><View style={[s.values, mobile && {
      paddingVertical: 16,
      gap: 12
    }]}>{[{
        icon: 'book' as const,
        title: 'Stories worth keeping',
        detail: 'A little escape from the everyday'
      }, {
        icon: 'leaf' as const,
        title: 'Made with heart',
        detail: 'By independent, imaginative people'
      }, {
        icon: 'sparkle' as const,
        title: 'Room for your imagination',
        detail: 'Your next chapter starts here'
      }].map((item, i) => <View style={[s.value, mobile && {
        gap: 7
      }, i > 0 && s.valueBorder]} key={item.title}><Icon name={item.icon} size={mobile ? 24 : 29} color={colors.gold} /><View><Text style={[s.valueTitle, mobile && {
            fontSize: 14,
            textAlign: 'center',
            maxWidth: 95
          }]}>{item.title}</Text>{!mobile && <Text style={s.valueDetail}>{item.detail}</Text>}</View></View>)}</View><View style={s.sectionHeader}><View><Label>THE CURIOSITY CORNER</Label><Heading style={{
          fontSize: mobile ? 29 : 36,
          marginTop: 6
        }}>A world of little wonders</Heading></View><Pressable accessibilityRole="link" accessibilityLabel="Browse all creations" onPress={() => router.push('/marketplace')} style={s.browse}>{!mobile && <Text style={s.makeText}>Browse all</Text>}<Icon name="arrow" size={22} /></Pressable></View><View style={[s.cards, mobile && {
      gap: 13
    }]}>{creations.slice(0, mobile ? 2 : 3).map(item => <View style={{
        flex: 1,
        minWidth: 0
      }} key={item.id}><CreationCard item={item} compact /></View>)}</View><Ornament /><View style={s.invitation}><Heading style={{
        fontSize: mobile ? 28 : 33,
        textAlign: 'center'
      }}>Every wonderful thing starts with a little idea.</Heading><Body style={{
        textAlign: 'center',
        marginTop: 7
      }}>Yours belongs here, too.</Body><Pressable accessibilityRole="link" onPress={() => router.push('/create')} style={[s.makeLink, {
        marginTop: 17
      }]}><Text style={s.makeText}>Begin your next chapter</Text><Icon name="arrow" size={18} /></Pressable></View></Shell>;
}
const s = StyleSheet.create({
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 46,
    paddingTop: 49,
    paddingBottom: 42
  },
  mobileHero: {
    flexDirection: 'column',
    gap: 24,
    paddingTop: 30,
    paddingBottom: 25
  },
  heroText: {
    flex: 1
  },
  title: {
    fontSize: 62,
    lineHeight: 64,
    marginTop: 19,
    letterSpacing: -1.5
  },
  mobileTitle: {
    fontSize: 45,
    lineHeight: 46,
    textAlign: 'center',
    marginTop: 14,
    letterSpacing: -1
  },
  description: {
    maxWidth: 360,
    marginTop: 20,
    lineHeight: 24,
    fontSize: 14
  },
  actions: {
    alignItems: 'flex-start',
    gap: 17,
    marginTop: 28
  },
  makeLink: {
    minHeight: 32,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10
  },
  makeText: {
    fontSize: 12,
    color: colors.green
  },
  note: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 22
  },
  noteText: {
    fontSize: 10,
    color: colors.muted
  },
  artFrame: {
    width: '48%',
    borderWidth: 1,
    borderColor: '#B6B59E',
    padding: 7,
    borderTopLeftRadius: 170,
    borderTopRightRadius: 170,
    backgroundColor: '#EDE7D6'
  },
  mobileArt: {
    width: '100%',
    maxWidth: 430,
    borderTopLeftRadius: 120,
    borderTopRightRadius: 120
  },
  innerFrame: {
    borderTopLeftRadius: 165,
    borderTopRightRadius: 165,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#B6B59E'
  },
  art: {
    width: '100%',
    aspectRatio: 1.24
  },
  artCaption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 9,
    alignItems: 'center'
  },
  captionText: {
    fontFamily: serif,
    fontSize: 16,
    fontStyle: 'italic',
    color: '#696A50'
  },
  mobileActions: {
    width: '100%',
    gap: 9,
    marginTop: -4
  },
  values: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.line,
    flexDirection: 'row',
    paddingVertical: 22
  },
  value: {
    flex: 1,
    flexDirection: 'row',
    gap: 13,
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap'
  },
  valueBorder: {
    borderLeftWidth: 1,
    borderColor: colors.line
  },
  valueTitle: {
    fontFamily: serif,
    fontSize: 20,
    color: colors.ink
  },
  valueDetail: {
    fontSize: 10,
    color: colors.muted,
    marginTop: 4
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 34,
    marginBottom: 21
  },
  browse: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    padding: 10
  },
  cards: {
    flexDirection: 'row',
    gap: 24
  },
  invitation: {
    alignItems: 'center'
  }
});
