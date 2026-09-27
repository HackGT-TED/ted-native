import { router } from 'expo-router';
import { Button } from '../ui';
import { useStudio } from '../../context/studio';
import { useReadingLink } from '../../hooks/use-reading-link';

/** In Create, returns to reading the written story this story's read-along clips came from. */
export function ContinueReading({ disabled = false }: { disabled?: boolean }) {
  const { session, storyId } = useStudio();
  const { link } = useReadingLink(session?.user.id ?? null, 'project', storyId);
  if (!link) return null;
  return <Button secondary icon="mic" className="mt-4" disabled={disabled}
    title={link.position >= 0 ? 'Continue reading along' : 'Read along'}
    onPress={() => router.push({ pathname: '/read-along/[slug]', params: { slug: link.storyId } })} />;
}
