import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Ties a written story (Explore) to the story whose clips hold its read-along takes,
 * so every take of one written story lands in the same story, in Create's timeline.
 */
export type ReadingLink = {
  /** The written story's id. */
  storyId: string;
  /** The Create project (creation session) holding the clips. */
  projectId: string;
  /** The written story's title, used to name the story. */
  title: string;
  /** Index of the last word read, to resume from; -1 to start at the beginning. */
  position: number;
  /** Clip ids (in order) last saved to the account, so unchanged stories aren't re-saved. */
  savedSegments?: string;
};

const prefix = (userId: string) => `tedtime.read-along.v1.${userId}`;
const storyKey = (userId: string, storyId: string) => `${prefix(userId)}.story.${storyId}`;
const projectKey = (userId: string, projectId: string) => `${prefix(userId)}.project.${projectId}`;
const listeners = new Set<() => void>();

async function load(key: string): Promise<ReadingLink | null> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return null;
  try {
    const link = JSON.parse(raw) as ReadingLink;
    return typeof link.projectId === 'string' && typeof link.storyId === 'string' ? link : null;
  } catch {
    return null;
  }
}

export const readingForStory = (userId: string, storyId: string) => load(storyKey(userId, storyId));
export const readingForProject = (userId: string, projectId: string) => load(projectKey(userId, projectId));

/** Stores the link under both ids and tells mounted readers to reload. */
export async function saveReadingLink(userId: string, link: ReadingLink) {
  const value = JSON.stringify(link);
  await AsyncStorage.multiSet([[storyKey(userId, link.storyId), value], [projectKey(userId, link.projectId), value]]);
  for (const listener of listeners) listener();
}

export function onReadingLinksChange(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
