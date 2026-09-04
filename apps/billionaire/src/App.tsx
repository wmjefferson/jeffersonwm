import { useEffect, useRef, useState } from 'react';

type AuthUser = {
  id: string;
  username: string;
  displayName?: string | null;
  isOwner?: boolean;
};

type Submission = {
  id: string;
  phone: string;
  maskedPhone: string;
  status: 'pending' | 'saved' | 'archived' | 'processed';
  createdAt: string;
  updatedAt: string;
  associatedUsername: string | null;
  accountAssociationRequested: boolean;
  approximateLocation: string | null;
  deviceSummary: string | null;
  timezone: string | null;
  language: string | null;
};

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  (import.meta.env.PROD ? 'https://api-billionaire.jeffersonwm.com' : 'http://localhost:8140')
).replace(/\/$/, '');

const AUTH_BASE = (
  import.meta.env.VITE_AUTH_BASE_URL ||
  (import.meta.env.PROD ? 'https://auth.jeffersonwm.com' : 'http://localhost:8061')
).replace(/\/$/, '');

type NormalizedPhone = {
  raw: string;
  digits: string;
  hasPlus: boolean;
};

const normalizePhoneInput = (value: string): NormalizedPhone => {
  const trimmed = value.trim();
  const sanitized = trimmed.replace(/[^0-9+,\*#wW;\s()\-.]/g, '').slice(0, 50);
  const rawDialString = sanitized.replace(/[\s().\-]/g, '');
  const digitsOnly = rawDialString.replace(/\D/g, '');
  return {
    raw: rawDialString,
    digits: digitsOnly,
    hasPlus: rawDialString.startsWith('+'),
  };
};

const formatPhone = (value: string) => {
  const { raw, digits, hasPlus } = normalizePhoneInput(value);
  if (!raw) return '';
  if (/[,*#wW;]/.test(raw)) {
    return raw;
  }
  if (hasPlus && digits.startsWith('1') && digits.length <= 11) {
    const local = digits.slice(1);
    if (!local) return '+1';
    if (local.length < 4) return `+1 ${local}`;
    if (local.length < 7) return `+1 (${local.slice(0, 3)}) ${local.slice(3)}`;
    return `+1 (${local.slice(0, 3)}) ${local.slice(3, 6)}-${local.slice(6)}`;
  }
  if (hasPlus || digits.length > 10) {
    return `${hasPlus ? '+' : ''}${digits.match(/.{1,3}/g)?.join(' ') || digits}`;
  }
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

const isValidPhone = ({ digits, raw }: NormalizedPhone) => {
  if (!raw || digits.length < 7 || digits.length > 30) return false;
  return /^[+0-9,\*#wW;]+$/.test(raw);
};

const formatDate = (value: string) => {
  if (!value) return 'Unknown time';
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
};

const buildAuthUrl = () => {
  const url = new URL(AUTH_BASE);
  url.searchParams.set('popup', '1');
  url.searchParams.set('returnTo', window.location.href);
  return url;
};

const getFontSizeStyle = (text: string) => {
  const len = text ? text.length : 1;
  const vw = (115 / (len + 0.8)).toFixed(2);
  const vh = Math.max(10, 38 - 1.6 * Math.min(len, 16)).toFixed(2);
  return {
    fontSize: `clamp(1.5rem, min(${vw}vw, ${vh}vh), 28rem)`,
  };
};

export default function App() {
  const [phoneNumber, setPhoneNumber] = useState('');
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [sentPhone, setSentPhone] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [route, setRoute] = useState(() => (window.location.hash === '#admin' ? 'admin' : 'home'));
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [adminError, setAdminError] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const authPopupRef = useRef<Window | null>(null);

  const loadAuthStatus = async () => {
    const response = await fetch(`${API_BASE}/api/auth/status`, { credentials: 'include' });
    const data = await response.json();
    const user = data.user || null;
    setAuthUser(user);
    return user as AuthUser | null;
  };

  const loadAdmin = async () => {
    setAdminLoading(true);
    setAdminError('');
    try {
      const response = await fetch(`${API_BASE}/api/admin/submissions`, { credentials: 'include' });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Preferred admin access required.');
      }
      setAuthUser(data.user || null);
      setSubmissions(Array.isArray(data.submissions) ? data.submissions : []);
    } catch (caught) {
      setSubmissions([]);
      setAdminError(caught instanceof Error ? caught.message : 'Could not load submissions.');
    } finally {
      setAdminLoading(false);
    }
  };

  const associateSubmission = async (id: string) => {
    setStatusMessage('');
    setError('');
    const response = await fetch(`${API_BASE}/api/submissions/${encodeURIComponent(id)}/associate`, {
      method: 'POST',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      setError(data.error || 'Sign in or register to connect this number.');
      return;
    }
    setStatusMessage(`Connected to ${data.username}.`);
  };

  const openAuthPopup = () => {
    const url = buildAuthUrl();
    const width = 440;
    const height = 620;
    const left = Math.max(0, Math.round(window.screenX + ((window.outerWidth - width) / 2)));
    const top = Math.max(0, Math.round(window.screenY + ((window.outerHeight - height) / 2)));
    authPopupRef.current = window.open(
      url.toString(),
      'billionaire-auth',
      `width=${width},height=${height},left=${left},top=${top}`,
    );
    authPopupRef.current?.focus();
  };

  useEffect(() => {
    void loadAuthStatus();

    const handleHashChange = () => {
      const nextRoute = window.location.hash === '#admin' ? 'admin' : 'home';
      setRoute(nextRoute);
      if (nextRoute === 'admin') void loadAdmin();
    };

    const handleAuthMessage = (event: MessageEvent) => {
      if (event.origin !== new URL(AUTH_BASE).origin || event.data?.type !== 'auth:success') return;
      authPopupRef.current = null;
      void loadAuthStatus().then(async () => {
        if (submissionId) {
          await associateSubmission(submissionId);
        }
        if (window.location.hash === '#admin') {
          await loadAdmin();
        }
      });
    };

    window.addEventListener('hashchange', handleHashChange);
    window.addEventListener('message', handleAuthMessage);
    if (window.location.hash === '#admin') void loadAdmin();
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
      window.removeEventListener('message', handleAuthMessage);
    };
  }, [submissionId]);

  const handlePhoneChange = (value: string) => {
    setPhoneNumber(formatPhone(value));
    setError('');
  };

  const submitPhone = async () => {
    const normalized = normalizePhoneInput(phoneNumber);
    if (!isValidPhone(normalized)) {
      setError('Enter a valid phone number with an area or country code.');
      return;
    }

    setIsSubmitting(true);
    setError('');
    setStatusMessage('');
    try {
      const response = await fetch(`${API_BASE}/api/submissions`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneNumber,
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          language: navigator.language,
          referrer: document.referrer,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not send phone number.');
      setSubmissionId(data.id);
      setSentPhone(data.maskedPhone || formatPhone(phoneNumber));
      setPhoneNumber('');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not send phone number.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const startAnother = () => {
    setSubmissionId(null);
    setSentPhone('');
    setPhoneNumber('');
    setStatusMessage('');
    setError('');
  };

  const handleAssociateClick = async () => {
    if (!submissionId) return;
    const user = authUser || await loadAuthStatus();
    if (user) {
      await associateSubmission(submissionId);
      return;
    }
    openAuthPopup();
  };

  const openAdmin = async () => {
    window.location.hash = 'admin';
    const user = authUser || await loadAuthStatus();
    if (!user?.isOwner) {
      openAuthPopup();
    }
    await loadAdmin();
  };

  const updateSubmissionStatus = async (submission: Submission, status: Submission['status']) => {
    setAdminError('');
    const response = await fetch(`${API_BASE}/api/admin/submissions/${encodeURIComponent(submission.id)}/status`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    const data = await response.json();
    if (!response.ok) {
      setAdminError(data.error || 'Could not update submission.');
      return;
    }
    await loadAdmin();
  };

  const deleteSubmission = async (submission: Submission) => {
    setAdminError('');
    const response = await fetch(`${API_BASE}/api/admin/submissions/${encodeURIComponent(submission.id)}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    const data = await response.json();
    if (!response.ok) {
      setAdminError(data.error || 'Could not delete submission.');
      return;
    }
    await loadAdmin();
  };

  const renderHome = () => (
    <section className="phone-stage">
      {submissionId ? (
        <div className="sent-panel">
          <p className="sent-panel__word">Sent</p>
          <p className="sent-panel__detail">
            {sentPhone} is in the review queue.
          </p>
          <div className="sent-panel__actions">
            <button type="button" className="text-button" onClick={handleAssociateClick}>
              Optionally connect this with an account
            </button>
            <button type="button" className="phone-stage__button" onClick={startAnother}>
              Enter Another
            </button>
          </div>
        </div>
      ) : (
        <div className="phone-stage__container">
          <label className="phone-stage__label" htmlFor="billionaire-phone-input">
            Phone Number
          </label>
          <div className="phone-stage__input-wrapper">
            <input
              id="billionaire-phone-input"
              className="phone-stage__input"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              placeholder="+1"
              value={phoneNumber}
              style={getFontSizeStyle(phoneNumber)}
              onChange={(event) => handlePhoneChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') void submitPhone();
              }}
            />
          </div>
          <div className="phone-stage__footer">
            <p className="phone-stage__note">
              You can submit without an account. If you want, you can connect the number to an account after it is sent.
            </p>
            <div className="phone-stage__actions">
              <button type="button" className="phone-stage__button phone-stage__button--secondary" onClick={() => handlePhoneChange('')}>
                Clear
              </button>
              <button type="button" className="phone-stage__button" onClick={submitPhone} disabled={isSubmitting}>
                {isSubmitting ? 'Sending' : 'Send'}
              </button>
            </div>
          </div>
        </div>
      )}
      {error ? <p className="notice notice--error">{error}</p> : null}
      {statusMessage ? <p className="notice">{statusMessage}</p> : null}
    </section>
  );

  const renderAdmin = () => (
    <section className="admin-panel">
      <div className="admin-panel__header">
        <div>
          <p className="eyebrow">Owner Review</p>
          <h1>Phone Submissions</h1>
        </div>
        <button type="button" className="text-button" onClick={() => { window.location.hash = ''; setRoute('home'); }}>
          Back
        </button>
      </div>

      {adminError ? (
        <div className="admin-empty">
          <p>{adminError}</p>
          <button type="button" className="phone-stage__button" onClick={openAuthPopup}>Sign In</button>
        </div>
      ) : adminLoading ? (
        <div className="admin-empty">Loading submissions.</div>
      ) : submissions.length === 0 ? (
        <div className="admin-empty">No submissions yet.</div>
      ) : (
        <div className="submission-list">
          {submissions.map((submission) => (
            <article className="submission-card" key={submission.id}>
              <div className="submission-card__primary">
                <p className="submission-card__phone">{submission.phone}</p>
                <p className="submission-card__meta">
                  {formatDate(submission.createdAt)} / {submission.status}
                </p>
              </div>
              <dl className="submission-card__details">
                <div><dt>Location</dt><dd>{submission.approximateLocation || 'Unknown'}</dd></div>
                <div><dt>Device</dt><dd>{submission.deviceSummary || 'Unknown'}</dd></div>
                <div><dt>Account</dt><dd>{submission.associatedUsername || (submission.accountAssociationRequested ? 'Requested' : 'Not connected')}</dd></div>
                <div><dt>Browser</dt><dd>{submission.language || 'Unknown'} / {submission.timezone || 'Unknown timezone'}</dd></div>
              </dl>
              <div className="submission-card__actions">
                <button type="button" onClick={() => updateSubmissionStatus(submission, 'saved')}>Save</button>
                <button type="button" onClick={() => updateSubmissionStatus(submission, 'processed')}>Processed</button>
                <button type="button" onClick={() => updateSubmissionStatus(submission, 'archived')}>Archive</button>
                <button type="button" onClick={() => deleteSubmission(submission)}>Delete</button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );

  return (
    <div className="shell">
      <div className="shell-gutters" aria-hidden="true">
        <span className="shell-gutter shell-gutter--left" />
        <span className="shell-gutter shell-gutter--right" />
      </div>

      <header className="page-banner page-banner--top">
        <div className="page-banner__inner shell-frame">
          <a href="/billionaire/" className="page-banner__brand">
            Billionaire
          </a>
          <button type="button" className="page-banner__button" onClick={openAdmin}>
            Admin
          </button>
        </div>
      </header>

      <main className="shell-frame shell-frame--body">
        {route === 'admin' ? renderAdmin() : renderHome()}
      </main>

      <footer className="page-banner page-banner--bottom">
        <div className="page-banner__inner shell-frame">
          <div />
          <p className="page-banner__copyright">
            &copy; {new Date().getFullYear()}{' '}
            <a
              href="https://jeffersonwm.com"
              target="_blank"
              rel="noopener noreferrer"
              className="page-banner__copyright-link page-banner__copyright-link--primary"
            >
              Jefferson Williams
            </a>
            . All rights reserved.{' '}
            <a
              href="https://github.com/wmjefferson/jeffersonwm"
              target="_blank"
              rel="noopener noreferrer"
              className="page-banner__copyright-link"
            >
              GitHub
            </a>
            .
          </p>
        </div>
      </footer>
    </div>
  );
}
