import { useEffect, useRef } from 'react';
import { saveReadingLink } from '../services/reading-links';
import type { RecordingSegment } from '../types/recording';
import type { Story } from '../types/story';
import { useReadingLink } from './use-reading-link';

type Timeline = { segments: RecordingSegment[]; ready: boolean; loading: boolean; syncPending: boolean; error: string };
type Stories = {
  items: Story[]; saving: boolean;
  save: (projectId: string | null, title: string, publish: boolean, segmentIds: string[]) => Promise<Story>;
};

/**
 * Keeps read-along stories saved to the account. When the open story holds read-along
 * clips and they have all uploaded, it's saved as a draft under its name, so it shows
 * with its title on Home and in Library without a manual save. Published stories are
 * left for Create to update, since saving a draft would unpublish them.
 */
export function useReadingAutoSave(userId: string | null, projectId: string | null, timeline: Timeline,
  stories: Stories, draftName: string) {
  const { link } = useReadingLink(userId, 'project', projectId);
  const saving = useRef(false);
  const ids = timeline.segments.map(segment => segment.id);
  const joined = ids.join(',');
  const published = stories.items.some(item => item.creation_session_id === projectId && item.status === 'published');
  const settled = timeline.ready && !timeline.loading && !timeline.syncPending && !timeline.error && !stories.saving;
  const { save } = stories;

  useEffect(() => {
    if (!userId || !projectId || !link || !joined || published || !settled || saving.current) return;
    if (link.savedSegments === joined) return;
    saving.current = true;
    save(projectId, draftName.trim() || link.title, false, joined.split(','))
      .then(() => saveReadingLink(userId, { ...link, savedSegments: joined }))
      .catch(() => { /* Retried when the clips or sync state next change. */ })
      .finally(() => { saving.current = false; });
  }, [draftName, joined, link, projectId, published, save, settled, userId]);
}
