import type { ImageSourcePropType } from 'react-native';

/**
 * Covers for Written Stories, bundled with the app (public-domain illustrations;
 * credits are in each story's cover_credit). Keyed by written_stories.slug.
 */
export const storyCovers: Record<string, ImageSourcePropType> = {
  'the-three-little-pigs': require('../../assets/stories/the-three-little-pigs.jpg'),
  'the-tortoise-and-the-hare': require('../../assets/stories/the-tortoise-and-the-hare.jpg'),
  'the-ugly-duckling': require('../../assets/stories/the-ugly-duckling.jpg'),
  'the-elves-and-the-shoemaker': require('../../assets/stories/the-elves-and-the-shoemaker.jpg'),
  'the-velveteen-rabbit': require('../../assets/stories/the-velveteen-rabbit.jpg'),
  'the-tale-of-peter-rabbit': require('../../assets/stories/the-tale-of-peter-rabbit.jpg'),
  'rikki-tikki-tavi': require('../../assets/stories/rikki-tikki-tavi.jpg'),
  'the-little-gingerbread-man': require('../../assets/stories/the-little-gingerbread-man.jpg'),
  'jack-and-the-beanstalk': require('../../assets/stories/jack-and-the-beanstalk.jpg'),
  'little-red-riding-hood': require('../../assets/stories/little-red-riding-hood.jpg'),
};
