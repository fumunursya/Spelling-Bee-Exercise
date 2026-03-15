import fs from 'node:fs';
import path from 'node:path';

const sourceDir = path.resolve(
  process.cwd(),
  '..',
  'member-app',
  'app',
  'skill',
  'vocabulary',
  'topic',
  'data',
  'words',
);

const bankDir = path.resolve(process.cwd(), 'data', 'spellingBank');
const alphaOnly = /^[A-Za-z]+$/;
const captureSingleQuoted = (text, regex) =>
  [...text.matchAll(regex)].map((m) => m[1].replace(/\\'/g, "'").trim());

const files = fs
  .readdirSync(sourceDir)
  .filter((file) => file.endsWith('.ts') && file !== 'index.ts');

const items = [];

for (const file of files) {
  const topicId = file.replace(/\.ts$/, '');
  const raw = fs.readFileSync(path.join(sourceDir, file), 'utf8');

  if (file === 'body-parts.ts') {
    const seedBlockMatch = raw.match(/const BODY_PART_SEEDS:[\s\S]*?\];/);
    const seedBlock = seedBlockMatch ? seedBlockMatch[0] : raw;
    const words = captureSingleQuoted(seedBlock, /word:\s*'((?:\\'|[^'])*)'/g);
    const meanings = captureSingleQuoted(seedBlock, /meaningId:\s*'((?:\\'|[^'])*)'/g);
    const examples = captureSingleQuoted(seedBlock, /exampleEn:\s*'((?:\\'|[^'])*)'/g);
    const count = Math.min(words.length, meanings.length, examples.length);

    for (let i = 0; i < count; i += 1) {
      const word = words[i].trim();
      if (!alphaOnly.test(word)) continue;

      items.push({
        id: `body-parts-w${String(i + 1).padStart(2, '0')}`,
        word,
        meaning: meanings[i],
        topicId: 'body-parts',
      });
    }

    continue;
  }

  const ids = captureSingleQuoted(raw, /id:\s*'((?:\\'|[^'])*)'/g);
  const words = captureSingleQuoted(raw, /word:\s*'((?:\\'|[^'])*)'/g);
  const meanings = captureSingleQuoted(raw, /meaningId:\s*'((?:\\'|[^'])*)'/g);
  const topics = captureSingleQuoted(raw, /topicId:\s*'((?:\\'|[^'])*)'/g);
  const examples = captureSingleQuoted(raw, /exampleEn:\s*'((?:\\'|[^'])*)'/g);
  const count = Math.min(ids.length, words.length, meanings.length, examples.length);

  for (let i = 0; i < count; i += 1) {
    const word = words[i].trim();
    if (!alphaOnly.test(word)) continue;

    items.push({
      id: ids[i] ?? `${topicId}-w${String(i + 1).padStart(2, '0')}`,
      word,
      meaning: meanings[i],
      topicId: topics[i] ?? topicId,
    });
  }
}

const byTopic = items.reduce((acc, item) => {
  const topic = item.topicId ?? 'misc';
  acc[topic] ??= [];
  acc[topic].push(item);
  return acc;
}, {});

const topics = Object.keys(byTopic).sort((a, b) => a.localeCompare(b));
const toImportName = (topic) => {
  const camel = topic
    .replace(/[^a-zA-Z0-9]+(.)/g, (_, c) => c.toUpperCase())
    .replace(/[^a-zA-Z0-9]/g, '');
  const safe = camel ? camel[0].toUpperCase() + camel.slice(1) : 'Topic';
  return `topic${safe}`;
};

fs.mkdirSync(bankDir, { recursive: true });

const typeOutput = `export type SpellingItem = {\n  id: string;\n  word: string;\n  meaning: string;\n  topicId?: string;\n};\n`;
fs.writeFileSync(path.join(bankDir, 'types.ts'), typeOutput);

for (const topic of topics) {
  const fileContent = `import type { SpellingItem } from './types';\n\nconst items: SpellingItem[] = ${JSON.stringify(
    byTopic[topic],
    null,
    2,
  )};\n\nexport default items;\n`;
  fs.writeFileSync(path.join(bankDir, `${topic}.ts`), fileContent);
}

const counts = Object.fromEntries(
  topics.map((topic) => [topic, byTopic[topic].length]),
);
const metaOutput = `export const SPELLING_TOPICS = ${JSON.stringify(topics, null, 2)} as const;\n\nexport const SPELLING_BANK_COUNTS: Record<string, number> = ${JSON.stringify(
  counts,
  null,
  2,
)};\n\nexport const SPELLING_BANK_TOTAL = Object.values(SPELLING_BANK_COUNTS).reduce((sum, count) => sum + count, 0);\n`;
fs.writeFileSync(path.join(bankDir, 'meta.ts'), metaOutput);

const loaderImports = topics
  .map((topic) => `const ${toImportName(topic)} = () => import('./${topic}');`)
  .join('\n');
const loaderMappings = topics
  .map((topic) => `  '${topic}': ${toImportName(topic)},`)
  .join('\n');
const loadersOutput = `import type { SpellingItem } from './types';\n\nexport type SpellingBankLoader = () => Promise<{ default: SpellingItem[] }>;\n\n${loaderImports}\n\nexport const SPELLING_BANK_LOADERS: Record<string, SpellingBankLoader> = {\n${loaderMappings}\n};\n`;
fs.writeFileSync(path.join(bankDir, 'loaders.ts'), loadersOutput);

const indexOutput = `export type { SpellingItem } from './types';\nexport { SPELLING_TOPICS, SPELLING_BANK_COUNTS, SPELLING_BANK_TOTAL } from './meta';\nexport { SPELLING_BANK_LOADERS, type SpellingBankLoader } from './loaders';\n`;
fs.writeFileSync(path.join(bankDir, 'index.ts'), indexOutput);
console.log(`Generated ${items.length} spelling items.`);
