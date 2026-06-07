import { FormEvent, useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  AlertCircle,
  Briefcase,
  Clock,
  Code,
  ExternalLink,
  FileText,
  Github,
  Info,
  Linkedin,
  MessageSquare,
  RefreshCw,
  Trophy,
} from 'lucide-react';

type FeedView = 'all' | 'releases';

interface FeedItem {
  id: number;
  title: string;
  content: string | null;
  url: string | null;
  source: string;
  created_at: string;
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

interface PostFormState {
  title: string;
  content: string;
  source: string;
  url: string;
  appName: string;
  version: string;
  highlights: string;
}

const inferredFeedApiBase =
  typeof window !== 'undefined' && /(^|\.)jeffersonwm\.com$/i.test(window.location.hostname)
    ? 'https://api-feed.jeffersonwm.com'
    : '';
const FEED_API_BASE = (import.meta.env.VITE_API_BASE_URL || inferredFeedApiBase).replace(/\/$/, '');
const FEED_TIMEZONE = 'America/Los_Angeles';
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
const feedPacificDatePartsFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: FEED_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
const feedWeekRangeFormatter = new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC',
  month: 'short',
  day: 'numeric',
});
const defaultPostState = (): PostFormState => ({
  title: '',
  content: '',
  source: 'log',
  url: '',
  appName: '',
  version: '',
  highlights: '',
});

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

function formatWeekRange(start: Date, end: Date) {
  return `${feedWeekRangeFormatter.format(start)} – ${feedWeekRangeFormatter.format(end)}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function normalizeVersion(value: string) {
  return value.trim().replace(/^v\.?/i, '');
}

function buildReleaseTitle(appName: string, version: string) {
  const normalizedVersion = normalizeVersion(version);
  const trimmedAppName = appName.trim();
  return normalizedVersion ? `${trimmedAppName} v${normalizedVersion}` : trimmedAppName;
}

function formatParagraphHtml(value: string) {
  const blocks = value
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);

  return blocks
    .map((block) => `<p>${escapeHtml(block).replace(/\n/g, '<br />')}</p>`)
    .join('');
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

export default function App() {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [view, setView] = useState<FeedView>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSetup, setShowSetup] = useState(false);
  const [showCompose, setShowCompose] = useState(false);
  const [secretInput, setSecretInput] = useState(localStorage.getItem('feed_secret') || '');
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('feed_secret_verified') === 'true');
  const [showLogin, setShowLogin] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [newPost, setNewPost] = useState<PostFormState>(defaultPostState);
  const [posting, setPosting] = useState(false);
  const [activeWeekKey, setActiveWeekKey] = useState<string | null>(null);

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
  };

  const handlePost = async (event: FormEvent) => {
    event.preventDefault();

    const isRelease = newPost.source === 'release';
    const resolvedTitle = isRelease
      ? buildReleaseTitle(newPost.appName, newPost.version)
      : newPost.title.trim();
    const resolvedContent = isRelease
      ? formatReleaseHtml(newPost.highlights)
      : formatParagraphHtml(newPost.content);

    if (!resolvedTitle) {
      setError(isRelease ? 'App name and version are required for release notes.' : 'Title is required.');
      return;
    }

    setPosting(true);
    setError(null);

    try {
      const response = await fetch(apiUrl('/api/feed'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: resolvedTitle,
          content: resolvedContent || null,
          url: newPost.url || null,
          source: newPost.source,
          secret: secretInput,
          external_id: `${newPost.source}-${Date.now()}`,
        }),
      });

      if (response.status === 401) {
        throw new Error('Invalid secret');
      }

      if (!response.ok) {
        throw new Error('Failed to post');
      }

      setNewPost(defaultPostState());
      setShowCompose(false);
      await fetchFeed();
    } catch (err: any) {
      setError(err.message || 'Failed to create entry');
    } finally {
      setPosting(false);
    }
  };

  useEffect(() => {
    fetchFeed();
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
    return `${feedDateFormatter.format(date)}, ${feedTimeFormatter.format(date)}`;
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
  const visibleItems = useMemo(() => {
    const filtered = view === 'releases' ? items.filter(isReleaseItem) : items;
    return [...filtered].sort(
      (left, right) => parseFeedDate(right.created_at).getTime() - parseFeedDate(left.created_at).getTime(),
    );
  }, [items, view]);

  const weeks = useMemo<FeedWeekGroup[]>(() => {
    const buckets = new Map<string, FeedWeekGroup>();

    for (const item of visibleItems) {
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
  }, [visibleItems]);

  useEffect(() => {
    if (weeks.length === 0) {
      setActiveWeekKey(null);
      return;
    }

    setActiveWeekKey((current) => (current && weeks.some((week) => week.key === current) ? current : weeks[0].key));
  }, [weeks]);

  const activeWeekIndex = weeks.findIndex((week) => week.key === activeWeekKey);
  const activeWeek = activeWeekIndex >= 0 ? weeks[activeWeekIndex] : weeks[0] || null;
  const groupedItems = groupFeedItems(activeWeek?.items || []);

  return (
    <div className="feed-shell">
      <header className="feed-topbar">
        <div>
          <a className="feed-backlink" href="https://jeffersonwm.com" rel="noreferrer">
            JeffersonWM
          </a>
          <h1 className="feed-title">Feed</h1>
          <p className="feed-subtitle">Version notes, public logs, and code movement in one running line.</p>
        </div>

        <div className="feed-toolbar">
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

          <button
            type="button"
            onClick={isLoggedIn ? handleLogout : () => setShowLogin(true)}
            className="feed-button"
          >
            {isLoggedIn ? 'Log Out' : 'Editor Login'}
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
                <p>The server can pull your GitHub Atom feed on an interval and keep the stream up to date.</p>
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
            <span className="eyebrow">Timeline</span>
            <p className="hero-copy">
              This page is meant to sit alongside the GitHub feed, not beneath it. Release notes and status changes land
              in the same chronology.
            </p>
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
            </div>
          </div>
          <div className="feed-hero-actions">
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
          </div>
        </section>

        <section className="feed-weekbar feed-card">
          <div className="feed-weekbar-copy">
            <span className="eyebrow">Calendar Week</span>
            {activeWeek ? (
              <>
                <h2 className="feed-week-title">Week {activeWeek.weekNumber}, {activeWeek.weekYear}</h2>
                <p className="feed-week-range">
                  {formatWeekRange(activeWeek.start, activeWeek.end)} · {activeWeek.items.length} entr{activeWeek.items.length === 1 ? 'y' : 'ies'}
                </p>
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
                  setActiveWeekKey(weeks[activeWeekIndex - 1].key);
                }
              }}
              disabled={activeWeekIndex <= 0}
            >
              Next Week
            </button>
          </div>
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
                <div className="form-row">
                  <div>
                    <label className="field-label" htmlFor="feed-source">
                      Type
                    </label>
                    <select
                      id="feed-source"
                      className="feed-input"
                      value={newPost.source}
                      onChange={(event) => setNewPost({ ...newPost, source: event.target.value })}
                    >
                      <option value="log">Log</option>
                      <option value="thought">Thought</option>
                      <option value="milestone">Milestone</option>
                      <option value="release">Release</option>
                      <option value="handshake">Handshake</option>
                      <option value="linkedin">LinkedIn</option>
                    </select>
                  </div>

                  <div>
                    <label className="field-label" htmlFor="feed-url">
                      Link
                    </label>
                    <input
                      id="feed-url"
                      className="feed-input"
                      value={newPost.url}
                      onChange={(event) => setNewPost({ ...newPost, url: event.target.value })}
                      placeholder="Optional source URL"
                    />
                  </div>
                </div>

                {newPost.source === 'release' ? (
                  <>
                    <div className="form-row">
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
                      <label className="field-label" htmlFor="feed-content-input">
                        Notes
                      </label>
                      <textarea
                        id="feed-content-input"
                        className="feed-textarea"
                        value={newPost.content}
                        onChange={(event) => setNewPost({ ...newPost, content: event.target.value })}
                        placeholder="Write a short public note."
                      />
                    </div>
                  </>
                )}

                <div className="composer-actions">
                  <p className="helper-copy">Release entries are designed to sit chronologically beside the GitHub feed.</p>
                  <button type="submit" className="feed-button feed-button--primary" disabled={posting}>
                    {posting ? 'Posting' : 'Post to Feed'}
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
                  <p>{view === 'releases' ? 'No release notes yet.' : 'The stream is quiet right now.'}</p>
                </motion.div>
              ) : (
                groupedItems.map((group) => (
                  <motion.article
                    key={group.id}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 16 }}
                    className={`feed-card ${group.repo ? 'feed-card--github' : ''}`}
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
                          {group.items.map((subItem, index) => (
                            <div key={subItem.id} className={index > 0 ? 'subfeed-item subfeed-item--stacked' : 'subfeed-item'}>
                              <div className="subfeed-head">
                                <h3>{cleanGitHubTitle(subItem.title, group.repo || '')}</h3>
                                <div className="feed-time">
                                  <span>{formatDate(subItem.created_at)}</span>
                                  {subItem.url && (
                                    <a href={subItem.url} target="_blank" rel="noreferrer" className="icon-link">
                                      <ExternalLink size={12} />
                                    </a>
                                  )}
                                </div>
                              </div>

                              {subItem.content && (
                                <div
                                  className="feed-html"
                                  dangerouslySetInnerHTML={{ __html: subItem.content }}
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      group.items.map((item) => (
                        <div key={item.id} className={item.source === 'release' ? 'release-card' : ''}>
                          <div className="feed-card-head">
                            <div className="feed-source-tag">
                              {getSourceIcon(item.source)}
                              <span>{item.source}</span>
                            </div>
                            <div className="feed-time">
                              <Clock size={12} />
                              <span>{formatDate(item.created_at)}</span>
                            </div>
                          </div>

                          <h3 className="entry-title">{item.title}</h3>

                          {item.content && (
                            <div
                              className="feed-html"
                              dangerouslySetInnerHTML={{ __html: item.content }}
                            />
                          )}

                          {item.url && (
                            <a href={item.url} target="_blank" rel="noreferrer" className="entry-link">
                              View source
                              <ExternalLink size={12} />
                            </a>
                          )}
                        </div>
                      ))
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
