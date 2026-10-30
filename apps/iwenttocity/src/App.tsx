import { useEffect, useMemo, useState } from 'react'

type PageId = 'home' | 'testimonials' | 'send' | 'data' | 'meaning' | 'received'

type Page = {
  id: PageId
  title: string
  path: string
  links: PageId[]
}

const pages: Record<PageId, Page> = {
  home: {
    id: 'home',
    title: 'I Went to City College',
    path: '/',
    links: ['testimonials', 'data', 'meaning'],
  },
  testimonials: {
    id: 'testimonials',
    title: 'Testimonials',
    path: '/testimonials',
    links: ['home', 'send'],
  },
  send: {
    id: 'send',
    title: 'Send',
    path: '/send',
    links: ['testimonials'],
  },
  data: {
    id: 'data',
    title: 'Data',
    path: '/data',
    links: ['home'],
  },
  meaning: {
    id: 'meaning',
    title: 'Meaning',
    path: '/meaning',
    links: ['home', 'received'],
  },
  received: {
    id: 'received',
    title: 'Received',
    path: '/received',
    links: ['meaning'],
  },
}

const pathToPageId = Object.values(pages).reduce<Record<string, PageId>>((lookup, page) => {
  lookup[page.path] = page.id
  return lookup
}, {})

const apiBaseUrl = (import.meta.env.VITE_IWENTTOCITY_API_BASE_URL || '').replace(/\/$/, '')

function getCurrentPageId(): PageId {
  const hashPath = window.location.hash.replace(/^#/, '') || '/'
  return pathToPageId[hashPath] || 'home'
}

function pageHref(pageId: PageId) {
  return `#${pages[pageId].path}`
}

function apiUrl(path: string) {
  return `${apiBaseUrl}${path}`
}

export function App() {
  const [pageId, setPageId] = useState<PageId>(getCurrentPageId)
  const [email, setEmail] = useState('')
  const [sendStatus, setSendStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle')
  const [sendMessage, setSendMessage] = useState('')

  useEffect(() => {
    const handleHashChange = () => setPageId(getCurrentPageId())

    window.addEventListener('hashchange', handleHashChange)
    return () => window.removeEventListener('hashchange', handleHashChange)
  }, [])

  const page = pages[pageId]
  const linkedPages = useMemo(() => page.links.map((linkId) => pages[linkId]), [page.links])
  const isSendPage = pageId === 'send'

  async function handleSendSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSendStatus('sending')
    setSendMessage('')

    try {
      const response = await fetch(apiUrl('/api/interest'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'send-page' }),
      })
      const result = (await response.json().catch(() => ({}))) as { error?: string }

      if (!response.ok) {
        throw new Error(result.error || 'Unable to send right now.')
      }

      setEmail('')
      setSendStatus('sent')
      setSendMessage('Sent.')
    } catch (error) {
      setSendStatus('error')
      setSendMessage(error instanceof Error ? error.message : 'Unable to send right now.')
    }
  }

  return (
    <main className="page-shell">
      <h1>{page.title}</h1>
      {isSendPage ? (
        <section className="email-banner" aria-label="Send email address">
          <form className="email-form" onSubmit={handleSendSubmit}>
            <input
              aria-label="Email address"
              autoComplete="email"
              inputMode="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="email address"
              required
              type="email"
              value={email}
            />
            <button type="submit" disabled={sendStatus === 'sending'}>
              {sendStatus === 'sending' ? 'Sending' : 'Send'}
            </button>
          </form>
          {sendMessage ? <p className="email-status">{sendMessage}</p> : null}
        </section>
      ) : null}
      <nav className="link-banner" aria-label="Page links">
        {linkedPages.map((linkedPage) => (
          <a key={linkedPage.id} href={pageHref(linkedPage.id)}>
            {linkedPage.title}
          </a>
        ))}
      </nav>
    </main>
  )
}
