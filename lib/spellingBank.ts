import type { SpellingItem } from '../types/quiz';
import {
  SPELLING_BANK_COUNTS,
  SPELLING_BANK_LOADERS,
  SPELLING_BANK_TOTAL,
  SPELLING_TOPICS,
} from '../data/spellingBank';

export const getTopicCount = (topicId: string): number =>
  SPELLING_BANK_COUNTS[topicId] ?? 0;

export const getTotalCount = (): number => SPELLING_BANK_TOTAL;

export const getTopicList = (): readonly string[] => SPELLING_TOPICS;

const topicCache = new Map<string, SpellingItem[]>();
let allCache: SpellingItem[] | null = null;
const topicIdCache = new WeakMap<SpellingItem[], string[]>();

export const getTopicIdsFromBank = (bank: SpellingItem[]): string[] => {
  const cached = topicIdCache.get(bank);
  if (cached) return cached;

  const topics = Array.from(
    new Set(bank.map((item) => item.topicId).filter((value): value is string => !!value)),
  );
  topicIdCache.set(bank, topics);
  return topics;
};

const canUseStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

const getStorageKey = (topicId: string): string => `sbe_bank_${topicId}`;

const isBankArray = (value: unknown): value is SpellingItem[] =>
  Array.isArray(value) &&
  value.every(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as SpellingItem).id === 'string' &&
      typeof (item as SpellingItem).word === 'string' &&
      typeof (item as SpellingItem).meaning === 'string',
  );

const readFromStorage = (topicId: string): SpellingItem[] | null => {
  if (!canUseStorage()) return null;
  const raw = sessionStorage.getItem(getStorageKey(topicId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return isBankArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const writeToStorage = (topicId: string, items: SpellingItem[]): void => {
  if (!canUseStorage()) return;
  try {
    sessionStorage.setItem(getStorageKey(topicId), JSON.stringify(items));
  } catch {
    // Ignore storage quota errors.
  }
};

const loadTopic = async (topicId: string): Promise<SpellingItem[]> => {
  const cached = topicCache.get(topicId);
  if (cached) return cached;

  const stored = readFromStorage(topicId);
  if (stored) {
    topicCache.set(topicId, stored);
    return stored;
  }

  const loader = SPELLING_BANK_LOADERS[topicId];
  if (!loader) return [];
  const mod = await loader();
  const items = mod.default as SpellingItem[];
  topicCache.set(topicId, items);
  writeToStorage(topicId, items);
  return items;
};

export const loadSpellingBank = async (topicId: string): Promise<SpellingItem[]> => {
  if (topicId === 'all') {
    if (allCache) return allCache;
    const storedAll = readFromStorage('all');
    if (storedAll) {
      allCache = storedAll;
      return storedAll;
    }
    const results = await Promise.all(SPELLING_TOPICS.map(loadTopic));
    allCache = results.flat();
    writeToStorage('all', allCache);
    return allCache;
  }
  return loadTopic(topicId);
};
