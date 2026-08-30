import React, { useEffect, useState } from 'react';

interface HighlightImageSummary {
  key: string;
  count: number;
  lastSelectedAt: string;
  blockIndex: number | null;
  image: {
    code: string;
    title: string;
    path: string;
    folder: string;
    thumbUrl: string;
  };
}

interface HighlightEvent {
  timestamp: string;
  action: 'selected' | 'cleared' | 'cleared-all';
  blockIndex: number | null;
  clearedCount: number | null;
  image: HighlightImageSummary['image'] | null;
}

interface HighlightSummary {
  ok: boolean;
  generatedAt: string;
  totalEvents: number;
  selectedCount: number;
  clearedCount: number;
  topImages: HighlightImageSummary[];
  topFolders: Array<{ folder: string; count: number }>;
  daily: Array<{ date: string; selected: number; cleared: number }>;
  recentEvents: HighlightEvent[];
}

type AuthStatus = {
  user: null | {
    username: string;
    displayName: string | null;
    isAdmin: boolean;
    isOwner: boolean;
  };
};

export function HighlightsPage({
  apiBaseUrl,
  authStatus,
  authLoading,
  onSignIn,
  onSignOut,
}: {
  apiBaseUrl: string;
  authStatus: AuthStatus | null;
  authLoading: boolean;
  onSignIn: () => void;
  onSignOut: () => void;
}) {
  const [summary, setSummary] = useState<HighlightSummary | null>(null);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    let cancelled = false;

    async function loadSummary() {
      try {
        const response = await fetch(`${apiBaseUrl}/api/highlight-events/summary`);
        if (!response.ok) {
          throw new Error(`Highlight summary returned ${response.status}`);
        }

        const payload = (await response.json()) as HighlightSummary;
        if (!cancelled) {
          setSummary(payload);
          setError('');
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(loadError instanceof Error ? loadError.message : 'Highlights could not be loaded.');
        }
      }
    }

    void loadSummary();

    return () => {
      cancelled = true;
    };
  }, [apiBaseUrl]);

  return (
    <div className="flex min-h-screen flex-col bg-[#FAFAFA] text-gray-950">
      <header className="h-[36px] px-6 bg-[#FAFAFA] flex items-center justify-between border-b border-[#e5e5e5]">
        <a href="/aphelion/" className="font-sans text-sm font-semibold text-gray-900">
          Aphelion
        </a>
        <div className="flex items-center gap-3 font-sans text-sm font-semibold text-gray-900">
          <a href="/aphelion/" className="hover:text-[#de8bf7]">
            Back
          </a>
          {!authLoading && (
            authStatus?.user ? (
              <button type="button" onClick={onSignOut} className="font-semibold hover:text-[#de8bf7]">
                Sign Out
              </button>
            ) : (
              <button type="button" onClick={onSignIn} className="font-semibold hover:text-[#de8bf7]">
                Sign In
              </button>
            )
          )}
        </div>
      </header>

      <main className="h-[calc(100vh-72px)] overflow-y-auto px-[36px] py-[36px]">
        {error && (
          <div className="mb-[36px] border border-red-200 bg-red-50 p-4 font-sans text-sm text-red-700">
            {error}
          </div>
        )}

        {!summary && !error && (
          <div className="font-sans text-sm text-gray-500">Loading highlight activity...</div>
        )}

        {summary && (
          summary.topImages.length === 0 ? (
            <div className="font-sans text-sm text-gray-500">No highlights have been recorded yet.</div>
          ) : (
            <div className="grid grid-cols-2 gap-[36px] min-[1180px]:grid-cols-4 min-[1700px]:grid-cols-5">
              {summary.topImages.map((item) => (
                <figure key={item.key} className="group relative m-0" title={`${item.count} selected`}>
                  <img
                    src={`${apiBaseUrl}${item.image.thumbUrl}`}
                    alt={item.image.title || item.image.code}
                    className="block aspect-square w-full border border-[#e5e5e5] object-cover"
                    loading="lazy"
                  />
                  <figcaption className="pointer-events-none absolute inset-x-0 bottom-0 bg-[#FAFAFA]/85 px-3 py-2 font-sans text-sm font-semibold text-gray-900 opacity-0 transition-opacity duration-150 group-hover:opacity-100">
                    {item.count} selected
                  </figcaption>
                </figure>
              ))}
            </div>
          )
        )}
      </main>
      <footer className="flex h-[36px] items-center justify-end border-t border-[#e5e5e5] bg-[#FAFAFA] px-6 font-sans text-sm text-gray-700">
        <div>
          © 2026 Jefferson Williams. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
