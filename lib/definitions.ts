import type { WordDefinition } from '../data/definitions';
import { DEFINITION_LOADERS, DEFINITION_TOPICS } from '../data/definitions';

const canUseStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const getStorageKey = (topicId: string): string => `sbe_def_${topicId}`;

const isDefinitionArray = (value: unknown): value is WordDefinition[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as WordDefinition).id === 'string' &&
      typeof (item as WordDefinition).definitionEn === 'string' &&
      typeof (item as WordDefinition).definitionId === 'string',
  );

const readFromStorage = (topicId: string): WordDefinition[] | null => {
  if (!canUseStorage()) return null;
  const raw = localStorage.getItem(getStorageKey(topicId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isDefinitionArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeToStorage = (topicId: string, items: WordDefinition[]): void => {
  if (!canUseStorage()) return;
  try {
    localStorage.setItem(getStorageKey(topicId), JSON.stringify(items));
  } catch {
    // Ignore storage quota errors.
  }
};

const topicCache = new Map<string, WordDefinition[]>();
let allCache: WordDefinition[] | null = null;

const loadTopic = async (topicId: string): Promise<WordDefinition[]> => {
  const cached = topicCache.get(topicId);
  if (cached) return cached;

  const stored = readFromStorage(topicId);
  if (stored) {
    topicCache.set(topicId, stored);
    return stored;
  }

  const loader = DEFINITION_LOADERS[topicId];
  if (!loader) return [];
  const mod = await loader();
  const items = mod.default as WordDefinition[];
  topicCache.set(topicId, items);
  writeToStorage(topicId, items);
  return items;
};

export const loadDefinitions = async (topicId: string): Promise<WordDefinition[]> => {
  if (topicId === 'all') {
    if (allCache) return allCache;
    const storedAll = readFromStorage('all');
    if (storedAll) {
      allCache = storedAll;
      return storedAll;
    }
    const results = await Promise.all(DEFINITION_TOPICS.map(loadTopic));
    allCache = results.flat();
    writeToStorage('all', allCache);
    return allCache;
  }
  return loadTopic(topicId);
};

export const loadDefinitionsForTopics = async (
  topicIds: string[],
): Promise<WordDefinition[]> => {
  const uniqueTopics = Array.from(new Set(topicIds.filter(Boolean)));
  if (uniqueTopics.length === 0) return [];
  if (uniqueTopics.length === DEFINITION_TOPICS.length) {
    return loadDefinitions('all');
  }
  const results = await Promise.all(uniqueTopics.map(loadTopic));
  return results.flat();
};
