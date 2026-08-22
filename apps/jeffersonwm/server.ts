import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import mysql from 'mysql2/promise';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createProjectActivityService } from './projectActivity.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envFile = process.env.JEFFERSONWM_ENV_FILE || (process.env.NODE_ENV === 'production' ? '.env.production' : '.env.development');

dotenv.config({ path: path.join(__dirname, envFile) });
dotenv.config();

const app = express();
const port = Number(process.env.JEFFERSONWM_PORT || process.env.PORT || 3000);
const allowedOrigins = (process.env.JEFFERSONWM_ALLOWED_ORIGIN || 'http://localhost:5173')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);
const adminToken = process.env.JEFFERSONWM_WIDGET_ADMIN_TOKEN || '';
const geoapifyApiKey = process.env.GEOAPIFY_API_KEY || '';
const authBaseUrl = (process.env.JEFFERSONWM_AUTH_BASE_URL || 'https://auth.jeffersonwm.com').replace(/\/$/, '');
const projectActivityService = createProjectActivityService(process.env);

type WidgetFont = {
  id?: number;
  name: string;
  weight?: number;
  probability?: number;
};

type WidgetEvent = {
  id?: number;
  name: string;
  description?: string | null;
  date: string;
  end_date?: string | null;
  is_public?: number | boolean;
};

type UserWidgetPreference = {
  auth_user_id: string;
  display_name?: string | null;
  location_label?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  weather_unit?: string | null;
};

type LocationSuggestion = {
  label: string;
  city: string;
  region: string;
  country: string;
  countryCode: string;
  latitude: number;
  longitude: number;
  weatherUnit: 'fahrenheit' | 'celsius';
};

type WidgetProviderType = 'scrape' | 'rss' | 'api' | 'photo';

type WidgetWordSourceKey =
  | 'dictionary'
  | 'merriam'
  | 'wiktionary'
  | 'vocabulary'
  | 'datamuse'
  | 'loc'
  | 'ols4'
  | 'mesh'
  | 'pubchem'
  | 'musicbrainz'
  | 'sportsdb'
  | 'mealdb'
  | 'tvmaze'
  | 'gbif'
  | 'nasaApod'
  | 'wikipediaPotd';

type WidgetWords = Record<WidgetWordSourceKey, string>;

type WidgetWordSource = {
  key: WidgetWordSourceKey;
  label: string;
  word: string | null;
  display: string;
  href: string;
  fallbackHref: string;
  providerType: WidgetProviderType;
  ok: boolean;
  fallback: boolean;
  note: string;
  checkedAt: string;
};

type WidgetWordsPayload = {
  pacificDateKey: string;
  generatedAt: string;
  sources: WidgetWordSource[];
  words: WidgetWords;
};

type AuthStatusUser = {
  id?: string;
  username?: string;
  displayName?: string | null;
  memberships?: string[];
  isAdmin?: boolean;
  isOwner?: boolean;
  isApproved?: boolean;
  isBlocked?: boolean;
  isDeleted?: boolean;
};

const fallbackFonts: WidgetFont[] = [
  { name: 'IBM Plex Sans Condensed', weight: 2, probability: 3 },
  { name: 'Newsreader', weight: 2, probability: 2 },
  { name: 'Gelasio', weight: 2, probability: 1 },
];

const fallbackWords: WidgetWords = {
  dictionary: 'Dictionary.com',
  merriam: 'Merriam-Webster',
  wiktionary: 'Wiktionary',
  vocabulary: 'Vocabulary.com',
  datamuse: 'Datamuse',
  loc: 'Library of Congress',
  ols4: 'OLS4',
  mesh: 'MeSH',
  pubchem: 'PubChem',
  musicbrainz: 'MusicBrainz',
  sportsdb: 'TheSportsDB',
  mealdb: 'TheMealDB',
  tvmaze: 'TVMaze',
  gbif: 'GBIF',
  nasaApod: 'NASA APOD',
  wikipediaPotd: 'Wikipedia POTD',
};

const widgetWordSourceDefinitions = {
  dictionary: {
    label: 'Dictionary.com',
    fallbackHref: 'https://www.dictionary.com/word-of-the-day',
    providerType: 'scrape',
    hrefForWord: (word: string) => `https://www.dictionary.com/browse/${encodeURIComponent(word)}`,
  },
  merriam: {
    label: 'Merriam-Webster',
    fallbackHref: 'https://www.merriam-webster.com/word-of-the-day',
    providerType: 'rss',
    hrefForWord: (word: string) => `https://www.merriam-webster.com/dictionary/${encodeURIComponent(word)}`,
  },
  wiktionary: {
    label: 'Wiktionary',
    fallbackHref: 'https://en.wiktionary.org/wiki/Wiktionary:Word_of_the_day',
    providerType: 'rss',
    hrefForWord: (word: string) => `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`,
  },
  vocabulary: {
    label: 'Vocabulary.com',
    fallbackHref: 'https://www.vocabulary.com/word-of-the-day/',
    providerType: 'scrape',
    hrefForWord: (word: string) => `https://www.vocabulary.com/dictionary/${encodeURIComponent(word)}`,
  },
  // Paused extra daily-discovery sources. Keep commented for easy re-enable later.
  /*
  label: string;
  fallbackHref: string;
  providerType: WidgetProviderType;
  hrefForWord?: (word: string) => string;
  datamuse: {
    label: 'Datamuse',
    fallbackHref: 'https://www.datamuse.com/',
    providerType: 'api',
    hrefForWord: word => `https://en.wiktionary.org/wiki/${encodeURIComponent(word)}`,
  },
  loc: {
    label: 'Library of Congress',
    fallbackHref: 'https://id.loc.gov/authorities/subjects.html',
    providerType: 'api',
  },
  ols4: {
    label: 'OLS4',
    fallbackHref: 'https://www.ebi.ac.uk/ols4/',
    providerType: 'api',
    hrefForWord: word => `https://www.ebi.ac.uk/ols4/api/search?q=${encodeURIComponent(word)}`,
  },
  mesh: {
    label: 'MeSH',
    fallbackHref: 'https://id.nlm.nih.gov/mesh/',
    providerType: 'api',
  },
  pubchem: {
    label: 'PubChem',
    fallbackHref: 'https://pubchem.ncbi.nlm.nih.gov/',
    providerType: 'api',
    hrefForWord: word => `https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(word)}`,
  },
  musicbrainz: {
    label: 'MusicBrainz',
    fallbackHref: 'https://musicbrainz.org/genres',
    providerType: 'api',
    hrefForWord: word => `https://musicbrainz.org/search?query=${encodeURIComponent(word)}&type=tag&method=indexed`,
  },
  sportsdb: {
    label: 'TheSportsDB',
    fallbackHref: 'https://www.thesportsdb.com/',
    providerType: 'api',
    hrefForWord: word => `https://en.wikipedia.org/wiki/Special:Search?search=${encodeURIComponent(word)}`,
  },
  mealdb: {
    label: 'TheMealDB',
    fallbackHref: 'https://www.themealdb.com/',
    providerType: 'api',
    hrefForWord: word => `https://www.themealdb.com/browse.php?c=${encodeURIComponent(word)}`,
  },
  tvmaze: {
    label: 'TVMaze',
    fallbackHref: 'https://www.tvmaze.com/',
    providerType: 'api',
    hrefForWord: word => `https://www.tvmaze.com/search?q=${encodeURIComponent(word)}`,
  },
  gbif: {
    label: 'GBIF',
    fallbackHref: 'https://www.gbif.org/species/search',
    providerType: 'api',
    hrefForWord: word => `https://www.gbif.org/species/search?q=${encodeURIComponent(word)}`,
  },
  nasaApod: {
    label: 'NASA APOD',
    fallbackHref: 'https://apod.nasa.gov/apod/astropix.html',
    providerType: 'photo',
  },
  wikipediaPotd: {
    label: 'Wikipedia POTD',
    fallbackHref: 'https://api.wikimedia.org/feed/v1/wikipedia/en/featured',
    providerType: 'photo',
  },
  */
} satisfies Partial<Record<WidgetWordSourceKey, {
  label: string;
  fallbackHref: string;
  providerType: WidgetProviderType;
  hrefForWord?: (word: string) => string;
}>>;

type ActiveWidgetWordSourceKey = keyof typeof widgetWordSourceDefinitions;

type WidgetSourceHealth = {
  ok: boolean;
  note: string;
  word: string | null;
  href?: string | null;
};

type WidgetSourceFetchContext = {
  pacificDateKey: string;
  checkedAt: string;
  fetchOptions: RequestInit;
};

const widgetWordSourceKeys = Object.keys(widgetWordSourceDefinitions) as ActiveWidgetWordSourceKey[];

const generalThemeSeeds = [
  'astronomy',
  'botany',
  'cinema',
  'design',
  'ecology',
  'geometry',
  'history',
  'language',
  'music',
  'ocean',
  'poetry',
  'weather',
  'architecture',
  'biology',
  'mythology',
  'photography',
  'physics',
  'chemistry',
  'cartography',
  'typography',
  'zoology',
  'folklore',
  'jazz',
  'mineralogy',
  'rivers',
  'fungi',
  'ritual',
  'theater',
  'memory',
  'dance',
  'orchid',
  'beetle',
  'cedar',
  'coral',
  'tide',
  'desert',
];

const mediaThemeSeeds = [
  'comedy',
  'crime',
  'documentary',
  'fantasy',
  'history',
  'horror',
  'music',
  'mystery',
  'nature',
  'romance',
  'science',
  'sports',
  'travel',
  'western',
  'anime',
  'architecture',
  'cooking',
  'myth',
];

const biologyThemeSeeds = [
  'oak',
  'fern',
  'moss',
  'iris',
  'orchid',
  'cedar',
  'maple',
  'lichen',
  'coral',
  'beetle',
  'heron',
  'sparrow',
  'willow',
  'kelp',
  'cactus',
  'fox',
  'whale',
  'gull',
];

const scienceThemeSeeds = [
  'biology',
  'ecology',
  'genetics',
  'immunology',
  'metabolism',
  'microbiology',
  'neurology',
  'pharmacology',
  'toxicology',
  'zoology',
  'botany',
  'evolution',
  'anatomy',
  'pathology',
];

const chemistryThemeSeeds = [
  'water',
  'glucose',
  'caffeine',
  'ethanol',
  'citric',
  'sodium',
  'calcium',
  'nitrogen',
  'oxygen',
  'sulfur',
  'carbon',
  'acetone',
  'lactate',
  'iodine',
];

function hashString(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function normaliseSourceText(value: unknown) {
  return String(value ?? '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, '\'')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSingleWordCandidate(value: string) {
  return /^[A-Za-z0-9][A-Za-z0-9'’.-]*$/.test(value);
}

function pickDeterministicItem<T>(items: T[], pacificDateKey: string, key: string) {
  if (!items.length) {
    return null;
  }
  return items[hashString(`${pacificDateKey}:${key}`) % items.length];
}

function pickDailySeed(seeds: string[], pacificDateKey: string, key: string) {
  return seeds[hashString(`${pacificDateKey}:${key}:seed`) % seeds.length];
}

function buildDefaultSourceHealth(note = 'Using fallback label until today\'s item is resolved.') {
  return Object.fromEntries(widgetWordSourceKeys.map((key) => [
    key,
    {
      ok: false,
      note,
      word: null,
      href: null,
    } satisfies WidgetSourceHealth,
  ])) as Record<ActiveWidgetWordSourceKey, WidgetSourceHealth>;
}

function buildSourcePayload(
  key: ActiveWidgetWordSourceKey,
  health: WidgetSourceHealth,
  checkedAt: string,
) {
  const source = widgetWordSourceDefinitions[key];
  return {
    key,
    label: source.label,
    word: health.word,
    display: health.word || source.label,
    href: health.href || (health.word && source.hrefForWord ? source.hrefForWord(health.word) : source.fallbackHref),
    fallbackHref: source.fallbackHref,
    providerType: source.providerType,
    ok: health.ok,
    fallback: !health.ok,
    note: health.note,
    checkedAt,
  };
}

async function fetchDictionarySource({ fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  try {
    const response = await fetch('https://www.dictionary.com/e/word-of-the-day/', fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    const match =
      html.match(/"headword":"(.*?)"/i) ||
      html.match(/<a class="wotd-entry-headword"[^>]*>(.*?)<\/a>/i) ||
      html.match(/<div class="otd-item-headword__word">[\s\S]*?<h1>(.*?)<\/h1>/i) ||
      html.match(/<title>Word of the Day: (.*?) \| Dictionary\.com<\/title>/i);

    if (!match?.[1]) {
      return {
        ok: false,
        note: 'Dictionary.com responded, but no daily headword matched the current parser.',
        word: null,
      };
    }

    const word = normaliseSourceText(match[1]);
    return {
      ok: true,
      note: 'Live word loaded from the public Dictionary.com word-of-the-day page.',
      word,
    };
  } catch (error) {
    console.error('Dictionary WOTD fetch failed:', error);
    return {
      ok: false,
      note: 'Dictionary.com request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchMerriamSource({ fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  try {
    const response = await fetch('https://www.merriam-webster.com/wotd/feed/rss2', fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();
    const match = xml.match(/<item>[\s\S]*?<title>(?:Word of the Day: )?(.*?)<\/title>/i);

    if (!match?.[1]) {
      return {
        ok: false,
        note: 'Merriam-Webster responded, but no RSS title matched the current parser.',
        word: null,
      };
    }

    const word = normaliseSourceText(match[1].replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1'));
    return {
      ok: true,
      note: 'Live word loaded from Merriam-Webster RSS.',
      word,
    };
  } catch (error) {
    console.error('Merriam WOTD fetch failed:', error);
    return {
      ok: false,
      note: 'Merriam-Webster request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchWiktionarySource({ fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  try {
    const response = await fetch('https://en.wiktionary.org/w/api.php?action=featuredfeed&feed=wotd&format=xml', fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const xml = await response.text();
    const items = xml.split('<item>');
    const lastItem = items[items.length - 1] || xml;
    const match =
      lastItem.match(/id=&quot;WOTD-rss-title&quot;&gt;(.*?)&lt;\/span&gt;/i) ||
      lastItem.match(/id="WOTD-rss-title">(.*?)<\/span>/i) ||
      lastItem.match(/<title>(?:Word of the day for .*: )?(.*?)<\/title>/i);

    if (!match?.[1]) {
      return {
        ok: false,
        note: 'Wiktionary responded, but no featured-feed title matched the current parser.',
        word: null,
      };
    }

    return {
      ok: true,
      note: 'Live word loaded from the Wiktionary featured feed.',
      word: normaliseSourceText(match[1]),
    };
  } catch (error) {
    console.error('Wiktionary WOTD fetch failed:', error);
    return {
      ok: false,
      note: 'Wiktionary request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchVocabularySource({ fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  try {
    const response = await fetch('https://www.vocabulary.com/word-of-the-day/', fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const html = await response.text();
    const match =
      html.match(/<title>Word of the day:\s*(.*?)\s*\|\s*Vocabulary\.com<\/title>/i) ||
      html.match(/aria-label="dictionary page for today's word of the day - (.*?)"/i) ||
      html.match(/class="word-of-the-day"[^>]*>\s*(.*?)\s*</i);

    if (!match?.[1]) {
      return {
        ok: false,
        note: 'Vocabulary.com responded, but no daily headword matched the current parser.',
        word: null,
      };
    }

    return {
      ok: true,
      note: 'Live word loaded from the public Vocabulary.com word-of-the-day page.',
      word: normaliseSourceText(match[1]),
    };
  } catch (error) {
    console.error('Vocabulary WOTD fetch failed:', error);
    return {
      ok: false,
      note: 'Vocabulary.com request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchDatamuseSource({ pacificDateKey, fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  const seed = pickDailySeed(generalThemeSeeds, pacificDateKey, 'datamuse');
  try {
    const response = await fetch(`https://api.datamuse.com/words?rel_trg=${encodeURIComponent(seed)}&max=40`, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json() as Array<{ word?: string }>;
    const candidates = payload
      .map((entry) => normaliseSourceText(entry.word))
      .filter((word) => isSingleWordCandidate(word) && word.toLowerCase() !== seed.toLowerCase());
    const word = pickDeterministicItem(candidates, pacificDateKey, 'datamuse');

    if (!word) {
      return {
        ok: false,
        note: `Datamuse responded for seed "${seed}", but no clean single-word term was available.`,
        word: null,
      };
    }

    return {
      ok: true,
      note: `Daily related term selected from Datamuse using the Pacific-day theme "${seed}".`,
      word,
    };
  } catch (error) {
    console.error('Datamuse term fetch failed:', error);
    return {
      ok: false,
      note: 'Datamuse request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchLocSource({ pacificDateKey, fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  const seed = pickDailySeed(generalThemeSeeds, pacificDateKey, 'loc');
  try {
    const response = await fetch(`https://id.loc.gov/authorities/subjects/suggest/?q=${encodeURIComponent(seed)}`, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json() as [string, string[], string[], string[]];
    const labels = Array.isArray(payload?.[1]) ? payload[1] : [];
    const hrefs = Array.isArray(payload?.[3]) ? payload[3] : [];
    const candidates = labels
      .map((label, index) => ({
        word: normaliseSourceText(label),
        href: normaliseSourceText(hrefs[index]),
      }))
      .filter((entry) => isSingleWordCandidate(entry.word) && entry.href);
    const choice = pickDeterministicItem(candidates, pacificDateKey, 'loc');

    if (!choice) {
      return {
        ok: false,
        note: `Library of Congress responded for seed "${seed}", but no single-word subject heading fit the widget.`,
        word: null,
      };
    }

    return {
      ok: true,
      note: `Library of Congress subject heading selected from the Pacific-day theme "${seed}".`,
      word: choice.word,
      href: choice.href,
    };
  } catch (error) {
    console.error('Library of Congress term fetch failed:', error);
    return {
      ok: false,
      note: 'Library of Congress request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchOls4Source({ pacificDateKey, fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  const seed = pickDailySeed(scienceThemeSeeds, pacificDateKey, 'ols4');
  try {
    const response = await fetch(`https://www.ebi.ac.uk/ols4/api/search?q=${encodeURIComponent(seed)}&rows=25`, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json() as {
      response?: {
        docs?: Array<{ label?: string; iri?: string; ontology_prefix?: string; ontology_name?: string }>;
      };
    };
    const candidates = (payload.response?.docs || [])
      .map((entry) => ({
        word: normaliseSourceText(entry.label),
        href: normaliseSourceText(entry.iri),
        source: normaliseSourceText(entry.ontology_prefix || entry.ontology_name),
      }))
      .filter((entry) => isSingleWordCandidate(entry.word) && entry.href);
    const choice = pickDeterministicItem(candidates, pacificDateKey, 'ols4');

    if (!choice) {
      return {
        ok: false,
        note: `OLS4 responded for seed "${seed}", but no clean single-word ontology term was available.`,
        word: null,
      };
    }

    return {
      ok: true,
      note: `Ontology term selected from OLS4 using the Pacific-day science theme "${seed}"${choice.source ? ` (${choice.source})` : ''}.`,
      word: choice.word,
      href: choice.href,
    };
  } catch (error) {
    console.error('OLS4 term fetch failed:', error);
    return {
      ok: false,
      note: 'OLS4 request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchMeshSource({ pacificDateKey, fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  const seed = pickDailySeed(scienceThemeSeeds, pacificDateKey, 'mesh');
  try {
    const response = await fetch(`https://id.nlm.nih.gov/mesh/lookup/term?label=${encodeURIComponent(seed)}&match=contains&limit=25`, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json() as Array<{ label?: string; resource?: string }>;
    const directCandidates = payload
      .map((entry) => ({
        word: normaliseSourceText(entry.label),
        href: normaliseSourceText(entry.resource),
      }))
      .filter((entry) => isSingleWordCandidate(entry.word) && entry.href);
    const derivedCandidates = payload
      .flatMap((entry) => {
        const href = normaliseSourceText(entry.resource);
        const label = normaliseSourceText(entry.label);
        if (!href || !label) {
          return [];
        }
        return label
          .split(/[;,()/]+/)
          .map((part) => normaliseSourceText(part))
          .filter(isSingleWordCandidate)
          .map((word) => ({ word, href }));
      });
    const candidates = Array.from(new Map([...directCandidates, ...derivedCandidates].map((entry) => [`${entry.word}|${entry.href}`, entry])).values());
    const choice = pickDeterministicItem(candidates, pacificDateKey, 'mesh');

    if (!choice) {
      return {
        ok: false,
        note: `MeSH responded for seed "${seed}", but no single-word descriptor fit the widget.`,
        word: null,
      };
    }

    return {
      ok: true,
      note: `Medical subject term selected from MeSH using the Pacific-day science theme "${seed}".`,
      word: choice.word,
      href: choice.href,
    };
  } catch (error) {
    console.error('MeSH term fetch failed:', error);
    return {
      ok: false,
      note: 'MeSH request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchPubChemSource({ pacificDateKey, fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  const seed = pickDailySeed(chemistryThemeSeeds, pacificDateKey, 'pubchem');
  try {
    const response = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/autocomplete/compound/${encodeURIComponent(seed)}/json?limit=25`, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json() as {
      dictionary_terms?: {
        compound?: string[];
      };
    };
    const candidates = (payload.dictionary_terms?.compound || [])
      .map((entry) => normaliseSourceText(entry))
      .filter((entry) => isSingleWordCandidate(entry) && entry.toLowerCase() !== seed.toLowerCase());
    const word = pickDeterministicItem(candidates, pacificDateKey, 'pubchem');

    if (!word) {
      return {
        ok: false,
        note: `PubChem responded for seed "${seed}", but no single-word compound name was available.`,
        word: null,
      };
    }

    return {
      ok: true,
      note: `Chemistry term selected from PubChem autocomplete using the Pacific-day chemistry seed "${seed}".`,
      word,
    };
  } catch (error) {
    console.error('PubChem term fetch failed:', error);
    return {
      ok: false,
      note: 'PubChem request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchMusicBrainzSource({ pacificDateKey, fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  try {
    const response = await fetch('https://musicbrainz.org/ws/2/genre/all?fmt=json&limit=200', {
      ...fetchOptions,
      headers: {
        ...(fetchOptions.headers || {}),
        'User-Agent': 'JeffersonWM/1.0 (wm@wmjefferson.com)',
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json() as { genres?: Array<{ id?: string; name?: string }> };
    const candidates = (payload.genres || [])
      .map((entry) => ({
        word: normaliseSourceText(entry.name),
        href: entry.id ? `https://musicbrainz.org/genre/${entry.id}` : '',
      }))
      .filter((entry) => isSingleWordCandidate(entry.word) && entry.href);
    const choice = pickDeterministicItem(candidates, pacificDateKey, 'musicbrainz');

    if (!choice) {
      return {
        ok: false,
        note: 'MusicBrainz responded, but no single-word genre was available from the public genre list.',
        word: null,
      };
    }

    return {
      ok: true,
      note: 'Music genre selected from the public MusicBrainz genre catalog.',
      word: choice.word,
      href: choice.href,
    };
  } catch (error) {
    console.error('MusicBrainz term fetch failed:', error);
    return {
      ok: false,
      note: 'MusicBrainz request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchSportsDbSource({ pacificDateKey, fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  try {
    const response = await fetch('https://www.thesportsdb.com/api/v1/json/3/all_sports.php', fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json() as { sports?: Array<{ strSport?: string }> };
    const candidates = (payload.sports || [])
      .map((entry) => normaliseSourceText(entry.strSport))
      .filter(isSingleWordCandidate);
    const word = pickDeterministicItem(candidates, pacificDateKey, 'sportsdb');

    if (!word) {
      return {
        ok: false,
        note: 'TheSportsDB responded, but no single-word sport label was available.',
        word: null,
      };
    }

    return {
      ok: true,
      note: 'Sport term selected from the public TheSportsDB catalog.',
      word,
    };
  } catch (error) {
    console.error('TheSportsDB term fetch failed:', error);
    return {
      ok: false,
      note: 'TheSportsDB request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchMealDbSource({ pacificDateKey, fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  try {
    const response = await fetch('https://www.themealdb.com/api/json/v1/1/list.php?c=list', fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json() as { meals?: Array<{ strCategory?: string }> };
    const candidates = (payload.meals || [])
      .map((entry) => normaliseSourceText(entry.strCategory))
      .filter(isSingleWordCandidate);
    const word = pickDeterministicItem(candidates, pacificDateKey, 'mealdb');

    if (!word) {
      return {
        ok: false,
        note: 'TheMealDB responded, but no single-word category was available.',
        word: null,
      };
    }

    return {
      ok: true,
      note: 'Culinary term selected from TheMealDB category list.',
      word,
    };
  } catch (error) {
    console.error('TheMealDB term fetch failed:', error);
    return {
      ok: false,
      note: 'TheMealDB request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchTvMazeSource({ pacificDateKey, fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  const seed = pickDailySeed(mediaThemeSeeds, pacificDateKey, 'tvmaze');
  try {
    const response = await fetch(`https://api.tvmaze.com/search/shows?q=${encodeURIComponent(seed)}`, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json() as Array<{ show?: { genres?: string[]; type?: string | null } }>;
    const candidates = payload
      .flatMap((entry) => [
        ...(Array.isArray(entry.show?.genres) ? entry.show.genres : []),
        normaliseSourceText(entry.show?.type),
      ])
      .map((value) => normaliseSourceText(value))
      .filter((value) => isSingleWordCandidate(value) && value.toLowerCase() !== seed.toLowerCase());
    const word = pickDeterministicItem(Array.from(new Set(candidates)), pacificDateKey, 'tvmaze');

    if (!word) {
      return {
        ok: false,
        note: `TVMaze responded for seed "${seed}", but no clean single-word genre or type was available.`,
        word: null,
      };
    }

    return {
      ok: true,
      note: `Entertainment term selected from TVMaze results using the Pacific-day theme "${seed}".`,
      word,
    };
  } catch (error) {
    console.error('TVMaze term fetch failed:', error);
    return {
      ok: false,
      note: 'TVMaze request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchGbifSource({ pacificDateKey, fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  const seed = pickDailySeed(biologyThemeSeeds, pacificDateKey, 'gbif');
  try {
    const response = await fetch(`https://api.gbif.org/v1/species/suggest?q=${encodeURIComponent(seed)}&limit=30`, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json() as Array<{ key?: number; canonicalName?: string; rank?: string }>;
    const candidates = payload
      .map((entry) => ({
        word: normaliseSourceText(entry.canonicalName),
        href: typeof entry.key === 'number' ? `https://www.gbif.org/species/${entry.key}` : '',
        rank: normaliseSourceText(entry.rank),
      }))
      .filter((entry) => entry.href && isSingleWordCandidate(entry.word) && ['GENUS', 'FAMILY', 'ORDER'].includes(entry.rank));
    const choice = pickDeterministicItem(candidates, pacificDateKey, 'gbif');

    if (!choice) {
      return {
        ok: false,
        note: `GBIF responded for seed "${seed}", but no single-word higher-taxon match was available.`,
        word: null,
      };
    }

    return {
      ok: true,
      note: `Biology term selected from GBIF using the Pacific-day theme "${seed}".`,
      word: choice.word,
      href: choice.href,
    };
  } catch (error) {
    console.error('GBIF term fetch failed:', error);
    return {
      ok: false,
      note: 'GBIF request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchNasaApodSource({ pacificDateKey, fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  try {
    const response = await fetch(`https://api.nasa.gov/planetary/apod?api_key=DEMO_KEY&date=${encodeURIComponent(pacificDateKey)}`, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json() as { title?: string; url?: string; hdurl?: string };
    const href = normaliseSourceText(payload.hdurl || payload.url);
    const title = normaliseSourceText(payload.title) || 'APOD';

    if (!href) {
      return {
        ok: false,
        note: `NASA APOD responded for ${pacificDateKey}, but did not include a usable media URL.`,
        word: null,
      };
    }

    return {
      ok: true,
      note: `NASA Astronomy Picture of the Day loaded for Pacific day ${pacificDateKey}: ${title}.`,
      word: title,
      href,
    };
  } catch (error) {
    console.error('NASA APOD fetch failed:', error);
    return {
      ok: false,
      note: 'NASA APOD request failed; using fallback label.',
      word: null,
    };
  }
}

async function fetchWikipediaPotdSource({ pacificDateKey, fetchOptions }: WidgetSourceFetchContext): Promise<WidgetSourceHealth> {
  const [year, month, day] = pacificDateKey.split('-');
  try {
    const response = await fetch(`https://api.wikimedia.org/feed/v1/wikipedia/en/featured/${year}/${month}/${day}`, fetchOptions);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const payload = await response.json() as { image?: { file_page?: string; title?: string } };
    const href = normaliseSourceText(payload.image?.file_page);
    const title = normaliseSourceText(payload.image?.title)
      .replace(/^File:/i, '')
      .replace(/\.[A-Za-z0-9]{2,5}$/i, '')
      || 'POTD';

    if (!href) {
      return {
        ok: false,
        note: `Wikipedia featured feed responded for ${pacificDateKey}, but no picture-of-the-day page was present.`,
        word: null,
      };
    }

    return {
      ok: true,
      note: `Wikipedia featured image loaded for Pacific day ${pacificDateKey}: ${title}.`,
      word: title,
      href,
    };
  } catch (error) {
    console.error('Wikipedia featured image fetch failed:', error);
    return {
      ok: false,
      note: 'Wikipedia featured image request failed; using fallback label.',
      word: null,
    };
  }
}

const widgetWordSourceFetchers: Record<WidgetWordSourceKey, (context: WidgetSourceFetchContext) => Promise<WidgetSourceHealth>> = {
  dictionary: fetchDictionarySource,
  merriam: fetchMerriamSource,
  wiktionary: fetchWiktionarySource,
  vocabulary: fetchVocabularySource,
  datamuse: fetchDatamuseSource,
  loc: fetchLocSource,
  ols4: fetchOls4Source,
  mesh: fetchMeshSource,
  pubchem: fetchPubChemSource,
  musicbrainz: fetchMusicBrainzSource,
  sportsdb: fetchSportsDbSource,
  mealdb: fetchMealDbSource,
  tvmaze: fetchTvMazeSource,
  gbif: fetchGbifSource,
  nasaApod: fetchNasaApodSource,
  wikipediaPotd: fetchWikipediaPotdSource,
};

const defaultWidgetPreference = {
  location_label: 'San Francisco',
  latitude: 37.7749,
  longitude: -122.4194,
  weather_unit: 'fahrenheit',
};

let wotdCache: { data: WidgetWordsPayload; pacificDateKey: string } | null = null;

function getPacificDateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Los_Angeles',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);

  const year = parts.find(part => part.type === 'year')?.value ?? '0000';
  const month = parts.find(part => part.type === 'month')?.value ?? '00';
  const day = parts.find(part => part.type === 'day')?.value ?? '00';
  return `${year}-${month}-${day}`;
}

const dbConfig = {
  host: process.env.JEFFERSONWM_WIDGET_DB_HOST || process.env.MYSQL_HOST,
  user: process.env.JEFFERSONWM_WIDGET_DB_USER || process.env.MYSQL_USER,
  password: process.env.JEFFERSONWM_WIDGET_DB_PASSWORD || process.env.MYSQL_PASSWORD,
  database: process.env.JEFFERSONWM_WIDGET_DB_NAME || process.env.MYSQL_DATABASE,
  port: Number(process.env.JEFFERSONWM_WIDGET_DB_PORT || process.env.MYSQL_PORT || 3306),
};

const isDbConfigured = Boolean(dbConfig.host && dbConfig.user && dbConfig.password && dbConfig.database);

const pool = isDbConfigured
  ? mysql.createPool({
      ...dbConfig,
      waitForConnections: true,
      connectionLimit: 10,
      queueLimit: 0,
    })
  : null;

async function getAuthUser(req: express.Request): Promise<AuthStatusUser | null> {
  const cookieHeader = req.get('cookie') || '';
  if (!cookieHeader) {
    return null;
  }

  try {
    const response = await fetch(`${authBaseUrl}/api/auth/status`, {
      headers: {
        cookie: cookieHeader,
      },
    });

    if (!response.ok) {
      return null;
    }

    const payload = await response.json() as { user?: AuthStatusUser | null };
    const user = payload.user;
    if (!user || !user.isApproved || user.isBlocked || user.isDeleted) {
      return null;
    }

    return user;
  } catch (error) {
    console.error('JeffersonWM auth status check failed:', error);
    return null;
  }
}

async function hasAdminAccess(req: express.Request, user?: AuthStatusUser | null) {
  if (adminToken && req.get('x-widget-admin-token') === adminToken) {
    return true;
  }

  const resolvedUser = user === undefined ? await getAuthUser(req) : user;
  return Boolean(resolvedUser?.isAdmin);
}

async function requireWidgetAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (await hasAdminAccess(req)) {
    next();
    return;
  }

  res.status(403).json({
    ok: false,
    error: 'Widget admin access is not enabled for this request.',
  });
}

function requireDb(res: express.Response) {
  if (!pool) {
    res.status(503).json({
      ok: false,
      error: 'JeffersonWM widget database is not configured yet.',
    });
    return null;
  }

  return pool;
}

function getCurrentUserId() {
  return process.env.JEFFERSONWM_DEV_USERNAME || 'jefferson';
}

function getWidgetUserId(user: AuthStatusUser | null) {
  return user?.username || user?.id || getCurrentUserId();
}

function normalizeDateValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }

  return String(value || '').slice(0, 10);
}

function normalizeOptionalDateValue(value: unknown) {
  const normalized = normalizeDateValue(value);
  return normalized || null;
}

function getFirstString(...values: unknown[]) {
  for (const value of values) {
    const text = String(value || '').trim();
    if (text) {
      return text;
    }
  }

  return '';
}

function normalizeGeoapifyResult(result: Record<string, unknown>): LocationSuggestion | null {
  const city = getFirstString(result.city, result.town, result.village, result.municipality, result.county, result.name);
  const region = getFirstString(result.state, result.region, result.county);
  const country = getFirstString(result.country);
  const countryCode = getFirstString(result.country_code).toLowerCase();
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);

  if (!city || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const labelParts = [city, region, country].filter(Boolean);

  return {
    label: labelParts.join(', '),
    city,
    region,
    country,
    countryCode,
    latitude,
    longitude,
    weatherUnit: getDefaultWeatherUnit(countryCode),
  };
}

function getDefaultWeatherUnit(countryCode: string): 'fahrenheit' | 'celsius' {
  const fahrenheitCountries = new Set([
    'bs',
    'bz',
    'ky',
    'lr',
    'pw',
    'us',
  ]);

  return fahrenheitCountries.has(countryCode.toLowerCase()) ? 'fahrenheit' : 'celsius';
}

function scoreLocationSuggestion(suggestion: LocationSuggestion, query: string) {
  const normalizedQuery = query.toLowerCase();
  const tokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const city = suggestion.city.toLowerCase();
  const label = suggestion.label.toLowerCase();
  let score = 0;

  if (city === normalizedQuery) {
    score += 1000;
  }

  if (city.startsWith(normalizedQuery)) {
    score += 500;
  }

  if (label.includes(normalizedQuery)) {
    score += 250;
  }

  for (const token of tokens) {
    if (city.startsWith(token)) {
      score += 75;
    } else if (city.includes(token)) {
      score += 35;
    }

    if (label.includes(token)) {
      score += 20;
    }
  }

  return score;
}

function sortEventsByNextOccurrence(events: WidgetEvent[]) {
  const today = new Date();
  const current = (today.getMonth() + 1) * 100 + today.getDate();

  return [...events].sort((a, b) => {
    const aDate = new Date(a.date);
    const bDate = new Date(b.date);
    const aValue = (aDate.getUTCMonth() + 1) * 100 + aDate.getUTCDate();
    const bValue = (bDate.getUTCMonth() + 1) * 100 + bDate.getUTCDate();
    const aDistance = aValue >= current ? aValue - current : aValue + 1231 - current;
    const bDistance = bValue >= current ? bValue - current : bValue + 1231 - current;
    return aDistance - bDistance;
  });
}

async function getEvents() {
  if (!pool) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT id, name, description, date, end_date, is_public
     FROM widget_special_dates
     ORDER BY MONTH(date) ASC, DAY(date) ASC, name ASC`,
  );

  return (rows as WidgetEvent[]).map(event => ({
    ...event,
    date: normalizeDateValue(event.date),
    end_date: event.end_date ? normalizeDateValue(event.end_date) : null,
  }));
}

async function getUserEvents(authUserId: string) {
  if (!pool) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT id, auth_user_id, name, description, date, end_date
     FROM user_widget_special_dates
     WHERE auth_user_id = ?
     ORDER BY MONTH(date) ASC, DAY(date) ASC, name ASC`,
    [authUserId],
  );

  return (rows as WidgetEvent[]).map(event => ({
    ...event,
    date: normalizeDateValue(event.date),
    end_date: event.end_date ? normalizeDateValue(event.end_date) : null,
  }));
}

async function getUserPreference(authUserId: string) {
  if (!pool) {
    return null;
  }

  const [rows] = await pool.query(
    `SELECT auth_user_id, display_name, location_label, latitude, longitude, weather_unit
     FROM user_widget_preferences
     WHERE auth_user_id = ?
     LIMIT 1`,
    [authUserId],
  );

  return (rows as UserWidgetPreference[])[0] || null;
}

async function getFonts() {
  if (!pool) {
    return fallbackFonts;
  }

  const [rows] = await pool.query(
    `SELECT id, name, weight, probability
     FROM widget_fonts
     ORDER BY name ASC`,
  );

  return rows as WidgetFont[];
}

async function getWidgetWords() {
  const pacificDateKey = getPacificDateKey();
  if (wotdCache && wotdCache.pacificDateKey === pacificDateKey) {
    return wotdCache.data;
  }

  const fetchOptions = {
    headers: {
      'User-Agent': 'Mozilla/5.0',
      Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,application/json;q=0.8,*/*;q=0.7',
    },
  };

  const result: WidgetWords = { ...fallbackWords };
  const sourceHealth = buildDefaultSourceHealth();
  const checkedAt = new Date().toISOString();
  const healthResults = await Promise.all(widgetWordSourceKeys.map(async (key) => {
    const health = await widgetWordSourceFetchers[key]({
      pacificDateKey,
      checkedAt,
      fetchOptions,
    });
    return [key, health] as const;
  }));

  for (const [key, health] of healthResults) {
    sourceHealth[key] = health;
    if (health.word) {
      result[key] = health.word;
    }
  }

  const payload: WidgetWordsPayload = {
    pacificDateKey,
    generatedAt: checkedAt,
    sources: widgetWordSourceKeys.map((key) => buildSourcePayload(key, sourceHealth[key], checkedAt)),
    words: result,
  };

  wotdCache = {
    data: payload,
    pacificDateKey,
  };

  return payload;
}

async function buildWidgetAccountPayload(authUserId: string, useStoredPreference = true) {
  if (!useStoredPreference) {
    return {
      ok: true,
      authUserId: 'guest',
      preference: {
        auth_user_id: 'guest',
        ...defaultWidgetPreference,
      },
      personalDates: [],
    };
  }

  const [preference, personalDates] = await Promise.all([
    getUserPreference(authUserId),
    getUserEvents(authUserId),
  ]);

  return {
    ok: true,
    authUserId,
    preference: preference || {
      auth_user_id: authUserId,
      ...defaultWidgetPreference,
    },
    personalDates,
  };
}

async function buildWidgetResolvedPayload(req: express.Request) {
  const authUser = await getAuthUser(req);
  const authUserId = getWidgetUserId(authUser);
  const canEditDefaults = await hasAdminAccess(req, authUser);
  const [publicEvents, personalEvents, preference] = await Promise.all([
    canEditDefaults ? getEvents() : Promise.resolve([]),
    authUser ? getUserEvents(authUserId) : Promise.resolve([]),
    authUser ? getUserPreference(authUserId) : Promise.resolve(null),
  ]);
  const events = [...publicEvents, ...personalEvents];
  const sortedEvents = sortEventsByNextOccurrence(events);

  return {
    ok: true,
    auth: {
      canEditDefaults,
    },
    resolved: {
      locationLabel: preference?.location_label || 'San Francisco, California',
      latitude: Number(preference?.latitude ?? defaultWidgetPreference.latitude),
      longitude: Number(preference?.longitude ?? defaultWidgetPreference.longitude),
      weatherUnit: preference?.weather_unit || defaultWidgetPreference.weather_unit,
      specialDates: events,
      nextSpecialDate: sortedEvents[0] || null,
    },
  };
}

app.use(cors({ origin: allowedOrigins, credentials: true }));
app.use(express.json());

app.get('/', (_req, res) => {
  res.type('html').send(`
    <!doctype html>
    <html lang="en">
      <head><meta charset="utf-8"><title>JeffersonWM API</title></head>
      <body>
        <h1>JeffersonWM API</h1>
        <p>Widget ownership is moving here from Lionship.</p>
        <ul>
          <li><code>/health</code> returns API and database status</li>
          <li><code>/api/widget/resolved</code> returns widget defaults and public data</li>
          <li><code>/api/widget/schema</code> describes the expected widget database tables</li>
        </ul>
      </body>
    </html>
  `);
});

app.get('/health', async (_req, res) => {
  let dbOk = false;
  let dbError = '';

  if (pool) {
    try {
      await pool.query('SELECT 1');
      dbOk = true;
    } catch (error) {
      dbError = error instanceof Error ? error.message : 'Unknown database error';
    }
  }

  res.json({
    ok: true,
    app: 'jeffersonwm',
    widgetOwner: 'jeffersonwm',
    dbConfigured: isDbConfigured,
    dbOk,
    dbError,
    writeAccess: adminToken ? 'token-required' : 'disabled',
    projectActivity: projectActivityService.getStatus(),
  });
});

app.get('/api/project-activity', async (_req, res) => {
  try {
    const snapshot = await projectActivityService.getSnapshot();
    res.json(snapshot);
  } catch (error) {
    const status = projectActivityService.getStatus();
    res.status(503).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Project activity could not be loaded.',
      status,
    });
  }
});

app.get('/api/widget/schema', (_req, res) => {
  res.json({
    ok: true,
    tables: [
      'widget_defaults',
      'widget_fonts',
      'widget_special_dates',
      'user_widget_preferences',
      'user_widget_special_dates',
    ],
    migrationSources: ['jeffers4_dates.events', 'jeffers4_fonts.fonts'],
  });
});

app.get('/api/account/me', async (req, res) => {
  const authUser = await getAuthUser(req);
  const username = getWidgetUserId(authUser);
  const preference = authUser ? await getUserPreference(username) : null;

  res.json({
    ok: true,
    authenticated: Boolean(authUser),
    username,
    displayName:
      preference?.display_name ||
      authUser?.displayName ||
      process.env.JEFFERSONWM_DEV_DISPLAY_NAME ||
      username,
    authProvider: authUser ? 'central' : 'pending',
    isAdmin: Boolean(authUser?.isAdmin),
    isOwner: Boolean(authUser?.isOwner),
    isApproved: Boolean(authUser?.isApproved),
    isBlocked: Boolean(authUser?.isBlocked),
    isDeleted: Boolean(authUser?.isDeleted),
    memberships: Array.isArray(authUser?.memberships) ? authUser.memberships : [],
  });
});

app.put('/api/account/me', async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).json({ ok: false, error: 'Sign in before editing your account name.' });
    return;
  }

  const authUserId = getWidgetUserId(authUser);
  const displayNameRaw = typeof req.body?.displayName === 'string' ? req.body.displayName : '';
  const displayName = displayNameRaw.trim() || null;

  await db.execute(
    `INSERT INTO user_widget_preferences (auth_user_id, display_name)
     VALUES (?, ?)
     ON DUPLICATE KEY UPDATE
       display_name = VALUES(display_name)`,
    [authUserId, displayName],
  );

  res.json({
    ok: true,
    authenticated: true,
    username: authUserId,
    displayName: displayName || authUser.displayName || authUser.username || authUserId,
    isAdmin: Boolean(authUser.isAdmin),
    isOwner: Boolean(authUser.isOwner),
    isApproved: Boolean(authUser.isApproved),
    isBlocked: Boolean(authUser.isBlocked),
    isDeleted: Boolean(authUser.isDeleted),
  });
});

app.get('/api/account/widget', async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    res.json(await buildWidgetAccountPayload(getWidgetUserId(authUser), Boolean(authUser)));
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Account widget data could not be loaded.',
    });
  }
});

app.get('/api/widget/preferences', async (req, res) => {
  try {
    const authUser = await getAuthUser(req);
    res.json(await buildWidgetAccountPayload(getWidgetUserId(authUser), Boolean(authUser)));
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Widget preferences could not be loaded.',
    });
  }
});

app.get('/api/locations/search', async (req, res) => {
  const query = String(req.query.q || '').trim();

  if (query.length < 3) {
    res.json({ ok: true, suggestions: [] });
    return;
  }

  if (!geoapifyApiKey) {
    res.status(503).json({
      ok: false,
      error: 'Geoapify is not configured.',
    });
    return;
  }

  try {
    const params = new URLSearchParams({
      text: query,
      type: 'city',
      format: 'json',
      limit: '6',
      bias: 'countrycode:us',
      apiKey: geoapifyApiKey,
    });
    const response = await fetch(`https://api.geoapify.com/v1/geocode/autocomplete?${params.toString()}`);

    if (!response.ok) {
      res.status(response.status).json({
        ok: false,
        error: `Geoapify returned HTTP ${response.status}.`,
      });
      return;
    }

    const payload = await response.json() as { results?: Record<string, unknown>[] };
    const seen = new Set<string>();
    const suggestions = (payload.results || [])
      .map(normalizeGeoapifyResult)
      .filter((suggestion): suggestion is LocationSuggestion => Boolean(suggestion))
      .filter(suggestion => {
        const key = `${suggestion.city}|${suggestion.region}|${suggestion.country}`.toLowerCase();
        if (seen.has(key)) {
          return false;
        }
        seen.add(key);
        return true;
      })
      .sort((a, b) => scoreLocationSuggestion(b, query) - scoreLocationSuggestion(a, query));

    res.json({ ok: true, suggestions });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Location search failed.',
    });
  }
});

app.put('/api/account/widget/preferences', async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).json({ ok: false, error: 'Sign in before saving widget preferences.' });
    return;
  }

  const authUserId = getWidgetUserId(authUser);
  const locationLabel = String(req.body?.location_label || '').trim() || null;
  const latitude = req.body?.latitude === '' || req.body?.latitude === null ? null : Number(req.body?.latitude);
  const longitude = req.body?.longitude === '' || req.body?.longitude === null ? null : Number(req.body?.longitude);
  const weatherUnit = String(req.body?.weather_unit || 'fahrenheit').toLowerCase() === 'celsius' ? 'celsius' : 'fahrenheit';

  if ((latitude !== null && !Number.isFinite(latitude)) || (longitude !== null && !Number.isFinite(longitude))) {
    res.status(400).json({ ok: false, error: 'Latitude and longitude must be numbers when provided.' });
    return;
  }

  await db.execute(
    `INSERT INTO user_widget_preferences (auth_user_id, location_label, latitude, longitude, weather_unit)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       location_label = VALUES(location_label),
       latitude = VALUES(latitude),
       longitude = VALUES(longitude),
       weather_unit = VALUES(weather_unit)`,
    [authUserId, locationLabel, latitude, longitude, weatherUnit],
  );

  res.json({ ok: true });
});

app.put('/api/widget/preferences', async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).json({ ok: false, error: 'Sign in before saving widget preferences.' });
    return;
  }

  const authUserId = getWidgetUserId(authUser);
  const locationLabel = String(req.body?.location_label || '').trim() || null;
  const latitude = req.body?.latitude === '' || req.body?.latitude === null ? null : Number(req.body?.latitude);
  const longitude = req.body?.longitude === '' || req.body?.longitude === null ? null : Number(req.body?.longitude);
  const weatherUnit = String(req.body?.weather_unit || 'fahrenheit').toLowerCase() === 'celsius' ? 'celsius' : 'fahrenheit';

  if ((latitude !== null && !Number.isFinite(latitude)) || (longitude !== null && !Number.isFinite(longitude))) {
    res.status(400).json({ ok: false, error: 'Latitude and longitude must be numbers when provided.' });
    return;
  }

  await db.execute(
    `INSERT INTO user_widget_preferences (auth_user_id, location_label, latitude, longitude, weather_unit)
     VALUES (?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       location_label = VALUES(location_label),
       latitude = VALUES(latitude),
       longitude = VALUES(longitude),
       weather_unit = VALUES(weather_unit)`,
    [authUserId, locationLabel, latitude, longitude, weatherUnit],
  );

  res.json({ ok: true });
});

app.post('/api/account/widget/special-dates', async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).json({ ok: false, error: 'Sign in before saving personal dates.' });
    return;
  }

  const authUserId = getWidgetUserId(authUser);
  const name = String(req.body?.name || '').trim();
  const description = String(req.body?.description || '').trim() || null;
  const date = normalizeOptionalDateValue(req.body?.date);
  const endDate = normalizeOptionalDateValue(req.body?.end_date);

  if (!name || !date) {
    res.status(400).json({ ok: false, error: 'Expected name and date.' });
    return;
  }

  await db.execute(
    `INSERT INTO user_widget_special_dates (auth_user_id, name, description, date, end_date)
     VALUES (?, ?, ?, ?, ?)`,
    [authUserId, name, description, date, endDate],
  );

  res.json({ ok: true });
});

app.delete('/api/account/widget/special-dates/:id', async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const authUser = await getAuthUser(req);
  if (!authUser) {
    res.status(401).json({ ok: false, error: 'Sign in before deleting personal dates.' });
    return;
  }

  await db.execute('DELETE FROM user_widget_special_dates WHERE id = ? AND auth_user_id = ?', [
    req.params.id,
    getWidgetUserId(authUser),
  ]);

  res.json({ ok: true });
});

app.get('/api/widget/resolved', async (req, res) => {
  try {
    res.json(await buildWidgetResolvedPayload(req));
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Widget state could not be resolved.',
    });
  }
});

app.get('/api/widget/state', async (req, res) => {
  try {
    res.json(await buildWidgetResolvedPayload(req));
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Widget state could not be resolved.',
    });
  }
});

app.get('/api/widget/fonts', async (_req, res) => {
  try {
    res.json(await getFonts());
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Fonts could not be loaded.',
    });
  }
});

app.put('/api/widget/fonts/:name', requireWidgetAdmin, async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const weight = Number(req.body?.weight);
  const probability = Number(req.body?.probability ?? req.body?.weight);

  if (!Number.isFinite(weight) || weight < 1 || weight > 5 || !Number.isFinite(probability)) {
    res.status(400).json({ ok: false, error: 'Expected weight 1-5 and numeric probability.' });
    return;
  }

  await db.execute('UPDATE widget_fonts SET weight = ?, probability = ? WHERE name = ?', [
    weight,
    probability,
    req.params.name,
  ]);
  res.json({ ok: true });
});

app.get('/api/widget/all-events', requireWidgetAdmin, async (_req, res) => {
  try {
    res.json(await getEvents());
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Events could not be loaded.',
    });
  }
});

app.get('/api/widget/next-event', requireWidgetAdmin, async (_req, res) => {
  try {
    const events = await getEvents();
    res.json(sortEventsByNextOccurrence(events)[0] || null);
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error instanceof Error ? error.message : 'Next event could not be loaded.',
    });
  }
});

app.post('/api/widget/events', requireWidgetAdmin, async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const { name, description, date, end_date: endDate } = req.body || {};
  if (!name || !date) {
    res.status(400).json({ ok: false, error: 'Expected name and date.' });
    return;
  }

  await db.execute(
    'INSERT INTO widget_special_dates (name, description, date, end_date, is_public) VALUES (?, ?, ?, ?, 1)',
    [name, description || null, date, endDate || null],
  );
  res.json({ ok: true });
});

app.put('/api/widget/events/:id', requireWidgetAdmin, async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  const { name, description, date, end_date: endDate } = req.body || {};
  if (!name || !date) {
    res.status(400).json({ ok: false, error: 'Expected name and date.' });
    return;
  }

  await db.execute(
    'UPDATE widget_special_dates SET name = ?, description = ?, date = ?, end_date = ? WHERE id = ?',
    [name, description || null, date, endDate || null, req.params.id],
  );
  res.json({ ok: true });
});

app.delete('/api/widget/events/:id', requireWidgetAdmin, async (req, res) => {
  const db = requireDb(res);
  if (!db) {
    return;
  }

  await db.execute('DELETE FROM widget_special_dates WHERE id = ?', [req.params.id]);
  res.json({ ok: true });
});

app.get('/api/widget/wotd', async (_req, res) => {
  try {
    res.json(await getWidgetWords());
  } catch (error) {
    console.error('Widget discovery sources could not be loaded:', error);
    const checkedAt = new Date().toISOString();
    res.json({
      pacificDateKey: getPacificDateKey(),
      generatedAt: checkedAt,
      sources: widgetWordSourceKeys.map((key) => {
        const source = widgetWordSourceDefinitions[key];
        return {
          key,
          label: source.label,
          word: null,
          display: source.label,
          href: source.fallbackHref,
          fallbackHref: source.fallbackHref,
          providerType: source.providerType,
          ok: false,
          fallback: true,
          note: 'The widget API could not load this source and returned the fallback label.',
          checkedAt,
        };
      }),
      words: fallbackWords,
    } satisfies WidgetWordsPayload);
  }
});

app.listen(port, () => {
  console.log(`JeffersonWM API listening on http://localhost:${port}`);
});

projectActivityService.start();
