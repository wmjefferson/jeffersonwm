type GitHubProjectActivityConfig = {
  token: string;
  owner: string;
  projectNumber: number;
  refreshMinutes: number;
};

type GitHubIssueNode = {
  __typename: 'Issue';
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED';
  createdAt: string;
  closedAt: string | null;
  repository: {
    name: string;
    url: string;
    isPrivate: boolean;
    isArchived: boolean;
  };
};

type GitHubProjectFieldValueNode =
  | {
      __typename: 'ProjectV2ItemFieldSingleSelectValue';
      name: string;
      field: {
        __typename: 'ProjectV2SingleSelectField';
        name: string;
      } | null;
    }
  | {
      __typename: string;
    };

export type ProjectActivityIssue = {
  repo: string;
  repoUrl: string;
  number: number;
  title: string;
  url: string;
  state: 'OPEN' | 'CLOSED';
  createdAt: string;
  closedAt: string | null;
  durationDays: number;
  category: string | null;
};

export type ProjectActivitySnapshot = {
  ok: true;
  project: {
    owner: string;
    number: number;
    title: string;
  };
  updatedAt: string;
  filters: {
    excludePrivate: true;
    excludeArchived: true;
  };
  summary: {
    totalIssues: number;
    openIssues: number;
    closedIssues: number;
    repoCount: number;
  };
  repos: Array<{
    name: string;
    url: string;
    totalIssues: number;
    openIssues: number;
    closedIssues: number;
  }>;
  issues: ProjectActivityIssue[];
};

type ProjectActivityStatus = {
  configured: boolean;
  refreshing: boolean;
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastError: string | null;
  issueCount: number;
  repoCount: number;
};

type GitHubGraphqlResponse<T> = {
  data?: T;
  errors?: Array<{ message?: string }>;
};

type GitHubProjectItemsPage = {
  user: {
    projectV2: {
      title: string;
      items: {
        pageInfo: {
          hasNextPage: boolean;
          endCursor: string | null;
        };
        nodes: Array<{
          content: GitHubIssueNode | { __typename: string } | null;
          fieldValues: {
            nodes: GitHubProjectFieldValueNode[];
          };
        }>;
      };
    } | null;
  } | null;
};

type GitHubProjectNode = NonNullable<GitHubProjectItemsPage['user']>['projectV2'];

function isGitHubIssueNode(content: GitHubIssueNode | { __typename: string } | null): content is GitHubIssueNode {
  return Boolean(content && content.__typename === 'Issue');
}

const GRAPHQL_ENDPOINT = 'https://api.github.com/graphql';
const STATUS_FIELD_NAMES = new Set(['status', 'category']);
const GRAPHQL_QUERY = `
  query ProjectIssuePage($login: String!, $number: Int!, $after: String) {
    user(login: $login) {
      projectV2(number: $number) {
        title
        items(first: 100, after: $after) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            fieldValues(first: 20) {
              nodes {
                __typename
                ... on ProjectV2ItemFieldSingleSelectValue {
                  name
                  field {
                    __typename
                    ... on ProjectV2SingleSelectField {
                      name
                    }
                  }
                }
              }
            }
            content {
              __typename
              ... on Issue {
                number
                title
                url
                state
                createdAt
                closedAt
                repository {
                  name
                  url
                  isPrivate
                  isArchived
                }
              }
            }
          }
        }
      }
    }
  }
`;

function getIssueCategory(fieldValues: GitHubProjectFieldValueNode[]) {
  for (const value of fieldValues) {
    if (value.__typename !== 'ProjectV2ItemFieldSingleSelectValue') {
      continue;
    }

    const fieldName = String(value.field?.name || '').trim().toLowerCase();
    if (STATUS_FIELD_NAMES.has(fieldName)) {
      return String(value.name || '').trim() || null;
    }
  }

  return null;
}

function parseProjectActivityConfig(env: NodeJS.ProcessEnv): GitHubProjectActivityConfig | null {
  const token = String(env.GITHUB_PROJECT_ACTIVITY_TOKEN || '').trim();
  const owner = String(env.GITHUB_PROJECT_ACTIVITY_OWNER || 'wmjefferson').trim();
  const projectNumber = Number(env.GITHUB_PROJECT_ACTIVITY_NUMBER || '4');
  const refreshMinutes = Number(env.GITHUB_PROJECT_ACTIVITY_REFRESH_MINUTES || '30');

  if (!token || !owner || !Number.isFinite(projectNumber) || projectNumber < 1) {
    return null;
  }

  return {
    token,
    owner,
    projectNumber,
    refreshMinutes: Number.isFinite(refreshMinutes) && refreshMinutes > 0 ? refreshMinutes : 30,
  };
}

async function githubGraphql<T>(config: GitHubProjectActivityConfig, variables: Record<string, unknown>) {
  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'jeffersonwm-project-activity',
    },
    body: JSON.stringify({
      query: GRAPHQL_QUERY,
      variables,
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL returned HTTP ${response.status}`);
  }

  const payload = await response.json() as GitHubGraphqlResponse<T>;
  if (Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error(payload.errors.map((entry) => entry.message || 'Unknown GitHub GraphQL error').join('; '));
  }

  if (!payload.data) {
    throw new Error('GitHub GraphQL returned no data.');
  }

  return payload.data;
}

function getDurationDays(createdAt: string, closedAt: string | null) {
  const start = new Date(createdAt);
  const end = new Date(closedAt || Date.now());
  const diff = end.getTime() - start.getTime();
  return Math.max(0, Math.round(diff / (1000 * 60 * 60 * 24)));
}

async function fetchProjectActivitySnapshot(config: GitHubProjectActivityConfig): Promise<ProjectActivitySnapshot> {
  const issues: ProjectActivityIssue[] = [];
  let after: string | null = null;
  let projectTitle = `Project ${config.projectNumber}`;

  do {
    const page: GitHubProjectItemsPage = await githubGraphql<GitHubProjectItemsPage>(config, {
      login: config.owner,
      number: config.projectNumber,
      after,
    });

    const project: GitHubProjectNode = page.user?.projectV2 || null;
    if (!project) {
      throw new Error(`Project ${config.owner}/${config.projectNumber} could not be loaded.`);
    }

    projectTitle = project.title || projectTitle;

    for (const item of project.items.nodes) {
      if (!isGitHubIssueNode(item.content)) {
        continue;
      }

      const issue = item.content;
      if (issue.repository.isPrivate || issue.repository.isArchived) {
        continue;
      }

      issues.push({
        repo: issue.repository.name,
        repoUrl: issue.repository.url,
        number: issue.number,
        title: issue.title,
        url: issue.url,
        state: issue.state,
        createdAt: issue.createdAt,
        closedAt: issue.closedAt,
        durationDays: getDurationDays(issue.createdAt, issue.closedAt),
        category: getIssueCategory(item.fieldValues?.nodes || []),
      });
    }

    after = project.items.pageInfo.hasNextPage ? project.items.pageInfo.endCursor : null;
  } while (after);

  issues.sort((left, right) => {
    const repoOrder = left.repo.localeCompare(right.repo);
    if (repoOrder !== 0) {
      return repoOrder;
    }

    const createdOrder = new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
    if (createdOrder !== 0) {
      return createdOrder;
    }

    return left.number - right.number;
  });

  const repoMap = new Map<string, ProjectActivitySnapshot['repos'][number]>();
  for (const issue of issues) {
    const existing = repoMap.get(issue.repo) || {
      name: issue.repo,
      url: issue.repoUrl,
      totalIssues: 0,
      openIssues: 0,
      closedIssues: 0,
    };
    existing.totalIssues += 1;
    if (issue.state === 'OPEN') {
      existing.openIssues += 1;
    } else {
      existing.closedIssues += 1;
    }
    repoMap.set(issue.repo, existing);
  }

  const repos = [...repoMap.values()].sort((left, right) => {
    const countOrder = right.totalIssues - left.totalIssues;
    return countOrder !== 0 ? countOrder : left.name.localeCompare(right.name);
  });

  return {
    ok: true,
    project: {
      owner: config.owner,
      number: config.projectNumber,
      title: projectTitle,
    },
    updatedAt: new Date().toISOString(),
    filters: {
      excludePrivate: true,
      excludeArchived: true,
    },
    summary: {
      totalIssues: issues.length,
      openIssues: issues.filter((issue) => issue.state === 'OPEN').length,
      closedIssues: issues.filter((issue) => issue.state === 'CLOSED').length,
      repoCount: repos.length,
    },
    repos,
    issues,
  };
}

export function createProjectActivityService(env: NodeJS.ProcessEnv) {
  const config = parseProjectActivityConfig(env);
  let cache: ProjectActivitySnapshot | null = null;
  let refreshPromise: Promise<ProjectActivitySnapshot> | null = null;
  let lastSuccessAt: string | null = null;
  let lastAttemptAt: string | null = null;
  let lastError: string | null = null;

  const getStatus = (): ProjectActivityStatus => ({
    configured: Boolean(config),
    refreshing: Boolean(refreshPromise),
    lastSuccessAt,
    lastAttemptAt,
    lastError,
    issueCount: cache?.summary.totalIssues || 0,
    repoCount: cache?.summary.repoCount || 0,
  });

  const refresh = async () => {
    if (!config) {
      throw new Error('GitHub project activity is not configured.');
    }

    if (refreshPromise) {
      return refreshPromise;
    }

    lastAttemptAt = new Date().toISOString();
    refreshPromise = fetchProjectActivitySnapshot(config)
      .then((snapshot) => {
        cache = snapshot;
        lastSuccessAt = snapshot.updatedAt;
        lastError = null;
        return snapshot;
      })
      .catch((error) => {
        lastError = error instanceof Error ? error.message : 'Unknown project activity refresh error.';
        throw error;
      })
      .finally(() => {
        refreshPromise = null;
      });

    return refreshPromise;
  };

  const getSnapshot = async () => {
    if (cache) {
      return cache;
    }

    return refresh();
  };

  const start = () => {
    if (!config) {
      return;
    }

    void refresh().catch((error) => {
      console.error('Initial GitHub project activity sync failed:', error);
    });

    const timer = setInterval(() => {
      void refresh().catch((error) => {
        console.error('Scheduled GitHub project activity sync failed:', error);
      });
    }, config.refreshMinutes * 60 * 1000);

    timer.unref?.();
  };

  return {
    getStatus,
    getSnapshot,
    refresh,
    start,
  };
}
