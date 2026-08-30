import { ChangeEvent, CSSProperties, FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Briefcase,
  Clock,
  Code,
  ChevronDown,
  ChevronUp,
  Pencil,
  ExternalLink,
  FileText,
  Github,
  Info,
  Linkedin,
  MessageSquare,
  Pin,
  PinOff,
  RefreshCw,
  Share2,
  Trash2,
  Trophy,
  SwatchBook,
} from 'lucide-react';

type FeedView = 'all' | 'releases' | 'manual';
type RichEditorTab = 'write' | 'preview';

interface FeedItem {
  id: number;
  title: string;
  content: string | null;
  url: string | null;
  source: string;
  created_at: string;
  pinned_at?: string | null;
  tint_color?: string | null;
}

interface ConsolidatedFeedItem {
  id: string;
  source: string;
  repo: string | null;
  created_at: string;
  items: FeedItem[];
}

interface FeedWeekGroup {
  key: string;
  weekNumber: number;
  weekYear: number;
  start: Date;
  end: Date;
  items: FeedItem[];
}

interface FeedWeekSummary {
  week_key: string;
  week_year: number;
  week_number: number;
  start_date: string;
  end_date: string;
  content: string;
  updated_at: string;
}

interface FeedWeekSummaryStyle {
  id: string;
  label: string;
  mode: string;
  purpose: string;
}

interface WeekSiteSummary {
  siteKey: string;
  siteLabel: string;
  tasks: string[];
}

interface FeedLegendEntry {
  name: string;
  description: string;
}

interface FeedSiteFilter {
  name: string;
  count: number;
  description: string;
}

interface PostFormState {
  title: string;
  content: string;
  source: string;
  url: string;
  publishAt: string;
  appName: string;
  version: string;
  highlights: string;
  tintColor: string;
}

interface FeedUploadResponse {
  ok: boolean;
  name: string;
  type: string;
  size: number;
  url: string;
}

const inferredFeedApiBase =
  typeof window !== 'undefined' && /(^|\.)jeffersonwm\.com$/i.test(window.location.hostname)
    ? 'https://api-feed.jeffersonwm.com'
    : '';
const FEED_API_BASE = (import.meta.env.VITE_API_BASE_URL || inferredFeedApiBase).replace(/\/$/, '');
const FEED_ATOM_URL = `${FEED_API_BASE}/atom.xml`;
const FEED_TIMEZONE = 'America/Los_Angeles';
const FEED_LEGEND_LINKS: Record<string, string> = {
  'auth/multimillion': 'https://github.com/wmjefferson',
  battalion: 'https://jeffersonwm.com/battalion/',
  bullion: 'https://jeffersonwm.com/bullion/',
  'clionidae-legacy': 'https://github.com/wmjefferson',
  dookydetective: 'https://dookydetective.com',
  endellionite: 'https://github.com/wmjefferson',
  feed: 'https://jeffersonwm.com/feed/',
  jeffershizzle: 'https://jeffershizzle.com',
  jeffersonwm: 'https://jeffersonwm.com',
  'jeffersonwm-legacy': 'https://github.com/wmjefferson',
  lionship: 'https://jeffersonwm.com/lionship/',
  medallion: 'https://github.com/wmjefferson',
  perihelion: 'https://jeffersonwm.com/perihelion/',
  rebellion: 'https://github.com/wmjefferson',
  stallioneer: 'https://github.com/wmjefferson/jeffersonwm/issues/50',
  tourbillion: 'https://jeffersonwm.com/tourbillion/',
  trillions: 'https://github.com/wmjefferson',
  vermilion: 'https://jeffersonwm.com/vermilion/',
  wmjefferson: 'https://github.com/wmjefferson',
};
const FEED_SITE_LABELS: Record<string, string> = {
  'auth/multimillion': 'Auth/Multimillion',
  battalion: 'Battalion',
  bullion: 'Bullion',
  'clionidae-legacy': 'Clionidae Legacy',
  dookydetective: 'Dookydetective',
  endellionite: 'Endellionite',
  feed: 'Feed',
  jeffershizzle: 'Jeffershizzle',
  jeffersonwm: 'JeffersonWM',
  'jeffersonwm-legacy': 'JeffersonWM Legacy',
  lionship: 'Lionship',
  medallion: 'Medallion',
  perihelion: 'Perihelion',
  rebellion: 'Rebellion',
  stallioneer: 'Stallioneer',
  tourbillion: 'Tourbillion',
  trillions: 'Trillions',
  vermilion: 'Vermilion',
  wmjefferson: 'WMJefferson',
};
const FEED_LEGEND: FeedLegendEntry[] = [
  { name: 'auth/multimillion', description: 'auth' },
  { name: 'battalion', description: 'RPG GAME TWO Ts ONE L' },
  { name: 'bullion', description: 'batch rename' },
  { name: 'clionidae-legacy', description: 'template archive' },
  { name: 'dookydetective', description: 'my dog' },
  { name: 'endellionite', description: 'windows 95 scanner (DEVELOPMENT, REDEVELOPMENT)' },
  { name: 'feed', description: 'rss of development and github project' },
  { name: 'jeffershizzle', description: 'original photo website (ARCHIVE)' },
  { name: 'jeffersonwm', description: 'experiments' },
  { name: 'jeffersonwm-legacy', description: 'first version (ARCHIVE)' },
  { name: 'lionship', description: 'linkstream' },
  { name: 'medallion', description: 'chefferson (EARLY DEVELOPMENT)' },
  { name: 'perihelion', description: 'image browser' },
  { name: 'rebellion', description: 'Text/image writing tool (DEVELOPMENT)' },
  { name: 'stallioneer', description: 'book scanner (IN PROGRESS)' },
  { name: 'tourbillion', description: 'screensaver' },
  { name: 'trillions', description: 'KEEP tool (CANCELLED)' },
  { name: 'vermilion', description: 'image python script' },
  { name: 'wmjefferson', description: 'professional' },
];
const feedDateFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: FEED_TIMEZONE,
  month: 'short',
  day: 'numeric',
});
const feedTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: FEED_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});
const feedTimezoneFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: FEED_TIMEZONE,
  timeZoneName: 'short',
});
const feedPacificDatePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: FEED_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const feedPacificTimePartsFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: FEED_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
  hourCycle: 'h23',
});
const feedWeekRangeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
});
function getPacificDateInputValue(date = new Date()) {
  const parts = Object.fromEntries(
    feedPacificDatePartsFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

const defaultPostState = (): PostFormState => ({
  title: '',
  content: '',
  source: 'log',
  url: '',
  publishAt: getPacificDateInputValue(),
  appName: '',
  version: '',
  highlights: '',
  tintColor: '',
});

const ENTRY_TINT_OPTIONS = [
  { value: '', label: 'Default' },
  { value: '#f4d7d7', label: 'Rose' },
  { value: '#f3dfcf', label: 'Peach' },
  { value: '#f0e1b8', label: 'Gold' },
  { value: '#dbe6b8', label: 'Lime' },
  { value: '#d1ead4', label: 'Mint' },
  { value: '#cde9de', label: 'Sage' },
  { value: '#cfecea', label: 'Seafoam' },
  { value: '#d5edf7', label: 'Sky' },
  { value: '#dce7fb', label: 'Blue' },
  { value: '#deddf8', label: 'Indigo' },
  { value: '#eadcf8', label: 'Violet' },
  { value: '#f0d8f0', label: 'Orchid' },
  { value: '#f6dce8', label: 'Pink' },
  { value: '#e7dfd6', label: 'Stone' },
  { value: '#ece9e3', label: 'Mist' },
] as const;

const ENTRY_TINT_VALUES = new Set<string>(ENTRY_TINT_OPTIONS.map((option) => option.value));

function apiUrl(path: string) {
  return `${FEED_API_BASE}${path}`;
}

function formatRefreshErrorMessage(details: string) {
  const normalized = details.trim();
  if (!normalized) {
    return 'Could not refresh GitHub feed right now.';
  }

  const lower = normalized.toLowerCase();
  if (lower.includes('gateway time-out') || lower.includes('timed out') || lower.includes('timeout')) {
    return 'Could not refresh GitHub feed right now. GitHub timed out upstream.';
  }

  if (lower.includes('unreachable')) {
    return 'Could not refresh GitHub feed right now. GitHub was unreachable upstream.';
  }

  return `Could not refresh GitHub feed right now. ${normalized}`;
}

function parseFeedDate(value: string) {
  const trimmed = value.trim();
  const hasTimezone = /(?:Z|[+-]\d{2}:\d{2})$/i.test(trimmed);
  const normalized = hasTimezone ? trimmed : `${trimmed.replace(' ', 'T')}Z`;
  return new Date(normalized);
}

function getPacificCalendarDate(value: string) {
  const date = parseFeedDate(value);
  const parts = Object.fromEntries(
    feedPacificDatePartsFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const year = Number(parts.year);
  const month = Number(parts.month);
  const day = Number(parts.day);
  return new Date(Date.UTC(year, month - 1, day));
}

function getWeekStart(date: Date) {
  const start = new Date(date);
  const weekday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - weekday);
  start.setUTCHours(0, 0, 0, 0);
  return start;
}

function getWeekMetadata(value: string) {
  const calendarDate = getPacificCalendarDate(value);
  const start = getWeekStart(calendarDate);
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  const isoAnchor = new Date(start);
  isoAnchor.setUTCDate(start.getUTCDate() + 3);
  const weekYear = isoAnchor.getUTCFullYear();
  const firstWeekStart = getWeekStart(new Date(Date.UTC(weekYear, 0, 4)));
  const weekNumber = Math.round((start.getTime() - firstWeekStart.getTime()) / 604800000) + 1;

  return {
    key: `${weekYear}-W${String(weekNumber).padStart(2, '0')}`,
    start,
    end,
    weekYear,
    weekNumber,
  };
}

function formatIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function formatWeekRange(start: Date, end: Date) {
  return `${feedWeekRangeFormatter.format(start)} – ${feedWeekRangeFormatter.format(end)}`;
}

function getFeedSiteLabel(siteName: string) {
  return FEED_SITE_LABELS[siteName] || siteName;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function stripMarkupToText(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  if (typeof window !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${trimmed}</div>`, 'text/html');
    return doc.body.textContent?.replace(/\s+/g, ' ').trim() || '';
  }

  return trimmed.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

function normalizeSummaryTask(value: string) {
  return value
    .replace(/\s+/g, ' ')
    .replace(/^[\-\*\d.\s]+/, '')
    .replace(/[.:;,\s]+$/, '')
    .trim();
}

function isSafeRichUrl(value: string) {
  if (!value) {
    return false;
  }

  if (value.startsWith('/')) {
    return true;
  }

  try {
    const parsed = new URL(value);
    return ['http:', 'https:', 'mailto:'].includes(parsed.protocol);
  } catch {
    return false;
  }
}

function sanitizeRichHtml(value: string) {
  if (!value.trim() || typeof window === 'undefined') {
    return value.trim();
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div>${value}</div>`, 'text/html');
  const root = doc.body.firstElementChild;
  if (!root) {
    return '';
  }

  const allowedTags = new Set([
    'A',
    'B',
    'BLOCKQUOTE',
    'BR',
    'CODE',
    'DIV',
    'EM',
    'FIGCAPTION',
    'FIGURE',
    'H3',
    'H4',
    'H5',
    'I',
    'IMG',
    'LI',
    'OL',
    'P',
    'PRE',
    'S',
    'SPAN',
    'STRONG',
    'U',
    'UL',
  ]);

  const cleanNode = (node: Node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType !== Node.ELEMENT_NODE) {
        return;
      }

      const element = child as HTMLElement;
      if (!allowedTags.has(element.tagName)) {
        const fragment = doc.createDocumentFragment();
        while (element.firstChild) {
          fragment.appendChild(element.firstChild);
        }
        element.replaceWith(fragment);
        cleanNode(node);
        return;
      }

      const href = element.getAttribute('href') || '';
      const source = element.getAttribute('src') || '';
      const alt = element.getAttribute('alt') || '';
      const className = element.getAttribute('class') || '';
      [...element.attributes].forEach((attribute) => element.removeAttribute(attribute.name));

      if (element.tagName === 'DIV' && className.split(/\s+/).includes('release-note-body')) {
        element.className = 'release-note-body';
      }

      if (element.tagName === 'A') {
        if (isSafeRichUrl(href)) {
          (element as HTMLAnchorElement).href = href;
          element.setAttribute('target', '_blank');
          element.setAttribute('rel', 'noopener noreferrer');
        }
      }

      if (element.tagName === 'IMG') {
        if (!isSafeRichUrl(source)) {
          element.remove();
          return;
        }
        (element as HTMLImageElement).src = source;
        (element as HTMLImageElement).alt = alt;
        element.setAttribute('loading', 'lazy');
      }

      cleanNode(element);
    });
  };

  cleanNode(root);

  const text = root.textContent?.replace(/\u00a0/g, ' ').trim() || '';
  const hasMediaOrLinks = Boolean(root.querySelector('img, a[href]'));
  if (!text && !hasMediaOrLinks) {
    return '';
  }

  return root.innerHTML.trim();
}

function normalizeVersion(value: string) {
  return value.trim().replace(/^v\.?/i, '');
}

function buildReleaseTitle(appName: string, version: string) {
  const normalizedVersion = normalizeVersion(version);
  const trimmedAppName = appName.trim();
  return normalizedVersion ? `${trimmedAppName} v${normalizedVersion}` : trimmedAppName;
}

function formatEditorDate(value: string) {
  return getPacificDateInputValue(parseFeedDate(value));
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    hourCycle: 'h23',
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  const zonedTime = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return zonedTime - date.getTime();
}

function normalizeEditorDate(value: string) {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const dateMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!dateMatch) {
    return null;
  }

  const nowParts = Object.fromEntries(
    feedPacificTimePartsFormatter.formatToParts(new Date()).map((part) => [part.type, part.value]),
  );
  const wallClockUtcGuess = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(nowParts.hour),
    Number(nowParts.minute),
    Number(nowParts.second),
  );
  const offset = getTimeZoneOffsetMs(new Date(wallClockUtcGuess), FEED_TIMEZONE);
  const parsed = new Date(wallClockUtcGuess - offset);

  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString();
}

function formatParagraphHtml(value: string) {
  return formatMarkdownHtml(value);
}

function formatInlineMarkdown(value: string) {
  let html = escapeHtml(value);

  const protectedSegments: string[] = [];
  const protectSegment = (segment: string) => {
    const token = `@@PROTECTED${protectedSegments.length}@@`;
    protectedSegments.push(segment);
    return token;
  };

  html = html.replace(/`([^`]+)`/g, (_match, code) => {
    return protectSegment(`<code>${code}</code>`);
  });

  html = html.replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, (_match, alt, url) => {
    if (!isSafeRichUrl(url)) {
      return '';
    }
    return protectSegment(`<figure><img src="${url}" alt="${alt}" loading="lazy" /><figcaption>${alt}</figcaption></figure>`);
  });
  html = html.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_match, label, url) => {
    if (!isSafeRichUrl(url)) {
      return label;
    }
    return protectSegment(`<a href="${url}" target="_blank" rel="noopener noreferrer">${label}</a>`);
  });
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
  html = html.replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');
  html = html.replace(/(^|[^_])_([^_\n]+)_/g, '$1<em>$2</em>');

  protectedSegments.forEach((segment, index) => {
    html = html.replace(`@@PROTECTED${index}@@`, segment);
  });

  return html;
}

function isProbablyHtml(value: string) {
  return /<\/?[a-z][\s\S]*>/i.test(value);
}

function formatFeedContentHtml(item: FeedItem) {
  const content = item.content || '';
  if (!content.trim()) {
    return '';
  }

  if (isReleaseItem(item) || isProbablyHtml(content)) {
    return sanitizeRichHtml(content);
  }

  return formatMarkdownHtml(content);
}

function formatMarkdownHtml(value: string) {
  const lines = value.replace(/\r\n/g, '\n').split('\n');
  const html: string[] = [];
  let paragraph: string[] = [];
  let listType: 'ul' | 'ol' | null = null;
  let blockquote: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    html.push(`<p>${paragraph.map(formatInlineMarkdown).join('<br />')}</p>`);
    paragraph = [];
  };

  const closeList = () => {
    if (!listType) return;
    html.push(`</${listType}>`);
    listType = null;
  };

  const flushBlockquote = () => {
    if (blockquote.length === 0) return;
    html.push(`<blockquote><p>${blockquote.map(formatInlineMarkdown).join('<br />')}</p></blockquote>`);
    blockquote = [];
  };

  lines.forEach((line) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushParagraph();
      closeList();
      flushBlockquote();
      return;
    }

    if (/^!\[[^\]]*\]\([^)]+\)$/.test(trimmed)) {
      flushParagraph();
      closeList();
      flushBlockquote();
      html.push(formatInlineMarkdown(trimmed));
      return;
    }

    const headingMatch = trimmed.match(/^(#{1,3})\s+(.+)$/);
    if (headingMatch) {
      flushParagraph();
      closeList();
      flushBlockquote();
      const level = headingMatch[1].length + 2;
      html.push(`<h${level}>${formatInlineMarkdown(headingMatch[2])}</h${level}>`);
      return;
    }

    const blockquoteMatch = trimmed.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      flushParagraph();
      closeList();
      blockquote.push(blockquoteMatch[1]);
      return;
    }

    const unorderedMatch = trimmed.match(/^[-*]\s+(.+)$/);
    const orderedMatch = trimmed.match(/^\d+\.\s+(.+)$/);
    if (unorderedMatch || orderedMatch) {
      flushParagraph();
      flushBlockquote();
      const nextType = unorderedMatch ? 'ul' : 'ol';
      if (listType && listType !== nextType) {
        closeList();
      }
      if (!listType) {
        listType = nextType;
        html.push(`<${listType}>`);
      }
      html.push(`<li>${formatInlineMarkdown((unorderedMatch || orderedMatch)?.[1] || '')}</li>`);
      return;
    }

    closeList();
    flushBlockquote();
    paragraph.push(trimmed);
  });

  flushParagraph();
  closeList();
  flushBlockquote();

  return html.join('');
}

function formatReleaseHtml(highlights: string) {
  const items = highlights
    .split('\n')
    .map((item) => item.replace(/^[\-\*\u2022]\s*/, '').trim())
    .filter(Boolean);

  if (items.length === 0) {
    return '';
  }

  return `<div class="release-note-body"><p>What's new</p><ul>${items
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join('')}</ul></div>`;
}

function isReleaseItem(item: FeedItem) {
  return item.source.toLowerCase() === 'release';
}

function isManualItem(item: FeedItem) {
  const source = item.source.toLowerCase();
  return source !== 'github' && source !== 'release';
}

function isEditableItem(item: FeedItem) {
  return item.source.toLowerCase() !== 'github';
}

function decodeHtmlText(value: string) {
  if (typeof window === 'undefined') {
    return value;
  }

  const parser = new DOMParser();
  return parser.parseFromString(value, 'text/html').documentElement.textContent || '';
}

function htmlToEditorText(html: string | null) {
  if (!html) {
    return '';
  }

  const normalized = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<\/li>\s*<li[^>]*>/gi, '\n')
    .replace(/<li[^>]*>/gi, '')
    .replace(/<\/?(p|div|ul|ol)>/gi, '');

  return decodeHtmlText(normalized).replace(/\n{3,}/g, '\n\n').trim();
}

function getGitHubEntryDetail(item: FeedItem) {
  if (!item.content || typeof window === 'undefined') {
    return null;
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(item.content, 'text/html');
  const firstParagraph = doc.querySelector('p')?.textContent?.trim();

  if (!firstParagraph) {
    return null;
  }

  if (
    /^\d+\s+commits?\s+pushed\s+to\s+/i.test(firstParagraph) ||
    /^created\s+/i.test(firstParagraph) ||
    /^forked\s+to\s+/i.test(firstParagraph) ||
    /^repository\s+forked/i.test(firstParagraph) ||
    /^issue\s+update$/i.test(firstParagraph) ||
    /^issue\s+comment$/i.test(firstParagraph) ||
    /^pull\s+request\s+update$/i.test(firstParagraph) ||
    /^pull\s+request\s+review$/i.test(firstParagraph)
  ) {
    return null;
  }

  return firstParagraph;
}

function releaseHtmlToHighlights(html: string | null) {
  if (!html) {
    return '';
  }

  if (typeof window !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const bullets = [...doc.querySelectorAll('li')]
      .map((node) => node.textContent?.trim() || '')
      .filter(Boolean);

    if (bullets.length > 0) {
      return bullets.join('\n');
    }
  }

  return htmlToEditorText(html);
}

function parseReleaseTitle(title: string) {
  const match = title.trim().match(/^(.*?)(?:\s+v([^\s]+))?$/i);
  return {
    appName: match?.[1]?.trim() || title.trim(),
    version: match?.[2]?.trim() || '',
  };
}

function buildPostStateFromItem(item: FeedItem): PostFormState {
  if (isReleaseItem(item)) {
    const parsedTitle = parseReleaseTitle(item.title);
    return {
      title: '',
      content: '',
      source: 'release',
      url: item.url || '',
      publishAt: formatEditorDate(item.created_at),
      appName: parsedTitle.appName,
      version: parsedTitle.version,
      highlights: releaseHtmlToHighlights(item.content),
      tintColor: item.tint_color || '',
    };
  }

  return {
    title: item.title,
    content: item.content && isProbablyHtml(item.content) ? htmlToEditorText(item.content) : item.content || '',
    source: item.source,
    url: item.url || '',
    publishAt: formatEditorDate(item.created_at),
    appName: '',
    version: '',
    highlights: '',
    tintColor: item.tint_color || '',
  };
}

function hexToRgba(hex: string, alpha: number) {
  const normalized = hex.replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(normalized)) {
    return `rgba(17, 24, 39, ${alpha})`;
  }

  const red = parseInt(normalized.slice(0, 2), 16);
  const green = parseInt(normalized.slice(2, 4), 16);
  const blue = parseInt(normalized.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function getEntryTintStyle(item?: FeedItem | null): CSSProperties | undefined {
  if (!item?.tint_color || !ENTRY_TINT_VALUES.has(item.tint_color)) {
    return undefined;
  }

  return {
    backgroundColor: hexToRgba(item.tint_color, 0.42),
    borderColor: hexToRgba(item.tint_color, 0.88),
  };
}

export default function App() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [weekSummaries, setWeekSummaries] = useState<Record<string, FeedWeekSummary>>({});
  const [weekSummaryStyles, setWeekSummaryStyles] = useState<FeedWeekSummaryStyle[]>([]);
  const [view, setView] = useState<FeedView>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [secretInput, setSecretInput] = useState(localStorage.getItem('feed_secret') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('feed_secret_verified') === 'true');
  const [showLogin, setShowLogin] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [newPost, setNewPost] = useState<PostFormState>(defaultPostState);
  const [posting, setPosting] = useState(false);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [richEditorTab, setRichEditorTab] = useState<RichEditorTab>('write');
  const [activeWeekKey, setActiveWeekKey] = useState<string | null>(null);
  const [expandedWeekSummaryKey, setExpandedWeekSummaryKey] = useState<string | null>(null);
  const [editingWeekSummaryKey, setEditingWeekSummaryKey] = useState<string | null>(null);
  const [weekSummaryDraft, setWeekSummaryDraft] = useState('');
  const [selectedWeekSummaryStyleId, setSelectedWeekSummaryStyleId] = useState('');
  const [editingItemId, setEditingItemId] = useState<number | null>(null);
  const [copiedEntryId, setCopiedEntryId] = useState<number | null>(null);
  const [highlightedEntryId, setHighlightedEntryId] = useState<number | null>(null);
  const [expandedGitHubGroups, setExpandedGitHubGroups] = useState<string[]>([]);
  const markdownInputRef = useRef<HTMLTextAreaElement | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const attachmentInputRef = useRef<HTMLInputElement | null>(null);
  const tintPickerRef = useRef<HTMLDivElement | null>(null);
  const [showTintPicker, setShowTintPicker] = useState(false);

  const resetComposer = () => {
    setNewPost(defaultPostState());
    setEditingItemId(null);
    setUploadingAttachment(false);
    setRichEditorTab('write');
    setShowCompose(false);
    setShowTintPicker(false);
  };

  useEffect(() => {
    if (!showTintPicker) {
      return;
    }

    const handlePointerDown = (event: MouseEvent) => {
      if (!tintPickerRef.current?.contains(event.target as Node)) {
        setShowTintPicker(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [showTintPicker]);

  const handleResetPage = () => {
    setView('all');
    setSelectedSites([]);
    setShowSetup(false);
    setShowCompose(false);
    setShowLegend(false);
    setShowLogin(false);
    setAuthError(null);
    setError(null);
    setPasswordInput('');
    setHighlightedEntryId(null);
    setExpandedWeekSummaryKey(null);
    setEditingWeekSummaryKey(null);
    setWeekSummaryDraft('');
    setActiveWeekKey(weeks[0]?.key || null);
    resetComposer();
    if (window.location.hash) {
      history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchFeed = async () => {
    try {
      const response = await fetch(apiUrl('/api/feed'));
      if (!response.ok) {
        throw new Error('Failed to fetch feed');
      }

      const data = await response.json();
      setItems(data);
      setError(null);
    } catch (err) {
      setError('Connection error. Is the feed service reachable?');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchWeekSummaries = async () => {
    try {
      const response = await fetch(apiUrl('/api/feed/week-summaries'));
      if (!response.ok) {
        throw new Error('Failed to fetch weekly summaries');
      }

      const data = (await response.json()) as FeedWeekSummary[];
      const summaryMap = Object.fromEntries(data.map((summary) => [summary.week_key, summary]));
      setWeekSummaries(summaryMap);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchWeekSummaryStyles = async () => {
    try {
      const response = await fetch(apiUrl('/api/feed/week-summary-styles'));
      if (!response.ok) {
        throw new Error('Failed to fetch weekly summary styles');
      }

      const data = (await response.json()) as FeedWeekSummaryStyle[];
      setWeekSummaryStyles(data);
      setSelectedWeekSummaryStyleId((current) => current || data[0]?.id || '');
    } catch (err) {
      console.error(err);
    }
  };

  const handleRichEditorTabChange = (tab: RichEditorTab) => {
    setRichEditorTab(tab);
  };

  const updateMarkdownContent = (value: string, selectionStart?: number, selectionEnd?: number) => {
    setNewPost((current) => ({ ...current, content: value }));
    window.setTimeout(() => {
      markdownInputRef.current?.focus();
      if (selectionStart !== undefined && selectionEnd !== undefined) {
        markdownInputRef.current?.setSelectionRange(selectionStart, selectionEnd);
      }
    }, 0);
  };

  const insertMarkdownWrap = (before: string, after = '', placeholder = 'text') => {
    const input = markdownInputRef.current;
    const value = newPost.content;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    const inserted = `${before}${selected}${after}`;
    updateMarkdownContent(`${value.slice(0, start)}${inserted}${value.slice(end)}`, start + before.length, start + before.length + selected.length);
  };

  const insertMarkdownBlock = (prefix: string, placeholder = 'text') => {
    const input = markdownInputRef.current;
    const value = newPost.content;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || placeholder;
    const inserted = selected
      .split('\n')
      .map((line) => `${prefix}${line || placeholder}`)
      .join('\n');
    updateMarkdownContent(`${value.slice(0, start)}${inserted}${value.slice(end)}`, start + prefix.length, start + inserted.length);
  };

  const handleRichLink = () => {
    const href = window.prompt('Link URL');
    if (!href) {
      return;
    }

    if (!isSafeRichUrl(href)) {
      setError('Please use a full http, https, mailto, or local upload link.');
      return;
    }

    const value = newPost.content;
    const input = markdownInputRef.current;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const selected = value.slice(start, end) || 'link text';
    const inserted = `[${selected}](${href})`;
    updateMarkdownContent(`${value.slice(0, start)}${inserted}${value.slice(end)}`, start + 1, start + 1 + selected.length);
  };

  const uploadFeedFile = async (file: File) => {
    const response = await fetch(apiUrl('/api/uploads/feed'), {
      method: 'POST',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
        'X-Feed-Secret': secretInput,
        'X-File-Name': encodeURIComponent(file.name),
      },
      body: file,
    });

    if (response.status === 401) {
      throw new Error('Invalid secret');
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to upload file');
    }

    return (await response.json()) as FeedUploadResponse;
  };

  const buildAttachmentDownloadUrl = (url: string) => {
    return `${url}${url.includes('?') ? '&' : '?'}download=1`;
  };

  const insertMarkdownLine = (line: string) => {
    const input = markdownInputRef.current;
    const value = newPost.content;
    const start = input?.selectionStart ?? value.length;
    const end = input?.selectionEnd ?? value.length;
    const needsLeadingBreak = start > 0 && value[start - 1] !== '\n';
    const needsTrailingBreak = end < value.length && value[end] !== '\n';
    const inserted = `${needsLeadingBreak ? '\n' : ''}${line}${needsTrailingBreak ? '\n' : ''}`;
    const nextStart = start + inserted.length;
    updateMarkdownContent(`${value.slice(0, start)}${inserted}${value.slice(end)}`, nextStart, nextStart);
  };

  const handleRichFileUpload = async (event: ChangeEvent<HTMLInputElement>, mode: 'image' | 'attachment') => {
    const files = [...(event.target.files || [])];
    event.target.value = '';

    if (files.length === 0) {
      return;
    }

    setUploadingAttachment(true);
    setError(null);

    try {
      for (const file of files) {
        const upload = await uploadFeedFile(file);
        if (mode === 'image') {
          insertMarkdownLine(`![${upload.name}](${upload.url})`);
        } else {
          insertMarkdownLine(`[Attachment: ${upload.name}](${buildAttachmentDownloadUrl(upload.url)})`);
        }
      }
    } catch (err: any) {
      setError(err.message || 'Failed to upload file');
    } finally {
      setUploadingAttachment(false);
    }
  };

  const handleManualRefresh = async () => {
    setRefreshing(true);
    setError(null);

    try {
      const response = await fetch(apiUrl('/api/feed/refresh'), { method: 'POST' });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(formatRefreshErrorMessage(errorData.details || errorData.error || ''));
      }

      await fetchFeed();
    } catch (err: any) {
      setError(err?.message || 'Could not refresh GitHub feed right now.');
      console.error(err);
    } finally {
      setRefreshing(false);
    }
  };

  const handleLoginSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setAuthError(null);

    try {
      const response = await fetch(apiUrl('/api/auth/verify'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: passwordInput }),
      });

      if (!response.ok) {
        throw new Error('Invalid secret key');
      }

      localStorage.setItem('feed_secret', passwordInput);
      localStorage.setItem('feed_secret_verified', 'true');
      setSecretInput(passwordInput);
      setIsLoggedIn(true);
      setShowLogin(false);
      setPasswordInput('');
    } catch (err: any) {
      setAuthError(err.message || 'Verification failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('feed_secret');
    localStorage.removeItem('feed_secret_verified');
    setSecretInput('');
    setIsLoggedIn(false);
    setShowCompose(false);
    setShowSetup(false);
    setEditingItemId(null);
    setUploadingAttachment(false);
    setRichEditorTab('write');
    setEditingWeekSummaryKey(null);
    setWeekSummaryDraft('');
  };

  const handleEditWeekSummary = () => {
    if (!activeWeek) {
      return;
    }

    setExpandedWeekSummaryKey(activeWeek.key);
    setEditingWeekSummaryKey(activeWeek.key);
    setWeekSummaryDraft(activeWeekSummary?.content || '');
    setError(null);
  };

  const handleCancelWeekSummaryEdit = () => {
    setEditingWeekSummaryKey(null);
    setWeekSummaryDraft('');
  };

  const handleWeekSummaryStyleChange = (styleId: string) => {
    setSelectedWeekSummaryStyleId(styleId);

    const selectedStyle = generatedWeekSummaryVariants.find((style) => style.id === styleId);
    if (!selectedStyle?.content.trim()) {
      return;
    }

    setWeekSummaryDraft(selectedStyle.content);
  };

  const handleSaveWeekSummary = async () => {
    if (!activeWeek) {
      return;
    }

    const content = weekSummaryDraft.trim();
    if (!content) {
      setError('Weekly summary cannot be empty.');
      return;
    }

    setPosting(true);
    setError(null);

    try {
      const response = await fetch(apiUrl(`/api/feed/week-summaries/${activeWeek.key}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          secret: secretInput,
          content,
          week_year: activeWeek.weekYear,
          week_number: activeWeek.weekNumber,
          start_date: formatIsoDate(activeWeek.start),
          end_date: formatIsoDate(activeWeek.end),
        }),
      });

      if (response.status === 401) {
        throw new Error('Invalid secret');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to save weekly summary');
      }

      await fetchWeekSummaries();
      setEditingWeekSummaryKey(null);
      setExpandedWeekSummaryKey(activeWeek.key);
      setWeekSummaryDraft('');
    } catch (err: any) {
      setError(err.message || 'Failed to save weekly summary');
    } finally {
      setPosting(false);
    }
  };

  const handlePost = async (event: FormEvent) => {
    event.preventDefault();

    const isRelease = newPost.source === 'release';
    const resolvedTitle = isRelease
      ? buildReleaseTitle(newPost.appName, newPost.version)
      : newPost.title.trim();
    const resolvedContent = isRelease
      ? formatReleaseHtml(newPost.highlights)
      : newPost.content.trim();
    const createdAt = normalizeEditorDate(newPost.publishAt);
    const tintColor = ENTRY_TINT_VALUES.has(newPost.tintColor) ? newPost.tintColor || null : null;

    if (!resolvedTitle) {
      setError(isRelease ? 'App name and version are required for release notes.' : 'Title is required.');
      return;
    }

    if (newPost.publishAt.trim() && !createdAt) {
      setError('Publish date must be a valid date.');
      return;
    }

    setPosting(true);
    setError(null);

    try {
      const isEditing = editingItemId !== null;
      const response = await fetch(apiUrl(isEditing ? `/api/feed/${editingItemId}` : '/api/feed'), {
        method: isEditing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: resolvedTitle,
          content: resolvedContent || null,
          url: newPost.url || null,
          source: newPost.source,
          tint_color: tintColor,
          created_at: createdAt,
          secret: secretInput,
          ...(isEditing ? {} : { external_id: `${newPost.source}-${Date.now()}` }),
        }),
      });

      if (response.status === 401) {
        throw new Error('Invalid secret');
      }

      if (!response.ok) {
        throw new Error(isEditing ? 'Failed to update entry' : 'Failed to post');
      }

      resetComposer();
      await fetchFeed();
    } catch (err: any) {
      setError(err.message || (editingItemId !== null ? 'Failed to update entry' : 'Failed to create entry'));
    } finally {
      setPosting(false);
    }
  };

  const handleEdit = (item: FeedItem) => {
    setEditingItemId(item.id);
    setNewPost(buildPostStateFromItem(item));
    setRichEditorTab('write');
    setShowCompose(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (item: FeedItem) => {
    const confirmed = window.confirm(`Delete "${item.title}" from the feed?`);
    if (!confirmed) {
      return;
    }

    setPosting(true);
    setError(null);

    try {
      const response = await fetch(apiUrl(`/api/feed/${item.id}`), {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: secretInput }),
      });

      if (response.status === 401) {
        throw new Error('Invalid secret');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to delete entry');
      }

      if (editingItemId === item.id) {
        resetComposer();
      }

      await fetchFeed();
    } catch (err: any) {
      setError(err.message || 'Failed to delete entry');
    } finally {
      setPosting(false);
    }
  };

  const handlePinToggle = async (item: FeedItem) => {
    setPosting(true);
    setError(null);

    try {
      const response = await fetch(apiUrl(`/api/feed/${item.id}/pin`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: secretInput, pinned: !item.pinned_at }),
      });

      if (response.status === 401) {
        throw new Error('Invalid secret');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update pin');
      }

      await fetchFeed();
    } catch (err: any) {
      setError(err.message || 'Failed to update pin');
    } finally {
      setPosting(false);
    }
  };

  useEffect(() => {
    fetchFeed();
    fetchWeekSummaries();
    fetchWeekSummaryStyles();
    const interval = setInterval(fetchFeed, 30000);
    return () => clearInterval(interval);
  }, []);

  const getSourceIcon = (source: string) => {
    switch (source.toLowerCase()) {
      case 'github':
        return <Github size={16} />;
      case 'linkedin':
        return <Linkedin size={16} />;
      case 'handshake':
        return <Briefcase size={16} />;
      case 'milestone':
        return <Trophy size={16} />;
      case 'thought':
        return <MessageSquare size={16} />;
      case 'log':
        return <FileText size={16} />;
      case 'release':
        return <Code size={16} />;
      default:
        return <Info size={16} />;
    }
  };

  const formatDate = (dateStr: string) => {
    const date = parseFeedDate(dateStr);
    const timezonePart =
      feedTimezoneFormatter
        .formatToParts(date)
        .find((part) => part.type === 'timeZoneName')
        ?.value || 'PT';
    return `${feedDateFormatter.format(date)}, ${feedTimeFormatter.format(date)} ${timezonePart}`;
  };

  const getEntryAnchorId = (item: Pick<FeedItem, 'id'>) => `entry-${item.id}`;

  const getEntryShareUrl = (item: Pick<FeedItem, 'id'>) => {
    const baseUrl = `${window.location.origin}${window.location.pathname}${window.location.search}`;
    return `${baseUrl}#${getEntryAnchorId(item)}`;
  };

  const handleShareEntry = async (item: FeedItem) => {
    const url = getEntryShareUrl(item);
    const shareData = {
      title: item.title,
      text: item.title,
      url,
    };

    try {
      if (navigator.share && navigator.canShare?.(shareData)) {
        await navigator.share(shareData);
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
      } else {
        window.prompt('Copy feed entry link', url);
      }

      setCopiedEntryId(item.id);
      window.setTimeout(() => {
        setCopiedEntryId((current) => (current === item.id ? null : current));
      }, 1800);
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') {
        window.prompt('Copy feed entry link', url);
      }
    }
  };

  const getGitHubRepo = (item: FeedItem): string | null => {
    if (item.source.toLowerCase() !== 'github') {
      return null;
    }

    if (item.url) {
      const urlMatch = item.url.match(/github\.com\/([^\/]+)\/([^\/]+)/);
      if (urlMatch) {
        const user = urlMatch[1];
        const repo = urlMatch[2];
        if (repo && !['stars', 'followers', 'following', 'dashboard'].includes(repo)) {
          return `${user}/${repo}`;
        }
      }
    }

    const titleMatch = item.title.match(/([a-zA-Z0-9._-]+)\/([a-zA-Z0-9._-]+)/);
    return titleMatch ? `${titleMatch[1]}/${titleMatch[2]}` : null;
  };

  const cleanGitHubTitle = (title: string, repoName: string) => {
    const pattern = new RegExp(`\\s+in\\s+${repoName}`, 'i');
    return title.replace(pattern, '');
  };

  const getActionType = (title: string, repo: string | null) => {
    const trimmed = title.trim();
    const words = trimmed.split(/\s+/);
    if (words.length <= 1) {
      return trimmed.toLowerCase();
    }

    let actionText = words.slice(1).join(' ');
    if (repo) {
      const escapedRepo = repo.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
      actionText = actionText.replace(new RegExp(`\\s+in\\s+${escapedRepo}`, 'i'), '');
      actionText = actionText.replace(new RegExp(escapedRepo, 'gi'), '');
    }

    return actionText.replace(/#\d+/g, '').replace(/:\s*$/, '').trim().toLowerCase();
  };

  const getItemSiteMatches = (item: FeedItem) => {
    const title = item.title.toLowerCase();
    const content = (item.content || '').toLowerCase();
    const url = (item.url || '').toLowerCase();
    const haystacks = [title, content, url];

    return FEED_LEGEND
      .map((entry) => entry.name)
      .filter((name) => {
        const normalizedName = name.toLowerCase();
        return haystacks.some((value) => value.includes(normalizedName));
      });
  };

  const extractReleaseSummaryTasks = (content: string) => {
    const htmlListMatches = [...content.matchAll(/<li>([\s\S]*?)<\/li>/gi)]
      .map((match) => normalizeSummaryTask(stripMarkupToText(match[1] || '')))
      .filter(Boolean);
    if (htmlListMatches.length > 0) {
      return htmlListMatches;
    }

    const markdownListMatches = content
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => /^[-*]\s+/.test(line) || /^\d+\.\s+/.test(line))
      .map((line) => normalizeSummaryTask(stripMarkupToText(line.replace(/^([-*]|\d+\.)\s+/, ''))))
      .filter(Boolean);
    if (markdownListMatches.length > 0) {
      return markdownListMatches;
    }

    const paragraphText = normalizeSummaryTask(stripMarkupToText(content));
    return paragraphText ? [paragraphText] : [];
  };

  const cleanSummaryTaskForSite = (value: string, siteName: string) => {
    const variants = [siteName, getFeedSiteLabel(siteName)]
      .map((entry) => entry.trim())
      .filter(Boolean);

    let cleaned = value;
    for (const variant of variants) {
      const escaped = variant.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      cleaned = cleaned.replace(new RegExp(escaped, 'ig'), '').replace(/\s{2,}/g, ' ').trim();
    }

    cleaned = cleaned.replace(/^[:\-–|,.\s]+/, '').replace(/\s{2,}/g, ' ').trim();
    return normalizeSummaryTask(cleaned);
  };

  const summarizeItemForSite = (item: FeedItem, siteName: string) => {
    if (isReleaseItem(item)) {
      const tasks = extractReleaseSummaryTasks(item.content || '')
        .map((task) => cleanSummaryTaskForSite(task, siteName))
        .filter(Boolean);
      if (tasks.length > 0) {
        return tasks;
      }
    }

    if ((item.source || '').toLowerCase() === 'github') {
      const repo = getGitHubRepo(item);
      const githubTask = normalizeSummaryTask(cleanGitHubTitle(item.title, repo || ''));
      const cleanedGitHubTask = cleanSummaryTaskForSite(githubTask, siteName);
      return cleanedGitHubTask ? [cleanedGitHubTask] : [];
    }

    const fallbackTask = cleanSummaryTaskForSite(stripMarkupToText(item.title), siteName);
    return fallbackTask ? [fallbackTask] : [];
  };

  const renderWeekSummaryVariant = (styleId: string, siteSummaries: WeekSiteSummary[]) => {
    if (siteSummaries.length === 0) {
      return '';
    }

    const lines = siteSummaries.map((summary) => {
      const tasks = summary.tasks;
      const lead = tasks[0] || 'updated work';
      const rest = tasks.slice(1);

      switch (styleId) {
        case 'compact-built-fixed-decided':
          return `- ${summary.siteLabel}: ${tasks.join('; ')}.`;
        case 'compact-outcome-first':
          return `- ${summary.siteLabel}: ${lead}; ${rest.length > 0 ? rest.join('; ') : 'improved the overall experience'}.`;
        case 'expanded-focus-work-result':
          return `- ${summary.siteLabel}: focus was ${lead.toLowerCase()}; work included ${tasks.join('; ')}; result was a clearer weekly step forward.`;
        case 'expanded-editorial-recap':
          return `- ${summary.siteLabel}: the week centered on ${lead.toLowerCase()}, with work spanning ${tasks.join('; ')}.`;
        case 'expanded-technical-why':
          return `- ${summary.siteLabel}: ${tasks.join('; ')}; this matters because the week left the project easier to use and easier to understand.`;
        case 'compact-plain-bullets':
        default:
          return `- ${summary.siteLabel}: ${tasks.join('; ')}.`;
      }
    });

    return lines.join('\n');
  };

  const toggleSelectedSite = (siteName: string) => {
    setSelectedSites((current) =>
      current.includes(siteName) ? current.filter((item) => item !== siteName) : [...current, siteName],
    );
  };

  const toggleExpandedGitHubGroup = (groupId: string) => {
    setExpandedGitHubGroups((current) =>
      current.includes(groupId) ? current.filter((item) => item !== groupId) : [...current, groupId],
    );
  };

  const groupFeedItems = (rawItems: FeedItem[]) => {
    const sortedRaw = [...rawItems].sort(
      (left, right) => parseFeedDate(right.created_at).getTime() - parseFeedDate(left.created_at).getTime(),
    );
    const groups: ConsolidatedFeedItem[] = [];

    for (const item of sortedRaw) {
      const repo = getGitHubRepo(item);
      if (!repo) {
        groups.push({
          id: `item-group-${item.id}`,
          source: item.source,
          repo: null,
          created_at: item.created_at,
          items: [item],
        });
        continue;
      }

      const actionType = getActionType(item.title, repo);
      const lastGroup = groups[groups.length - 1];

      if (
        lastGroup &&
        lastGroup.source === 'github' &&
        lastGroup.repo === repo &&
        lastGroup.items.length > 0 &&
        getActionType(lastGroup.items[0].title, repo) === actionType
      ) {
        lastGroup.items.push(item);
        if (parseFeedDate(item.created_at) > parseFeedDate(lastGroup.created_at)) {
          lastGroup.created_at = item.created_at;
        }
      } else {
        groups.push({
          id: `github-group-${repo}-${item.id}`,
          source: 'github',
          repo,
          created_at: item.created_at,
          items: [item],
        });
      }
    }

    return groups.sort(
      (left, right) => parseFeedDate(right.created_at).getTime() - parseFeedDate(left.created_at).getTime(),
    );
  };

  const releaseCount = items.filter(isReleaseItem).length;
  const manualCount = items.filter(isManualItem).length;
  const itemsForView = useMemo(() => {
    const filtered =
      view === 'releases' ? items.filter(isReleaseItem) : view === 'manual' ? items.filter(isManualItem) : items;

    return [...filtered].sort(
      (left, right) => parseFeedDate(right.created_at).getTime() - parseFeedDate(left.created_at).getTime(),
    );
  }, [items, view]);

  const siteCountMap = useMemo(() => {
    const counts = new Map<string, number>();

    for (const item of itemsForView) {
      const matchedSites = getItemSiteMatches(item);
      for (const siteName of matchedSites) {
        counts.set(siteName, (counts.get(siteName) || 0) + 1);
      }
    }

    return counts;
  }, [itemsForView]);

  const siteFilters = useMemo<FeedSiteFilter[]>(() => {
    return FEED_LEGEND
      .map((entry) => ({
        name: entry.name,
        description: entry.description,
        count: siteCountMap.get(entry.name) || 0,
      }))
      .filter((entry) => entry.count > 0 || selectedSites.includes(entry.name));
  }, [selectedSites, siteCountMap]);

  const visibleItems = useMemo(() => {
    if (selectedSites.length === 0) {
      return itemsForView;
    }

    const selectedSiteSet = new Set(selectedSites);
    const filtered = itemsForView.filter((item) => getItemSiteMatches(item).some((site) => selectedSiteSet.has(site)));

    return [...filtered].sort(
      (left, right) => parseFeedDate(right.created_at).getTime() - parseFeedDate(left.created_at).getTime(),
    );
  }, [itemsForView, selectedSites]);

  const pinnedItems = useMemo(() => {
    return visibleItems
      .filter((item) => Boolean(item.pinned_at))
      .sort((left, right) => {
        const leftPinned = left.pinned_at ? parseFeedDate(left.pinned_at).getTime() : 0;
        const rightPinned = right.pinned_at ? parseFeedDate(right.pinned_at).getTime() : 0;
        return rightPinned - leftPinned;
      });
  }, [visibleItems]);

  const timelineItems = useMemo(() => visibleItems.filter((item) => !item.pinned_at), [visibleItems]);

  const weeks = useMemo<FeedWeekGroup[]>(() => {
    const buckets = new Map<string, FeedWeekGroup>();

    for (const item of timelineItems) {
      const meta = getWeekMetadata(item.created_at);
      const existing = buckets.get(meta.key);
      if (existing) {
        existing.items.push(item);
      } else {
        buckets.set(meta.key, {
          key: meta.key,
          weekNumber: meta.weekNumber,
          weekYear: meta.weekYear,
          start: meta.start,
          end: meta.end,
          items: [item],
        });
      }
    }

    return [...buckets.values()].sort((left, right) => right.start.getTime() - left.start.getTime());
  }, [timelineItems]);

  useEffect(() => {
    if (weeks.length === 0) {
      setActiveWeekKey(null);
      return;
    }

    setActiveWeekKey((current) => (current && weeks.some((week) => week.key === current) ? current : weeks[0].key));
  }, [weeks]);

  useEffect(() => {
    if (expandedWeekSummaryKey && !weeks.some((week) => week.key === expandedWeekSummaryKey)) {
      setExpandedWeekSummaryKey(null);
    }
    if (editingWeekSummaryKey && !weeks.some((week) => week.key === editingWeekSummaryKey)) {
      setEditingWeekSummaryKey(null);
      setWeekSummaryDraft('');
    }
  }, [editingWeekSummaryKey, expandedWeekSummaryKey, weeks]);

  const activeWeekIndex = weeks.findIndex((week) => week.key === activeWeekKey);
  const activeWeek = activeWeekIndex >= 0 ? weeks[activeWeekIndex] : weeks[0] || null;
  const activeWeekSummary = activeWeek ? weekSummaries[activeWeek.key] || null : null;
  const groupedItems = groupFeedItems(activeWeek?.items || []);
  const activeWeekSiteSummaries = useMemo<WeekSiteSummary[]>(() => {
    if (!activeWeek) {
      return [];
    }

    const taskMap = new Map<string, string[]>();
    const seenMap = new Map<string, Set<string>>();

    for (const item of activeWeek.items) {
      const matchedSites = getItemSiteMatches(item);
      for (const siteName of matchedSites) {
        const currentTasks = taskMap.get(siteName) || [];
        const seen = seenMap.get(siteName) || new Set<string>();
        const nextTasks = summarizeItemForSite(item, siteName);

        for (const task of nextTasks) {
          const normalized = task.toLowerCase();
          if (seen.has(normalized) || currentTasks.length >= 4) {
            continue;
          }
          seen.add(normalized);
          currentTasks.push(task);
        }

        taskMap.set(siteName, currentTasks);
        seenMap.set(siteName, seen);
      }
    }

    return FEED_LEGEND
      .map((entry) => entry.name)
      .filter((siteKey) => (taskMap.get(siteKey) || []).length > 0)
      .map((siteKey) => ({
        siteKey,
        siteLabel: getFeedSiteLabel(siteKey),
        tasks: taskMap.get(siteKey) || [],
      }));
  }, [activeWeek, items]);
  const generatedWeekSummaryVariants = useMemo(
    () =>
      weekSummaryStyles
        .map((style) => ({
          ...style,
          content: renderWeekSummaryVariant(style.id, activeWeekSiteSummaries),
        }))
        .filter((style) => style.content.trim().length > 0),
    [activeWeekSiteSummaries, weekSummaryStyles],
  );
  const selectedWeekSummaryStyle =
    generatedWeekSummaryVariants.find((style) => style.id === selectedWeekSummaryStyleId) || null;
  const renderFeedEntry = (item: FeedItem) => (
    <div
      key={item.id}
      id={getEntryAnchorId(item)}
      className={`${item.source === 'release' ? 'release-card' : ''} ${
        highlightedEntryId === item.id ? 'feed-entry--highlighted' : ''
      }`}
    >
      <div className="feed-card-head">
        <div className="feed-source-tag">
          {item.pinned_at && <Pin size={13} />}
          {getSourceIcon(item.source)}
          <span>{item.source}</span>
        </div>
        <div className="entry-head-actions">
          {isLoggedIn && isEditableItem(item) && (
            <div className="entry-actions">
              <button type="button" className="feed-link-button" onClick={() => handlePinToggle(item)} disabled={posting}>
                {item.pinned_at ? <PinOff size={12} /> : <Pin size={12} />}
                {item.pinned_at ? 'Unpin' : 'Pin'}
              </button>
              <button type="button" className="feed-link-button" onClick={() => handleEdit(item)}>
                <Pencil size={12} />
                Edit
              </button>
              <button type="button" className="feed-link-button feed-link-button--danger" onClick={() => handleDelete(item)}>
                <Trash2 size={12} />
                Delete
              </button>
            </div>
          )}
          <div className="feed-time">
            <Clock size={12} />
            <span>{formatDate(item.created_at)}</span>
            <button
              type="button"
              className="icon-link feed-share-button"
              onClick={() => handleShareEntry(item)}
              aria-label={`Share feed entry: ${item.title}`}
              title={copiedEntryId === item.id ? 'Copied link' : 'Share entry'}
            >
              <Share2 size={12} />
              <span className="share-label">{copiedEntryId === item.id ? 'Copied' : 'Share'}</span>
            </button>
          </div>
        </div>
      </div>

      <h3 className="entry-title">
        {item.url ? (
          <a href={item.url} target="_blank" rel="noreferrer" className="entry-title-link">
            {item.title}
          </a>
        ) : (
          item.title
        )}
      </h3>

      {item.content && (
        <div
          className="feed-html"
          dangerouslySetInnerHTML={{ __html: formatFeedContentHtml(item) }}
        />
      )}
    </div>
  );

  const renderCompactTintPicker = () => (
    <div className="compact-tint-picker" ref={tintPickerRef}>
      <label className="field-label" htmlFor="feed-tint-trigger">
        Color
      </label>
      <button
        id="feed-tint-trigger"
        type="button"
        className={`compact-tint-trigger ${newPost.tintColor ? 'compact-tint-trigger--active' : ''}`}
        onClick={() => setShowTintPicker((current) => !current)}
        aria-expanded={showTintPicker}
        aria-haspopup="dialog"
        title={newPost.tintColor ? `Selected tint: ${ENTRY_TINT_OPTIONS.find((option) => option.value === newPost.tintColor)?.label || 'Custom'}` : 'Choose entry tint'}
      >
        <span
          className="compact-tint-trigger-chip"
          style={{ backgroundColor: newPost.tintColor || 'rgba(255, 255, 255, 0.92)' }}
        />
        <SwatchBook size={14} />
      </button>

      {showTintPicker && (
        <div className="compact-tint-popover" role="dialog" aria-label="Entry tint colors">
          <div className="compact-tint-grid">
            {ENTRY_TINT_OPTIONS.map((option) => {
              const isSelected = newPost.tintColor === option.value;
              return (
                <button
                  key={option.label}
                  type="button"
                  className={`compact-tint-swatch ${isSelected ? 'compact-tint-swatch--active' : ''}`}
                  onClick={() => {
                    setNewPost({ ...newPost, tintColor: option.value });
                    setShowTintPicker(false);
                  }}
                  aria-pressed={isSelected}
                  title={option.label}
                >
                  <span
                    className="compact-tint-swatch-chip"
                    style={{ backgroundColor: option.value || 'rgba(255, 255, 255, 0.92)' }}
                  />
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  useEffect(() => {
    if (loading || items.length === 0 || typeof window === 'undefined') {
      return;
    }

    const hashMatch = window.location.hash.match(/^#entry-(\d+)$/);
    if (!hashMatch) {
      return;
    }

    const entryId = Number(hashMatch[1]);
    const item = items.find((candidate) => candidate.id === entryId);
    if (!item) {
      return;
    }

    if (!item.pinned_at) {
      const targetWeek = getWeekMetadata(item.created_at).key;
      if (targetWeek !== activeWeekKey) {
        setActiveWeekKey(targetWeek);
        return;
      }
    }

    window.setTimeout(() => {
      const element = document.getElementById(getEntryAnchorId(item));
      if (!element) {
        return;
      }

      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightedEntryId(item.id);
      window.setTimeout(() => {
        setHighlightedEntryId((current) => (current === item.id ? null : current));
      }, 2600);
    }, 100);
  }, [activeWeekKey, items, loading]);

  return (
    <div className="feed-shell">
      <header className="feed-topbar">
        <div>
          <button type="button" className="feed-title-button" onClick={handleResetPage}>
            <h1 className="feed-title">Feed</h1>
          </button>
        </div>
      </header>

      <AnimatePresence>
        {showLogin && (
          <div className="modal-scrim">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              className="modal-card"
            >
              <div className="modal-header">
                <h2>Editor Login</h2>
                <button type="button" className="feed-link-button" onClick={() => setShowLogin(false)}>
                  Close
                </button>
              </div>

              <form className="stack-form" onSubmit={handleLoginSubmit}>
                <p className="helper-copy">
                  Use the feed secret to post release notes, milestones, and manual log entries.
                </p>
                <label className="field-label" htmlFor="feed-password">
                  Secret
                </label>
                <input
                  id="feed-password"
                  type="password"
                  required
                  autoFocus
                  value={passwordInput}
                  onChange={(event) => setPasswordInput(event.target.value)}
                  className="feed-input"
                  placeholder="Enter your feed secret"
                />

                {authError && (
                  <div className="error-inline">
                    <AlertCircle size={14} />
                    <span>{authError}</span>
                  </div>
                )}

                <button type="submit" className="feed-button feed-button--primary">
                  Authenticate
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {showLegend && (
          <div className="modal-scrim" onClick={() => setShowLegend(false)}>
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 18 }}
              className="modal-card modal-card--legend"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-header">
                <h2>Legend</h2>
                <button type="button" className="feed-link-button" onClick={() => setShowLegend(false)}>
                  Close
                </button>
              </div>

              <div className="legend-list" role="list">
                {FEED_LEGEND.map((entry) => {
                  const count = siteCountMap.get(entry.name) || 0;
                  const isSelected = selectedSites.includes(entry.name);

                  return (
                    <label
                      key={entry.name}
                      className={`legend-row ${count === 0 && !isSelected ? 'legend-row--disabled' : ''}`}
                      role="listitem"
                    >
                      <span className="legend-checkbox-wrap">
                        <input
                          type="checkbox"
                          className="legend-checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectedSite(entry.name)}
                          disabled={count === 0 && !isSelected}
                        />
                      </span>
                      <span className="legend-copy">
                        <span className="legend-name">
                          <a
                            href={FEED_LEGEND_LINKS[entry.name] || 'https://github.com/wmjefferson'}
                            target="_blank"
                            rel="noreferrer"
                            className="legend-name-link"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {entry.name}
                          </a>
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className="legend-actions">
                <button
                  type="button"
                  className="feed-link-button legend-clear-button"
                  onClick={() => setSelectedSites([])}
                  disabled={selectedSites.length === 0}
                >
                  Clear
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="feed-main">
        {showSetup && isLoggedIn && (
          <motion.section
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            className="feed-card feed-card--muted"
          >
            <h2>Automation Setup</h2>
            <div className="setup-grid">
                <div>
                  <h3>GitHub</h3>
                  <p>The server pulls your public GitHub activity into the timeline and keeps it in sync on an interval.</p>
                </div>
                <div>
                  <h3>Release notes</h3>
                <p>
                  Use the <strong>Release</strong> compose type for semantic version updates. Each line in the
                  highlights box becomes a bullet in the stream and also appears in the dedicated changelog view.
                </p>
              </div>
              <div>
                <h3>Manual logs</h3>
                <p>Use log, thought, milestone, or release entries when you want to annotate the public timeline.</p>
              </div>
            </div>
          </motion.section>
        )}

        <section className="feed-hero">
          <div>
            <p className="hero-copy">
              Version notes, public logs, and code movement in one running line. Release notes and status changes land
              in the same chronology.
            </p>
            <button type="button" className="hero-copy feed-subtitle-link" onClick={() => setShowLegend(true)}>
              Legend.
            </button>
            <div className="feed-view-switcher" role="tablist" aria-label="Feed views">
              <button
                type="button"
                className={`feed-pill ${view === 'all' ? 'feed-pill--active' : ''}`}
                onClick={() => setView('all')}
                aria-pressed={view === 'all'}
              >
                Full Feed
                <span>{items.length}</span>
              </button>
              <button
                type="button"
                className={`feed-pill ${view === 'releases' ? 'feed-pill--active' : ''}`}
                onClick={() => setView('releases')}
                aria-pressed={view === 'releases'}
              >
                Changelog
                <span>{releaseCount}</span>
              </button>
              <button
                type="button"
                className={`feed-pill ${view === 'manual' ? 'feed-pill--active' : ''}`}
                onClick={() => setView('manual')}
                aria-pressed={view === 'manual'}
              >
                Manual
                <span>{manualCount}</span>
              </button>
            </div>
            {selectedSites.length > 0 && (
              <div className="selected-site-row" aria-label="Selected site filters">
                {selectedSites.map((siteName) => (
                  <button
                    key={siteName}
                    type="button"
                    className="selected-site-chip"
                    onClick={() => toggleSelectedSite(siteName)}
                    aria-label={`Remove ${siteName} site filter`}
                  >
                    <span>{siteName}</span>
                    <span className="selected-site-chip-close">x</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="feed-hero-actions">
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => setShowSetup((current) => !current)}
                className="feed-button"
              >
                <Code size={14} />
                Setup
              </button>
            )}
            {isLoggedIn && (
              <button
                type="button"
                onClick={() => setShowCompose((current) => !current)}
                className="feed-button"
              >
                {showCompose ? 'Cancel' : 'Add Entry'}
              </button>
            )}
            <button
              type="button"
              onClick={handleManualRefresh}
              disabled={refreshing || loading}
              className="feed-button feed-button--primary"
            >
              <RefreshCw size={14} className={refreshing ? 'spin' : ''} />
              {refreshing ? 'Syncing' : 'Sync GitHub'}
            </button>
            <a href={FEED_ATOM_URL} target="_blank" rel="noreferrer" className="feed-button">
              <FileText size={14} />
              Atom Feed
            </a>
            <button
              type="button"
              onClick={isLoggedIn ? handleLogout : () => setShowLogin(true)}
              className="feed-button"
            >
              {isLoggedIn ? 'Log Out' : 'Editor Login'}
            </button>
          </div>
        </section>

        {pinnedItems.length > 0 && (
          <section className="pinned-stack" aria-label="Pinned feed entries">
            <div className="pinned-stack-head">
              <span className="eyebrow">Pinned</span>
              <span className="pinned-count">{pinnedItems.length}</span>
            </div>
            <div className="timeline">
              {pinnedItems.map((item) => (
                <motion.article
                  key={`pinned-${item.id}`}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`feed-card feed-card--pinned ${item.tint_color ? 'feed-card--tinted' : ''}`}
                  style={getEntryTintStyle(item)}
                >
                  {renderFeedEntry(item)}
                </motion.article>
              ))}
            </div>
          </section>
        )}

        <section className="feed-weekbar feed-card">
          <div className="feed-weekbar-head">
            <div className="feed-weekbar-copy">
              <span className="eyebrow">Calendar Week</span>
              {activeWeek ? (
                <>
                  <h2 className="feed-week-title">Week {activeWeek.weekNumber}, {activeWeek.weekYear}</h2>
                  <p className="feed-week-range">
                    {formatWeekRange(activeWeek.start, activeWeek.end)} · {activeWeek.items.length} entr{activeWeek.items.length === 1 ? 'y' : 'ies'}
                  </p>
                  <button
                    type="button"
                    className="feed-link-button feed-week-summary-link"
                    onClick={() => {
                      const isExpanded = expandedWeekSummaryKey === activeWeek.key;
                      setExpandedWeekSummaryKey(isExpanded ? null : activeWeek.key);
                      if (isExpanded) {
                        setEditingWeekSummaryKey(null);
                        setWeekSummaryDraft('');
                      }
                    }}
                  >
                    {expandedWeekSummaryKey === activeWeek.key
                      ? 'Hide Summary'
                      : activeWeekSummary
                        ? 'View Summary'
                        : isLoggedIn
                          ? 'Add Summary'
                          : 'Summary'}
                  </button>
                </>
              ) : (
                <>
                  <h2 className="feed-week-title">No entries yet</h2>
                  <p className="feed-week-range">Once the stream has posts, they will be grouped here by calendar week.</p>
                </>
              )}
            </div>

            <div className="feed-weekbar-actions">
              <button
                type="button"
                className="feed-button"
                onClick={() => {
                  if (activeWeekIndex >= 0 && activeWeekIndex < weeks.length - 1) {
                    setExpandedWeekSummaryKey(null);
                    setEditingWeekSummaryKey(null);
                    setWeekSummaryDraft('');
                    setActiveWeekKey(weeks[activeWeekIndex + 1].key);
                  }
                }}
                disabled={activeWeekIndex === -1 || activeWeekIndex >= weeks.length - 1}
              >
                Prev Week
              </button>
              <button
                type="button"
                className="feed-button"
                onClick={() => {
                  if (activeWeekIndex > 0) {
                    setExpandedWeekSummaryKey(null);
                    setEditingWeekSummaryKey(null);
                    setWeekSummaryDraft('');
                    setActiveWeekKey(weeks[activeWeekIndex - 1].key);
                  }
                }}
                disabled={activeWeekIndex <= 0}
              >
                Next Week
              </button>
            </div>
          </div>

          <AnimatePresence initial={false}>
            {activeWeek && expandedWeekSummaryKey === activeWeek.key && (
              <motion.div
                key={activeWeek.key}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="feed-week-summary-panel"
              >
                <div className="feed-week-summary-copy">
                  <span className="eyebrow">Weekly TL;DR</span>
                  {editingWeekSummaryKey === activeWeek.key ? (
                    <>
                      <p className="helper-copy">Keep this short and readable. A few sentences is enough.</p>
                      <div className="feed-week-summary-generator">
                        {weekSummaryStyles.length > 0 && (
                          <div className="feed-week-summary-generator-head">
                            <label className="field-label" htmlFor="feed-week-summary-style">
                              Generated Style
                            </label>
                            <p className="helper-copy feed-week-summary-generator-copy">
                              Choose a summary style and it will load into the editor below for rewriting.
                            </p>
                          </div>
                        )}
                        {weekSummaryStyles.length > 0 ? (
                          generatedWeekSummaryVariants.length > 0 ? (
                            <>
                              <select
                                id="feed-week-summary-style"
                                className="feed-input"
                                value={selectedWeekSummaryStyleId}
                                onChange={(event) => handleWeekSummaryStyleChange(event.target.value)}
                              >
                                <option value="">Select a generated style</option>
                                {generatedWeekSummaryVariants.map((style) => (
                                  <option key={style.id} value={style.id}>
                                    {style.label}
                                  </option>
                                ))}
                              </select>
                              {selectedWeekSummaryStyle?.purpose && (
                                <p className="helper-copy feed-week-summary-generator-copy">
                                  {selectedWeekSummaryStyle.purpose}
                                </p>
                              )}
                            </>
                          ) : (
                            <p className="helper-copy">No generated weekly summary is available for this week yet.</p>
                          )
                        ) : null}
                        <textarea
                          className="feed-textarea feed-week-summary-input"
                          value={weekSummaryDraft}
                          onChange={(event) => setWeekSummaryDraft(event.target.value)}
                          placeholder="Briefly summarize what changed this week, what mattered, and where the work is heading."
                        />
                      </div>
                    </>
                  ) : activeWeekSummary ? (
                    <div
                      className="feed-html feed-week-summary-body"
                      dangerouslySetInnerHTML={{ __html: formatMarkdownHtml(activeWeekSummary.content) }}
                    />
                  ) : (
                    <p className="helper-copy">No weekly summary.</p>
                  )}
                </div>

                {isLoggedIn && (
                  <div className="feed-week-summary-actions">
                    {editingWeekSummaryKey === activeWeek.key ? (
                      <>
                        <button type="button" className="feed-link-button" onClick={handleSaveWeekSummary} disabled={posting}>
                          {posting ? 'Saving' : 'Save Summary'}
                        </button>
                        <button type="button" className="feed-link-button" onClick={handleCancelWeekSummaryEdit} disabled={posting}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" className="feed-link-button" onClick={handleEditWeekSummary}>
                        {activeWeekSummary ? 'Edit Summary' : 'Write Summary'}
                      </button>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        <AnimatePresence>
          {showCompose && isLoggedIn && (
            <motion.section
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="feed-card composer-card"
            >
              <form className="stack-form" onSubmit={handlePost}>
                <div className="composer-head">
                  <div>
                    <span className="eyebrow">{editingItemId !== null ? 'Edit Entry' : 'Add Entry'}</span>
                    <p className="helper-copy">
                      {editingItemId !== null
                        ? 'Update this manual or changelog entry in place.'
                        : 'Release entries are designed to sit chronologically beside the GitHub feed.'}
                    </p>
                  </div>
                  <button type="button" className="feed-link-button" onClick={resetComposer}>
                    Cancel
                  </button>
                </div>

                {newPost.source === 'release' ? (
                  <>
                    <div className="form-row">
                      <div>
                        <label className="field-label" htmlFor="feed-publish-at">
                          Publish Date
                        </label>
                        <input
                          id="feed-publish-at"
                          type="date"
                          className="feed-input"
                          value={newPost.publishAt}
                          onChange={(event) => setNewPost({ ...newPost, publishAt: event.target.value })}
                        />
                      </div>

                      {renderCompactTintPicker()}

                      <div>
                        <label className="field-label" htmlFor="feed-release-app">
                          App / Site
                        </label>
                        <input
                          id="feed-release-app"
                          className="feed-input"
                          value={newPost.appName}
                          onChange={(event) => setNewPost({ ...newPost, appName: event.target.value })}
                          placeholder="Perihelion"
                          required
                        />
                      </div>

                      <div>
                        <label className="field-label" htmlFor="feed-release-version">
                          Version
                        </label>
                        <input
                          id="feed-release-version"
                          className="feed-input"
                          value={newPost.version}
                          onChange={(event) => setNewPost({ ...newPost, version: event.target.value })}
                          placeholder="0.4.0"
                          required
                        />
                      </div>
                    </div>

                    <div>
                      <label className="field-label" htmlFor="feed-release-highlights">
                        What&apos;s New
                      </label>
                      <textarea
                        id="feed-release-highlights"
                        className="feed-textarea"
                        value={newPost.highlights}
                        onChange={(event) => setNewPost({ ...newPost, highlights: event.target.value })}
                        placeholder={`Added central auth support\nImproved archive loading\nCleaned up mobile spacing`}
                        required
                      />
                    </div>
                  </>
                ) : (
                  <>
                    <div className="form-row form-row--title-date">
                      <div>
                        <label className="field-label" htmlFor="feed-title-input">
                          Title
                        </label>
                        <input
                          id="feed-title-input"
                          className="feed-input"
                          value={newPost.title}
                          onChange={(event) => setNewPost({ ...newPost, title: event.target.value })}
                          placeholder="What changed?"
                          required
                        />
                      </div>

                      <div>
                        <label className="field-label" htmlFor="feed-publish-at">
                          Publish Date
                        </label>
                        <input
                          id="feed-publish-at"
                          type="date"
                          className="feed-input"
                          value={newPost.publishAt}
                          onChange={(event) => setNewPost({ ...newPost, publishAt: event.target.value })}
                        />
                      </div>

                      {renderCompactTintPicker()}
                    </div>

                    <div>
                      <label className="field-label" htmlFor="feed-content-input">
                        Notes
                      </label>
                      <div className="rich-composer">
                        <div className="rich-editor-bar">
                          <div className="rich-editor-tabs" role="tablist" aria-label="Manual entry mode">
                            <button
                              type="button"
                              className={`rich-editor-tab ${richEditorTab === 'write' ? 'rich-editor-tab--active' : ''}`}
                              onClick={() => handleRichEditorTabChange('write')}
                              role="tab"
                              aria-selected={richEditorTab === 'write'}
                              aria-controls="feed-content-input"
                            >
                              Write
                            </button>
                            <button
                              type="button"
                              className={`rich-editor-tab ${richEditorTab === 'preview' ? 'rich-editor-tab--active' : ''}`}
                              onClick={() => handleRichEditorTabChange('preview')}
                              role="tab"
                              aria-selected={richEditorTab === 'preview'}
                              aria-controls="feed-content-preview"
                            >
                              Preview
                            </button>
                          </div>

                          <div className="rich-toolbar" aria-label="Manual entry rich text tools">
                            <button
                              type="button"
                              className="rich-tool"
                              onClick={() => insertMarkdownBlock('## ', 'Heading')}
                              disabled={richEditorTab === 'preview'}
                              aria-label="Heading"
                            >
                              H
                            </button>
                            <button
                              type="button"
                              className="rich-tool"
                              onClick={() => insertMarkdownWrap('**', '**', 'bold text')}
                              disabled={richEditorTab === 'preview'}
                              aria-label="Bold"
                            >
                              B
                            </button>
                            <button
                              type="button"
                              className="rich-tool rich-tool--italic"
                              onClick={() => insertMarkdownWrap('_', '_', 'italic text')}
                              disabled={richEditorTab === 'preview'}
                              aria-label="Italic"
                            >
                              I
                            </button>
                            <button
                              type="button"
                              className="rich-tool"
                              onClick={() => insertMarkdownBlock('- ', 'List item')}
                              disabled={richEditorTab === 'preview'}
                            >
                              List
                            </button>
                            <button
                              type="button"
                              className="rich-tool"
                              onClick={() => insertMarkdownBlock('1. ', 'List item')}
                              disabled={richEditorTab === 'preview'}
                            >
                              1.2
                            </button>
                            <button
                              type="button"
                              className="rich-tool"
                              onClick={() => insertMarkdownBlock('> ', 'Quote')}
                              disabled={richEditorTab === 'preview'}
                            >
                              Quote
                            </button>
                            <button
                              type="button"
                              className="rich-tool"
                              onClick={() => insertMarkdownWrap('`', '`', 'code')}
                              disabled={richEditorTab === 'preview'}
                            >
                              Code
                            </button>
                            <button type="button" className="rich-tool" onClick={handleRichLink} disabled={richEditorTab === 'preview'}>
                              Link
                            </button>
                            <button
                              type="button"
                              className="rich-tool"
                              onClick={() => imageInputRef.current?.click()}
                              disabled={uploadingAttachment || richEditorTab === 'preview'}
                            >
                              Image
                            </button>
                            <button
                              type="button"
                              className="rich-tool"
                              onClick={() => attachmentInputRef.current?.click()}
                              disabled={uploadingAttachment || richEditorTab === 'preview'}
                            >
                              File
                            </button>
                          </div>
                          <input
                            ref={imageInputRef}
                            className="rich-file-input"
                            type="file"
                            accept="image/*"
                            multiple
                            onChange={(event) => handleRichFileUpload(event, 'image')}
                          />
                          <input
                            ref={attachmentInputRef}
                            className="rich-file-input"
                            type="file"
                            multiple
                            onChange={(event) => handleRichFileUpload(event, 'attachment')}
                          />
                        </div>

                        {richEditorTab === 'write' ? (
                          <div
                            className="rich-editor-surface"
                            role="tabpanel"
                          >
                            <textarea
                              id="feed-content-input"
                              ref={markdownInputRef}
                              className="markdown-editor-textarea"
                              value={newPost.content}
                              onChange={(event) => setNewPost((current) => ({ ...current, content: event.target.value }))}
                              placeholder="Use Markdown to format your feed entry"
                              aria-label="Manual entry notes"
                            />
                          </div>
                        ) : (
                          <div
                            id="feed-content-preview"
                            className="rich-preview-surface feed-html"
                            role="tabpanel"
                            dangerouslySetInnerHTML={{
                              __html: newPost.content.trim()
                                ? formatMarkdownHtml(newPost.content)
                                : '<p class="rich-preview-empty">Nothing to preview yet.</p>',
                            }}
                          />
                        )}
                        {uploadingAttachment && <p className="rich-upload-status">Uploading file...</p>}
                      </div>
                    </div>
                  </>
                )}

                <div className="composer-actions">
                  <button type="submit" className="feed-link-button" disabled={posting}>
                    {posting ? (editingItemId !== null ? 'Saving' : 'Posting') : editingItemId !== null ? 'Save Changes' : 'Post to Feed'}
                  </button>
                </div>
              </form>
            </motion.section>
          )}
        </AnimatePresence>

        {error && (
          <div className="feed-card error-card">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        )}

        {loading ? (
          <div className="timeline">
            {[1, 2, 3].map((item) => (
              <div key={item} className="feed-card feed-card--loading" />
            ))}
          </div>
        ) : (
          <section className="timeline">
            <AnimatePresence initial={false}>
              {groupedItems.length === 0 ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="feed-card empty-card">
                  <p>
                    {selectedSites.length > 0
                      ? 'No entries match the selected sites right now.'
                      : view === 'releases'
                      ? 'No release notes yet.'
                      : view === 'manual'
                        ? 'No manual entries yet.'
                        : 'The stream is quiet right now.'}
                  </p>
                </motion.div>
              ) : (
                groupedItems.map((group) => (
                  <motion.article
                    key={group.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    className={`feed-card ${group.repo ? 'feed-card--github' : ''} ${
                      !group.repo && group.items[0]?.tint_color ? 'feed-card--tinted' : ''
                    }`}
                    style={!group.repo ? getEntryTintStyle(group.items[0]) : undefined}
                  >
                    {group.repo ? (
                      <div>
                        <div className="feed-card-head">
                          <div className="feed-source-tag">
                            {getSourceIcon(group.source)}
                            <span>{group.repo}</span>
                          </div>
                          <div className="feed-time">
                            <Clock size={12} />
                            <span>{formatDate(group.created_at)}</span>
                          </div>
                        </div>
                        <div className="subfeed-list">
                          <div className="subfeed-item">
                            <div className="subfeed-head">
                              <h3>
                                {group.items.length > 1 ? (
                                  <button
                                    type="button"
                                    className="github-group-toggle"
                                    onClick={() => toggleExpandedGitHubGroup(group.id)}
                                    aria-expanded={expandedGitHubGroups.includes(group.id)}
                                  >
                                    <span>
                                      {cleanGitHubTitle(group.items[0].title, group.repo || '')} ({group.items.length})
                                    </span>
                                    {expandedGitHubGroups.includes(group.id) ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                                  </button>
                                ) : group.items[0].url ? (
                                  <a href={group.items[0].url} target="_blank" rel="noreferrer" className="entry-title-link">
                                    {cleanGitHubTitle(group.items[0].title, group.repo || '')}
                                  </a>
                                ) : (
                                  <>{cleanGitHubTitle(group.items[0].title, group.repo || '')}</>
                                )}
                              </h3>
                              <div className="feed-time">
                                <span>{formatDate(group.items[0].created_at)}</span>
                                {group.items[0].url && (
                                  <a href={group.items[0].url} target="_blank" rel="noreferrer" className="icon-link">
                                    <ExternalLink size={12} />
                                  </a>
                                )}
                              </div>
                            </div>

                            {group.items.length > 1 ? (
                              <>
                                <p className="group-summary">
                                  {group.items.length} similar entries combined from{' '}
                                  {formatDate(group.items[group.items.length - 1].created_at)} to {formatDate(group.items[0].created_at)}.
                                </p>
                                <AnimatePresence initial={false}>
                                  {expandedGitHubGroups.includes(group.id) && (
                                    <motion.div
                                      initial={{ opacity: 0, height: 0 }}
                                      animate={{ opacity: 1, height: 'auto' }}
                                      exit={{ opacity: 0, height: 0 }}
                                      transition={{ duration: 0.18 }}
                                      className="github-group-list"
                                    >
                                      {group.items.map((entry) => (
                                        <div key={entry.id} className="github-group-list-item">
                                          <div className="github-group-list-title">
                                            {entry.url ? (
                                              <a href={entry.url} target="_blank" rel="noreferrer" className="entry-title-link">
                                                {cleanGitHubTitle(entry.title, group.repo || '')}
                                              </a>
                                            ) : (
                                              <span>{cleanGitHubTitle(entry.title, group.repo || '')}</span>
                                            )}
                                            {getGitHubEntryDetail(entry) && (
                                              <span className="github-group-list-detail"> — {getGitHubEntryDetail(entry)}</span>
                                            )}
                                          </div>
                                          <div className="feed-time github-group-list-time">
                                            <span>{formatDate(entry.created_at)}</span>
                                            {entry.url && (
                                              <a href={entry.url} target="_blank" rel="noreferrer" className="icon-link">
                                                <ExternalLink size={12} />
                                              </a>
                                            )}
                                          </div>
                                        </div>
                                      ))}
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </>
                            ) : (
                              group.items[0].content && (
                                <div
                                  className="feed-html"
                                  dangerouslySetInnerHTML={{ __html: formatFeedContentHtml(group.items[0]) }}
                                />
                              )
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      group.items.map((item) => renderFeedEntry(item))
                    )}
                  </motion.article>
                ))
              )}
            </AnimatePresence>
          </section>
        )}
      </main>
    </div>
  );
}
