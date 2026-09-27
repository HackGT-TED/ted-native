import { useEffect, useState } from 'react';
import { onReadingLinksChange, readingForProject, readingForStory, type ReadingLink } from '../services/reading-links';

/**
 * The read-along link for a written story (`by: 'story'`) or a Create project
 * (`by: 'project'`), kept current when any screen saves a link.
 */
export function useReadingLink(userId: string | null, by: 'story' | 'project', id: string | null) {
  const key = userId && id ? `${userId}:${by}:${id}` : null;
  const [state, setState] = useState<{ key: string; link: ReadingLink | null } | null>(null);
  const [version, setVersion] = useState(0);
  useEffect(() => onReadingLinksChange(() => setVersion(value => value + 1)), []);
  useEffect(() => {
    if (!key || !userId || !id) return;
    let live = true;
    (by === 'story' ? readingForStory(userId, id) : readingForProject(userId, id))
      .catch(() => null)
      .then(link => { if (live) setState({ key, link }); });
    return () => { live = false; };
  }, [by, id, key, userId, version]);
  const current = state?.key === key ? state : null;
  return { link: current?.link ?? null, loading: Boolean(key) && !current };
}
