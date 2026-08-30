import express from "express";
import { existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import { mkdir, readdir, readFile, stat, writeFile } from "fs/promises";
import mysql from "mysql2/promise";
import cors from "cors";
import dotenv from "dotenv";
import Parser from "rss-parser";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT || "8050");
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || `http://localhost:${PORT}`;
const UPLOAD_DIR = process.env.FEED_UPLOAD_DIR || path.join(process.cwd(), "uploads", "feed");
const parser = new Parser();
const CHANGELOG_SOURCE_URLS = (process.env.CHANGELOG_SOURCE_URLS || "")
  .split(",")
  .map((url) => url.trim())
  .filter(Boolean);
const CHANGELOG_POLL_MINUTES = Number(process.env.CHANGELOG_POLL_MINUTES || "15");
const DOWNLOAD_BY_DEFAULT_EXTENSIONS = new Set([
  ".md",
  ".txt",
  ".csv",
  ".json",
  ".zip",
]);

const allowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error("Not allowed by CORS"));
    },
  }),
);
app.get("/uploads/feed/:fileName", (req, res, next) => {
  const requestedName = path.basename(String(req.params.fileName || ""));
  const extension = path.extname(requestedName).toLowerCase();
  const forceDownload = req.query.download === "1" || DOWNLOAD_BY_DEFAULT_EXTENSIONS.has(extension);

  if (!forceDownload) {
    return next();
  }

  const filePath = path.join(UPLOAD_DIR, requestedName);
  const downloadName = requestedName.replace(/^\d{4}-\d{2}-\d{2}-[0-9a-f-]{36}-/i, "") || "attachment";

  res.download(filePath, downloadName, (error) => {
    if (!error) {
      return;
    }

    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      if (!res.headersSent) {
        res.status(404).json({ error: "File not found" });
      }
      return;
    }

    console.error("Failed to download feed upload:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Failed to download upload" });
    }
  });
});
app.use("/uploads/feed", express.static(UPLOAD_DIR));
app.post("/api/uploads/feed", express.raw({ type: "*/*", limit: "25mb" }), async (req, res) => {
  const secret = String(req.headers["x-feed-secret"] || "");
  if (!secret || secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const body = req.body as Buffer;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    return res.status(400).json({ error: "No file body supplied" });
  }

  const rawName = String(req.headers["x-file-name"] || "attachment");
  let decodedRawName = rawName;
  try {
    decodedRawName = decodeURIComponent(rawName);
  } catch {
    decodedRawName = rawName;
  }
  const decodedName = decodedRawName.replace(/[\\/:*?"<>|]+/g, "-").trim() || "attachment";
  const extension = path.extname(decodedName).toLowerCase().replace(/[^a-z0-9.]/g, "").slice(0, 12);
  const baseName = path.basename(decodedName, path.extname(decodedName)).replace(/[^a-z0-9-_]+/gi, "-").slice(0, 80) || "attachment";
  const storedName = `${new Date().toISOString().slice(0, 10)}-${randomUUID()}-${baseName}${extension}`;
  const targetPath = path.join(UPLOAD_DIR, storedName);

  try {
    await mkdir(UPLOAD_DIR, { recursive: true });
    await writeFile(targetPath, body);
    res.status(201).json({
      ok: true,
      name: decodedName,
      type: req.headers["content-type"] || "application/octet-stream",
      size: body.length,
      url: `${PUBLIC_BASE_URL.replace(/\/$/, "")}/uploads/feed/${encodeURIComponent(storedName)}`,
    });
  } catch (error: any) {
    console.error("Failed to save feed upload:", error);
    res.status(500).json({ error: "Failed to save upload" });
  }
});
app.use(express.json());

// MySQL connection pool
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST || "localhost",
  user: process.env.MYSQL_USER || "root",
  password: process.env.MYSQL_PASSWORD || "",
  database: process.env.MYSQL_DATABASE || "feed_db",
  timezone: "Z",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

interface FeedDbRow {
  total?: number;
}

interface FeedItemRow extends FeedDbRow {
  id: number;
  title: string;
  content: string | null;
  url: string | null;
  source: string | null;
  external_id?: string | null;
  created_at: string | Date;
  pinned_at?: string | Date | null;
  tint_color?: string | null;
}

interface FeedWeekSummaryRow {
  week_key: string;
  week_year: number;
  week_number: number;
  start_date: string;
  end_date: string;
  content: string;
  updated_at: string;
}

interface FeedWeekSummaryStyleRow {
  id: string;
  label: string;
  mode: string;
  purpose: string;
}

const ALLOWED_TINT_COLORS = new Set([
  "#f4d7d7",
  "#f3dfcf",
  "#f0e1b8",
  "#dbe6b8",
  "#d1ead4",
  "#cde9de",
  "#cfecea",
  "#d5edf7",
  "#dce7fb",
  "#deddf8",
  "#eadcf8",
  "#f0d8f0",
  "#f6dce8",
  "#e7dfd6",
  "#ece9e3",
]);

interface NormalizedGitHubFeedItem {
  title: string;
  content: string | null;
  url: string | null;
  externalId: string;
  createdAt: string | null;
}

interface GitHubPublicEvent {
  id: string;
  type: string;
  actor?: {
    login?: string;
  };
  repo?: {
    name?: string;
    url?: string;
  };
  payload?: Record<string, any>;
  created_at?: string;
}

interface ChangelogEntryInput {
  id?: string;
  externalId?: string;
  appName?: string;
  version?: string;
  title?: string;
  highlights?: string[];
  changes?: string[];
  bullets?: string[];
  url?: string | null;
  createdAt?: string;
  source?: string;
}

function normalizeManualCreatedAt(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  const parsed = new Date(trimmed.replace(" ", "T"));
  if (Number.isNaN(parsed.getTime())) {
    return null;
  }

  return parsed.toISOString().slice(0, 19).replace("T", " ");
}

function normalizeTintColor(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toLowerCase();
  if (!trimmed) {
    return null;
  }

  return ALLOWED_TINT_COLORS.has(trimmed) ? trimmed : null;
}

function normalizeWeekKey(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim().toUpperCase();
  return /^\d{4}-W\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeIsoDateOnly(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function resolveWeekSummariesDir() {
  if (process.env.FEED_WEEK_SUMMARIES_DIR) {
    return process.env.FEED_WEEK_SUMMARIES_DIR;
  }

  const candidates = [
    "\\\\JEFFERSHIZZLE-D\\Dotcoms E\\copy\\text\\feed\\weekly-summaries",
    path.resolve(__dirname, "..", "..", "copy", "text", "feed", "weekly-summaries"),
    path.resolve(__dirname, "..", "..", "..", "copy", "text", "feed", "weekly-summaries"),
  ];

  const existingCandidate = candidates.find((candidate) => existsSync(candidate));
  return existingCandidate || "\\\\JEFFERSHIZZLE-D\\Dotcoms E\\copy\\text\\feed\\weekly-summaries";
}

function resolveWeekSummaryStylesPath() {
  return path.join(resolveWeekSummariesDir(), "styles.json");
}

function getIsoWeekRange(weekYear: number, weekNumber: number) {
  const isoAnchor = new Date(Date.UTC(weekYear, 0, 4));
  const firstWeekday = (isoAnchor.getUTCDay() + 6) % 7;
  const firstWeekStart = new Date(isoAnchor);
  firstWeekStart.setUTCDate(isoAnchor.getUTCDate() - firstWeekday);
  firstWeekStart.setUTCHours(0, 0, 0, 0);

  const start = new Date(firstWeekStart);
  start.setUTCDate(firstWeekStart.getUTCDate() + (weekNumber - 1) * 7);

  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);

  return {
    start_date: start.toISOString().slice(0, 10),
    end_date: end.toISOString().slice(0, 10),
  };
}

function parseWeekKeyParts(weekKey: string) {
  const match = /^(\d{4})-W(\d{2})$/.exec(weekKey);
  if (!match) {
    return null;
  }

  const weekYear = Number(match[1]);
  const weekNumber = Number(match[2]);
  if (!Number.isInteger(weekYear) || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53) {
    return null;
  }

  return { weekYear, weekNumber };
}

async function loadWeekSummariesFromFiles() {
  const summariesDir = resolveWeekSummariesDir();
  await mkdir(summariesDir, { recursive: true });

  const files = await readdir(summariesDir, { withFileTypes: true });
  const summaries: FeedWeekSummaryRow[] = [];

  for (const entry of files) {
    if (!entry.isFile() || path.extname(entry.name).toLowerCase() !== ".md") {
      continue;
    }

    const weekKey = normalizeWeekKey(path.basename(entry.name, ".md"));
    if (!weekKey) {
      continue;
    }

    const weekParts = parseWeekKeyParts(weekKey);
    if (!weekParts) {
      continue;
    }

    const filePath = path.join(summariesDir, entry.name);
    const content = (await readFile(filePath, "utf8")).trim();
    if (!content) {
      continue;
    }
    const { start_date, end_date } = getIsoWeekRange(weekParts.weekYear, weekParts.weekNumber);
    const fileStats = await stat(filePath);
    const updatedAt = fileStats.mtime.toISOString();

    summaries.push({
      week_key: weekKey,
      week_year: weekParts.weekYear,
      week_number: weekParts.weekNumber,
      start_date,
      end_date,
      content,
      updated_at: updatedAt,
    });
  }

  summaries.sort((a, b) => b.week_key.localeCompare(a.week_key));
  return summaries;
}

async function loadWeekSummaryStyles() {
  const stylesPath = resolveWeekSummaryStylesPath();
  if (!existsSync(stylesPath)) {
    return [] as FeedWeekSummaryStyleRow[];
  }

  const raw = await readFile(stylesPath, "utf8");
  const payload = JSON.parse(raw);
  if (!Array.isArray(payload)) {
    return [] as FeedWeekSummaryStyleRow[];
  }

  return payload
    .map((entry) => {
      const id = typeof entry?.id === "string" ? entry.id.trim() : "";
      const label = typeof entry?.label === "string" ? entry.label.trim() : "";
      const mode = typeof entry?.mode === "string" ? entry.mode.trim() : "";
      const purpose = typeof entry?.purpose === "string" ? entry.purpose.trim() : "";

      if (!id || !label) {
        return null;
      }

      return { id, label, mode, purpose } satisfies FeedWeekSummaryStyleRow;
    })
    .filter((entry): entry is FeedWeekSummaryStyleRow => Boolean(entry));
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function trimGitHubHtmlSnippet(value: string | null | undefined, maxLength: number = 320) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.length > maxLength ? `${trimmed.slice(0, maxLength - 1).trimEnd()}…` : trimmed;
}

function inferGitHubUsername() {
  const configuredUsername = (process.env.GITHUB_USERNAME || "").trim();
  if (configuredUsername) {
    return configuredUsername;
  }

  const githubUrl = (process.env.GITHUB_FEED_URL || "").trim();
  if (!githubUrl) {
    return null;
  }

  const match = githubUrl.match(/github\.com\/(?:users\/)?([^\/.?]+)(?:\.atom)?/i);
  return match?.[1] || null;
}

function buildGitHubRepoUrl(repoName: string | undefined) {
  return repoName ? `https://github.com/${repoName}` : null;
}

function buildGitHubCompareUrl(repoName: string | undefined, before: string | undefined, head: string | undefined) {
  if (!repoName || !head) {
    return buildGitHubRepoUrl(repoName);
  }

  if (!before || /^0+$/.test(before)) {
    return `https://github.com/${repoName}/commit/${head}`;
  }

  return `https://github.com/${repoName}/compare/${before}...${head}`;
}

function buildGitHubFeedContent(paragraphs: string[], bullets: string[] = []) {
  const cleanParagraphs = paragraphs.map((item) => item.trim()).filter(Boolean);
  const cleanBullets = bullets.map((item) => item.trim()).filter(Boolean);

  if (cleanParagraphs.length === 0 && cleanBullets.length === 0) {
    return null;
  }

  const paragraphHtml = cleanParagraphs.map((item) => `<p>${escapeHtml(item)}</p>`).join("");
  const bulletsHtml =
    cleanBullets.length > 0
      ? `<ul>${cleanBullets.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
      : "";

  return `${paragraphHtml}${bulletsHtml}` || null;
}

function getIssueOrPullRequestLabel(resource: Record<string, any>, fallbackLabel: string) {
  const issueNumber = resource?.number;
  return issueNumber ? `${fallbackLabel} #${issueNumber}` : fallbackLabel;
}

function normalizeGitHubEvent(event: GitHubPublicEvent): NormalizedGitHubFeedItem | null {
  const actor = event.actor?.login || "GitHub user";
  const repoName = event.repo?.name;
  const repoUrl = buildGitHubRepoUrl(repoName);
  const payload = event.payload || {};
  const createdAt = event.created_at || null;

  switch (event.type) {
    case "PushEvent": {
      const branch = String(payload.ref || "").replace(/^refs\/heads\//, "") || "a branch";
      const commits = Array.isArray(payload.commits) ? payload.commits : [];
      const commitBullets = commits
        .slice(0, 4)
        .map((commit: Record<string, any>) => trimGitHubHtmlSnippet(commit?.message))
        .filter((message): message is string => Boolean(message));

      return {
        title: `${actor} pushed to ${branch} in ${repoName || "a repository"}`,
        content: buildGitHubFeedContent(
          [`${commits.length || 1} commit${commits.length === 1 ? "" : "s"} pushed to ${branch}.`],
          commitBullets,
        ),
        url: buildGitHubCompareUrl(repoName, payload.before, payload.head),
        externalId: `github-event-${event.id}`,
        createdAt,
      };
    }

    case "CreateEvent": {
      const refType = payload.ref_type || "reference";
      const refName = payload.ref || repoName || "repository";
      return {
        title: `${actor} created ${refType} ${refName} in ${repoName || "GitHub"}`,
        content: buildGitHubFeedContent([`Created ${refType} ${refName}.`]),
        url:
          refType === "branch" && payload.ref && repoName
            ? `https://github.com/${repoName}/tree/${payload.ref}`
            : repoUrl,
        externalId: `github-event-${event.id}`,
        createdAt,
      };
    }

    case "IssuesEvent": {
      const issue = payload.issue || {};
      return {
        title: `${actor} ${payload.action || "updated"} an issue in ${repoName || "GitHub"}`,
        content: buildGitHubFeedContent(
          [String(issue.title || "Issue update")],
          [trimGitHubHtmlSnippet(issue.body || "")].filter((item): item is string => Boolean(item)),
        ),
        url: issue.html_url || repoUrl,
        externalId: `github-event-${event.id}`,
        createdAt,
      };
    }

    case "IssueCommentEvent": {
      const issue = payload.issue || {};
      const comment = payload.comment || {};
      const action = payload.action || "commented";
      const commentSnippet = trimGitHubHtmlSnippet(comment.body || "");
      return {
        title: `${actor} ${action} a comment on ${getIssueOrPullRequestLabel(issue, "issue")} in ${repoName || "GitHub"}`,
        content: buildGitHubFeedContent(
          [String(issue.title || "Issue comment")].filter((item): item is string => Boolean(item)),
          [commentSnippet].filter((item): item is string => Boolean(item)),
        ),
        url: comment.html_url || issue.html_url || repoUrl,
        externalId: `github-event-${event.id}`,
        createdAt,
      };
    }

    case "PullRequestEvent": {
      const pullRequest = payload.pull_request || {};
      return {
        title: `${actor} ${payload.action || "updated"} a pull request in ${repoName || "GitHub"}`,
        content: buildGitHubFeedContent(
          [String(pullRequest.title || "Pull request update")],
          [trimGitHubHtmlSnippet(pullRequest.body || "")].filter((item): item is string => Boolean(item)),
        ),
        url: pullRequest.html_url || repoUrl,
        externalId: `github-event-${event.id}`,
        createdAt,
      };
    }

    case "PullRequestReviewEvent":
    case "PullRequestReviewCommentEvent": {
      const pullRequest = payload.pull_request || {};
      const review = payload.review || payload.comment || {};
      const action = payload.action || "reviewed";
      const reviewSnippet = trimGitHubHtmlSnippet(review.body || "");
      return {
        title: `${actor} ${action} a comment on ${getIssueOrPullRequestLabel(pullRequest, "pull request")} in ${repoName || "GitHub"}`,
        content: buildGitHubFeedContent(
          [String(pullRequest.title || "Pull request review")].filter((item): item is string => Boolean(item)),
          [reviewSnippet].filter((item): item is string => Boolean(item)),
        ),
        url: review.html_url || pullRequest.html_url || repoUrl,
        externalId: `github-event-${event.id}`,
        createdAt,
      };
    }

    case "ReleaseEvent": {
      const release = payload.release || {};
      return {
        title: `${actor} published a release in ${repoName || "GitHub"}`,
        content: buildGitHubFeedContent(
          [String(release.name || release.tag_name || "Release published")],
          [trimGitHubHtmlSnippet(release.body || "")].filter((item): item is string => Boolean(item)),
        ),
        url: release.html_url || repoUrl,
        externalId: `github-event-${event.id}`,
        createdAt,
      };
    }

    case "WatchEvent":
      return {
        title: `${actor} starred ${repoName || "a repository"}`,
        content: null,
        url: repoUrl,
        externalId: `github-event-${event.id}`,
        createdAt,
      };

    case "ForkEvent": {
      const forkee = payload.forkee || {};
      return {
        title: `${actor} forked ${repoName || "a repository"}`,
        content: buildGitHubFeedContent(
          [forkee.full_name ? `Forked to ${forkee.full_name}.` : "Repository forked."],
        ),
        url: forkee.html_url || repoUrl,
        externalId: `github-event-${event.id}`,
        createdAt,
      };
    }

    default:
      return null;
  }
}

async function upsertGitHubFeedItem(item: NormalizedGitHubFeedItem) {
  const sql = `
    INSERT INTO feed_items (title, content, url, source, external_id, created_at)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      content = VALUES(content),
      url = VALUES(url),
      source = VALUES(source),
      created_at = COALESCE(VALUES(created_at), created_at)
  `;

  await pool.execute(sql, [
    item.title,
    item.content,
    item.url,
    "github",
    item.externalId,
    item.createdAt ? new Date(item.createdAt).toISOString().slice(0, 19).replace("T", " ") : null,
  ]);
}

async function fetchGitHubEventsFromApi(username: string) {
  const headers: Record<string, string> = {
    "User-Agent": "JeffersonWMFeed/1.0",
    Accept: "application/vnd.github+json",
    "Cache-Control": "no-cache",
  };

  const token = (process.env.GITHUB_TOKEN || "").trim();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(`https://api.github.com/users/${encodeURIComponent(username)}/events/public?per_page=50`, {
    headers,
  });

  if (!response.ok) {
    throw new Error(`GitHub API HTTP ${response.status} ${response.statusText}`);
  }

  const events = (await response.json()) as GitHubPublicEvent[];
  let processed = 0;

  for (const event of events) {
    const normalized = normalizeGitHubEvent(event);
    if (!normalized) {
      continue;
    }

    await upsertGitHubFeedItem(normalized);
    processed += 1;
  }

  return processed;
}

function formatAtomDate(value: string | Date | null | undefined) {
  if (!value) {
    return new Date().toISOString();
  }

  const parsed = new Date(value);
  return isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function buildAtomFeedXml(items: FeedItemRow[]) {
  const atomUrl = `${PUBLIC_BASE_URL.replace(/\/$/, "")}/atom.xml`;
  const siteUrl = "https://jeffersonwm.com/feed/";
  const updated = items.length > 0 ? formatAtomDate(items[0].created_at) : new Date().toISOString();

  const entries = items
    .map((item) => {
      const itemUrl = item.url || `${siteUrl}#entry-${item.id}`;
      const content = item.content ? `<content type="html">${escapeXml(item.content)}</content>` : "";
      const externalId = item.external_id || `feed-item-${item.id}`;

      return `
  <entry>
    <id>${escapeXml(`${atomUrl}#${externalId}`)}</id>
    <title>${escapeXml(item.title)}</title>
    <updated>${formatAtomDate(item.created_at)}</updated>
    <published>${formatAtomDate(item.created_at)}</published>
    <link href="${escapeXml(itemUrl)}" />
    <author><name>JeffersonWM</name></author>
    <category term="${escapeXml(String(item.source || "feed"))}" />
    ${content}
  </entry>`;
    })
    .join("");

  return `<?xml version="1.0" encoding="utf-8"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <id>${escapeXml(atomUrl)}</id>
  <title>JeffersonWM Feed</title>
  <updated>${updated}</updated>
  <link rel="self" href="${escapeXml(atomUrl)}" />
  <link rel="alternate" href="${escapeXml(siteUrl)}" />
  <subtitle>JeffersonWM releases, manual updates, and GitHub activity.</subtitle>
  <author><name>JeffersonWM</name></author>${entries}
</feed>`;
}

function normalizeVersion(value: string) {
  return value.trim().replace(/^v\.?/i, "");
}

function buildReleaseTitle(appName: string, version: string) {
  const normalizedVersion = normalizeVersion(version);
  return normalizedVersion ? `${appName.trim()} v${normalizedVersion}` : appName.trim();
}

function buildReleaseHtml(highlights: string[]) {
  const cleanHighlights = highlights.map((item) => item.trim()).filter(Boolean);
  if (cleanHighlights.length === 0) {
    return null;
  }

  return `<div class="release-note-body"><p>What's new</p><ul>${cleanHighlights
    .map((item) => `<li>${escapeHtml(item)}</li>`)
    .join("")}</ul></div>`;
}

function normalizeChangelogEntries(payload: unknown): ChangelogEntryInput[] {
  if (Array.isArray(payload)) {
    return payload as ChangelogEntryInput[];
  }

  if (payload && typeof payload === "object") {
    const objectPayload = payload as Record<string, unknown>;
    if (Array.isArray(objectPayload.entries)) {
      return objectPayload.entries as ChangelogEntryInput[];
    }

    if ("appName" in objectPayload || "version" in objectPayload || "title" in objectPayload) {
      return [objectPayload as ChangelogEntryInput];
    }
  }

  return [];
}

async function upsertReleaseEntry(entry: ChangelogEntryInput, fallbackSource: string) {
  const appName = entry.appName?.trim();
  const version = entry.version?.trim();
  const title = entry.title?.trim() || (appName && version ? buildReleaseTitle(appName, version) : null);
  const highlights = (entry.highlights || entry.changes || entry.bullets || [])
    .map((item) => String(item).trim())
    .filter(Boolean);
  const content = buildReleaseHtml(highlights);
  const source = (entry.source || fallbackSource || "release").trim() || "release";
  const externalId =
    entry.externalId?.trim() ||
    entry.id?.trim() ||
    (appName && version ? `${appName.toLowerCase().replace(/\s+/g, "-")}-release-v${normalizeVersion(version)}` : null);

  if (!title || !externalId) {
    return false;
  }

  let createdAtVal: string | null = null;
  if (entry.createdAt) {
    const parsedDate = new Date(entry.createdAt);
    if (!isNaN(parsedDate.getTime())) {
      createdAtVal = parsedDate.toISOString().slice(0, 19).replace("T", " ");
    }
  }

  const sql = `
    INSERT INTO feed_items (title, content, url, source, external_id, created_at)
    VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
    ON DUPLICATE KEY UPDATE
      title = VALUES(title),
      content = VALUES(content),
      url = VALUES(url),
      source = VALUES(source),
      created_at = COALESCE(VALUES(created_at), created_at)
  `;

  await pool.execute(sql, [
    title,
    content,
    entry.url || null,
    source,
    externalId,
    createdAtVal,
  ]);

  return true;
}

async function fetchChangelogSources(throwOnError: boolean = false) {
  if (CHANGELOG_SOURCE_URLS.length === 0) {
    return { imported: 0, sources: 0 };
  }

  let imported = 0;

  for (const sourceUrl of CHANGELOG_SOURCE_URLS) {
    try {
      const response = await fetch(sourceUrl, {
        headers: {
          Accept: "application/json",
          "Cache-Control": "no-cache",
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      const payload = await response.json();
      const entries = normalizeChangelogEntries(payload);
      const sourceName =
        payload && typeof payload === "object" && !Array.isArray(payload)
          ? String((payload as Record<string, unknown>).source || "release")
          : "release";

      for (const entry of entries) {
        const inserted = await upsertReleaseEntry(entry, sourceName);
        if (inserted) {
          imported += 1;
        }
      }
    } catch (error) {
      console.error(`Failed to import changelog source ${sourceUrl}:`, error);
      if (throwOnError) {
        throw error;
      }
    }
  }

  return { imported, sources: CHANGELOG_SOURCE_URLS.length };
}

app.get("/health", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT COUNT(*) AS total FROM feed_items");
    const total = Array.isArray(rows) ? Number((rows[0] as FeedDbRow)?.total || 0) : 0;
    res.json({
      ok: true,
      app: "feed",
      publicBaseUrl: PUBLIC_BASE_URL,
      totalItems: total,
      changelogSources: CHANGELOG_SOURCE_URLS.length,
    });
  } catch (error: any) {
    res.status(500).json({
      ok: false,
      app: "feed",
      error: error?.message || "Health check failed",
    });
  }
});

// Initialize table (MySQL syntax)
async function initDb() {
  try {
    await pool.query(`SET time_zone = '+00:00'`);
    await pool.query(`
      CREATE TABLE IF NOT EXISTS feed_items (
        id INT PRIMARY KEY AUTO_INCREMENT,
        title VARCHAR(255) NOT NULL,
        content TEXT,
        url TEXT,
        source VARCHAR(50),
        external_id VARCHAR(255) UNIQUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        pinned_at TIMESTAMP NULL DEFAULT NULL,
        tint_color VARCHAR(16) NULL DEFAULT NULL
      )
    `);
    const [columns] = await pool.query(
      `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'feed_items'
          AND COLUMN_NAME IN ('pinned_at', 'tint_color')
      `,
    );
    const columnSet = new Set(
      (Array.isArray(columns) ? columns : []).map((column: any) => String(column.COLUMN_NAME || "")),
    );
    if (!columnSet.has("pinned_at")) {
      await pool.query(`ALTER TABLE feed_items ADD COLUMN pinned_at TIMESTAMP NULL DEFAULT NULL`);
    }
    if (!columnSet.has("tint_color")) {
      await pool.query(`ALTER TABLE feed_items ADD COLUMN tint_color VARCHAR(16) NULL DEFAULT NULL`);
    }
    console.log("MySQL Database initialized");
    // Initial fetch
    fetchFeeds();
    fetchChangelogSources();
  } catch (err) {
    console.error("Database initialization failed:", err);
  }
}

// Function to fetch and save feeds
async function fetchFeeds(throwOnError: boolean = false) {
  const githubUsername = inferGitHubUsername();
  if (githubUsername) {
    try {
      const processed = await fetchGitHubEventsFromApi(githubUsername);
      console.log(`Updated GitHub feed from public events API: ${processed} items processed.`);
      return;
    } catch (error: any) {
      console.warn(`GitHub public events API fetch failed for ${githubUsername}:`, error?.message || error);
      if (!process.env.GITHUB_FEED_URL) {
        if (throwOnError) {
          throw error;
        }
        return;
      }
    }
  }

  const githubUrl = process.env.GITHUB_FEED_URL;
  if (!githubUrl) {
    console.log("No GITHUB_FEED_URL set in environment variables. Skipping fetch.");
    return;
  }

  if (githubUrl.includes("yourusername.atom")) {
    console.log("GITHUB_FEED_URL is configured as a placeholder. Skipping fetch.");
    return;
  }

  console.log(`Fetching automated feeds from URL: ${githubUrl}`);
  
  let xmlText = "";
  let attempt = 0;
  const maxAttempts = 3;
  let lastError: any = null;

  while (attempt < maxAttempts) {
    attempt++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12 seconds connection timeout

      const response = await fetch(githubUrl, {
        method: "GET",
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          "Accept": "application/atom+xml, application/xml, text/xml, */*",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status} ${response.statusText}`);
      }

      xmlText = await response.text();
      break; // Successfully fetched, break the retry loop
    } catch (err: any) {
      lastError = err;
      const isTimeout = err.name === "AbortError";
      console.warn(
        `Attempt ${attempt}/${maxAttempts} failed to retrieve GitHub feed: ${
          isTimeout ? "Connection Timeout (12s)" : err.message || err
        }`
      );
      if (attempt < maxAttempts) {
        // Linear backoff delay: 1500ms * attempt
        await new Promise((resolve) => setTimeout(resolve, 1500 * attempt));
      }
    }
  }

  if (!xmlText) {
    const errorMsg = lastError?.message || "Unknown fetching error";
    console.error(`Error fetching GitHub feed: Failed after ${maxAttempts} attempts. Last error: ${errorMsg}`);
    if (throwOnError) {
      throw new Error(`Failed to retrieve GitHub feed after multiple retries. Last error: ${errorMsg}`);
    }
    return;
  }

  try {
    const feed = await parser.parseString(xmlText);
    
    for (const item of feed.items) {
      const sql = `
        INSERT INTO feed_items (title, content, url, source, external_id, created_at)
        VALUES (?, ?, ?, ?, ?, COALESCE(?, CURRENT_TIMESTAMP))
        ON DUPLICATE KEY UPDATE
          title = VALUES(title),
          content = VALUES(content),
          url = VALUES(url),
          source = VALUES(source),
          created_at = COALESCE(VALUES(created_at), created_at)
      `;
      // Atom feeds use item.id or item.guid as the external_id.
      // Upserting lets edited GitHub items refresh in place on later polls.
      await pool.execute(sql, [
        item.title || "Untitled GitHub Event",
        item.content || item.contentSnippet || null,
        item.link || null,
        "github",
        item.id || item.guid || item.link,
        item.isoDate || item.pubDate || null,
      ]);
    }
    console.log(`Updated GitHub feed: ${feed.items.length} items processed.`);
  } catch (err: any) {
    console.error("Error parsing/inserting GitHub feed:", err.message || err);
    if (throwOnError) {
      throw err;
    }
  }
}

// Poll feeds every 15 minutes
setInterval(() => {
  fetchFeeds(false).catch((err) => console.error("Background fetchFeeds failed:", err));
}, 15 * 60 * 1000);

setInterval(() => {
  fetchChangelogSources(false).catch((err) => console.error("Background changelog import failed:", err));
}, CHANGELOG_POLL_MINUTES * 60 * 1000);

initDb();

// API Routes
app.get("/api/changelog/schema", (_req, res) => {
  res.json({
    source: "release",
    entries: [
      {
        id: "perihelion-v0.4.0",
        appName: "Perihelion",
        version: "0.4.0",
        url: "https://jeffersonwm.com/perihelion/",
        createdAt: "2026-05-25T10:30:00.000Z",
        highlights: [
          "Connected Perihelion to central auth",
          "Added folder thumbnail previews",
          "Locked the archive behind app membership",
        ],
      },
    ],
  });
});

app.get("/api/feed", async (req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM feed_items ORDER BY pinned_at IS NULL, pinned_at DESC, created_at DESC");
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch feed" });
  }
});

app.get("/api/feed/week-summaries", async (_req, res) => {
  try {
    const summaries = await loadWeekSummariesFromFiles();
    res.json(summaries);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch weekly summaries" });
  }
});

app.get("/api/feed/week-summary-styles", async (_req, res) => {
  try {
    const styles = await loadWeekSummaryStyles();
    res.json(styles);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch weekly summary styles" });
  }
});

app.get("/atom.xml", async (_req, res) => {
  try {
    const [rows] = await pool.query("SELECT * FROM feed_items ORDER BY pinned_at IS NULL, pinned_at DESC, created_at DESC LIMIT 200");
    const items = (Array.isArray(rows) ? rows : []) as FeedItemRow[];
    res.type("application/atom+xml; charset=utf-8").send(buildAtomFeedXml(items));
  } catch (err) {
    console.error(err);
    res.status(500).type("text/plain; charset=utf-8").send("Failed to build Atom feed");
  }
});

app.post("/api/feed/refresh", async (req, res) => {
  try {
    await fetchFeeds(true);
    res.json({ success: true, message: "Feed refreshed successfully" });
  } catch (err: any) {
    console.error("Manual refresh failed:", err);
    res.status(502).json({ 
      error: "GitHub feed currently timeout or unreachable", 
      details: err.message || String(err) 
    });
  }
});

app.post("/api/feed/import-changelogs", async (req, res) => {
  const { secret } = req.body || {};
  if (!secret || secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const result = await fetchChangelogSources(true);
    res.json({ success: true, ...result });
  } catch (error: any) {
    res.status(502).json({
      error: "Failed to import changelog sources",
      details: error?.message || String(error),
    });
  }
});

app.post("/api/auth/verify", (req, res) => {
  const { secret } = req.body;
  if (!secret || secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Invalid secret key" });
  }
  res.json({ success: true });
});

app.post("/api/feed", async (req, res) => {
  const { secret, title, content, url, source, external_id, created_at, tint_color } = req.body;

  if (secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  const normalizedCreatedAt = normalizeManualCreatedAt(created_at);
  if (created_at && !normalizedCreatedAt) {
    return res.status(400).json({ error: "Invalid created_at value" });
  }
  if (tint_color && !normalizeTintColor(tint_color)) {
    return res.status(400).json({ error: "Invalid tint_color value" });
  }

  try {
    const createdAt = normalizedCreatedAt || new Date().toISOString().slice(0, 19).replace("T", " ");
    const tintColor = normalizeTintColor(tint_color);
    const sql = `
      INSERT INTO feed_items (title, content, url, source, external_id, created_at, tint_color)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        title=VALUES(title),
        content=VALUES(content),
        url=VALUES(url),
        source=VALUES(source),
        tint_color=VALUES(tint_color)
    `;
    
    await pool.execute(sql, [
      title, 
      content || null, 
      url || null, 
      source || "manual", 
      external_id || null,
      createdAt,
      tintColor,
    ]);
    
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to add feed item" });
  }
});

app.put("/api/feed/:id", async (req, res) => {
  const { id } = req.params;
  const { secret, title, content, url, source, created_at, tint_color } = req.body || {};

  if (secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!title) {
    return res.status(400).json({ error: "Title is required" });
  }

  const normalizedCreatedAt = normalizeManualCreatedAt(created_at);
  if (created_at && !normalizedCreatedAt) {
    return res.status(400).json({ error: "Invalid created_at value" });
  }
  if (tint_color && !normalizeTintColor(tint_color)) {
    return res.status(400).json({ error: "Invalid tint_color value" });
  }

  try {
    const [rows] = await pool.query("SELECT id, source FROM feed_items WHERE id = ? LIMIT 1", [id]);
    const entry = Array.isArray(rows) ? rows[0] as { id: number; source: string } | undefined : undefined;

    if (!entry) {
      return res.status(404).json({ error: "Feed item not found" });
    }

    if ((entry.source || "").toLowerCase() === "github") {
      return res.status(403).json({ error: "GitHub feed items cannot be edited here" });
    }

    const tintColor = normalizeTintColor(tint_color);
    await pool.execute(
      `
        UPDATE feed_items
        SET title = ?, content = ?, url = ?, source = ?, created_at = COALESCE(?, created_at), tint_color = ?
        WHERE id = ?
      `,
      [title, content || null, url || null, source || entry.source || "manual", normalizedCreatedAt, tintColor, id],
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update feed item" });
  }
});

app.put("/api/feed/week-summaries/:weekKey", async (req, res) => {
  const normalizedWeekKey = normalizeWeekKey(req.params.weekKey);
  const { secret, content } = req.body || {};

  if (secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (!normalizedWeekKey) {
    return res.status(400).json({ error: "Invalid week key" });
  }

  const summaryContent = typeof content === "string" ? content.trim() : "";
  if (!summaryContent) {
    return res.status(400).json({ error: "Summary content is required" });
  }

  try {
    const summariesDir = resolveWeekSummariesDir();
    await mkdir(summariesDir, { recursive: true });
    const filePath = path.join(summariesDir, `${normalizedWeekKey}.md`);
    await writeFile(filePath, `${summaryContent.trim()}\n`, "utf8");
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save weekly summary" });
  }
});

app.post("/api/feed/:id/pin", async (req, res) => {
  const { id } = req.params;
  const { secret, pinned } = req.body || {};

  if (secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [rows] = await pool.query("SELECT id FROM feed_items WHERE id = ? LIMIT 1", [id]);
    const entry = Array.isArray(rows) ? rows[0] as { id: number } | undefined : undefined;

    if (!entry) {
      return res.status(404).json({ error: "Feed item not found" });
    }

    await pool.execute(
      "UPDATE feed_items SET pinned_at = ? WHERE id = ?",
      [pinned ? new Date().toISOString().slice(0, 19).replace("T", " ") : null, id],
    );

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to update pinned state" });
  }
});

app.delete("/api/feed/:id", async (req, res) => {
  const { id } = req.params;
  const { secret } = req.body || {};

  if (secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [rows] = await pool.query("SELECT id, source FROM feed_items WHERE id = ? LIMIT 1", [id]);
    const entry = Array.isArray(rows) ? rows[0] as { id: number; source: string } | undefined : undefined;

    if (!entry) {
      return res.status(404).json({ error: "Feed item not found" });
    }

    if ((entry.source || "").toLowerCase() === "github") {
      return res.status(403).json({ error: "GitHub feed items cannot be deleted here" });
    }

    await pool.execute("DELETE FROM feed_items WHERE id = ?", [id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete feed item" });
  }
});

app.post("/api/feed/changelog", async (req, res) => {
  const { secret, source, entries: bodyEntries, ...singleEntry } = req.body || {};

  if (!secret || secret !== process.env.FEED_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const entries = normalizeChangelogEntries(bodyEntries ? { entries: bodyEntries } : singleEntry);
  if (entries.length === 0) {
    return res.status(400).json({ error: "No changelog entries supplied" });
  }

  let imported = 0;
  for (const entry of entries) {
    const inserted = await upsertReleaseEntry(entry, source || "release");
    if (inserted) {
      imported += 1;
    }
  }

  res.json({ success: true, imported });
});

// Vite middleware for development
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, HOST, () => {
    console.log(`Feed running on ${PUBLIC_BASE_URL}`);
  });
}

startServer();
