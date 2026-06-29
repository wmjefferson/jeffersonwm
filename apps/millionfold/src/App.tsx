import React, { useState, useRef, useCallback, useEffect } from 'react';
import LeftPanel from './components/LeftPanel';
import LiveFeed from './components/LiveFeed';
import ProgressPanel from './components/ProgressPanel';
import JobCompleteModal from './components/JobCompleteModal';

const API_BASE = (import.meta as any).env?.VITE_API_BASE || 'http://localhost:8090';

export interface RuleBlock {
  id: string;
  type: 'original' | 'text' | 'date' | 'sequence';
  value: string;
  padding?: number;
}

export interface PipelineConfig {
  tolerance: number;
  trim: boolean;
  expand: boolean;
  expand_px: number;
  pad: boolean;
  pad_w: number;
  pad_h: number;
  resize: boolean;
  resize_w: number;
  resize_h: number;
  maintain_aspect: boolean;
  remove_bg: boolean;
  interior_fill: boolean;
  pad_color: string;
}

export interface OutputConfig {
  folder: string;
  input_folder: string;
  recursive: boolean;
  output_mode: 'copy' | 'overwrite';
  output_format: 'same' | 'png' | 'jpeg' | 'webp';
  jpeg_quality: number;
  export_zip: boolean;
  separate_uncertain: boolean;
  show_live_feed: boolean;
  organize_by_date: boolean;
  live_feed_mode: 'grid' | 'single' | 'both';
  duplicate_mode: 'overwrite' | 'parenthesis' | 'duplicates_folder';
  live_feed_limit?: number;
}

export interface LiveImage {
  src: string;
  dest: string;
  thumb_b64: string;
  status: 'ok' | 'error';
  is_solid: boolean;
}

export interface JobProgress {
  phase: 'idle' | 'running' | 'zipping' | 'done' | 'error';
  total: number;
  current: number;
  success: number;
  errors: number;
  error_msg?: string;
  currentFile?: string;
  zip_path?: string;
}

interface User {
  id: number;
  username: string;
  isAdmin: boolean;
}

interface AuthStatus {
  ok: boolean;
  user: User | null;
  requireAuth: boolean;
  provider: 'central';
  authBaseUrl: string;
}

export default function App() {
  const [rules, setRules] = useState<RuleBlock[]>([{ id: '1', type: 'original', value: '' }]);
  const [pipeline, setPipeline] = useState<PipelineConfig>({
    tolerance: 32, trim: true, expand: false, expand_px: 20,
    pad: false, pad_w: 512, pad_h: 512, resize: false, resize_w: 512,
    resize_h: 512, maintain_aspect: true, remove_bg: false, interior_fill: false,
    pad_color: '#ffffff',
  });
  const [output, setOutput] = useState<OutputConfig>({
    folder: '', input_folder: '', recursive: false, output_mode: 'copy',
    output_format: 'same', jpeg_quality: 90, export_zip: false,
    separate_uncertain: false, show_live_feed: true, organize_by_date: false,
    live_feed_mode: 'both',
    duplicate_mode: 'overwrite',
    live_feed_limit: 50,
  });
  const [progress, setProgress] = useState<JobProgress>({
    phase: 'idle', total: 0, current: 0, success: 0, errors: 0,
  });
  const [images, setImages] = useState<LiveImage[]>([]);
  const [scanCount, setScanCount] = useState<number | null>(null);
  const [errorLog, setErrorLog] = useState<{ path: string; error: string }[]>([]);
  const [showErrors, setShowErrors] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const jobIdRef = useRef<string | null>(null);
  const esRef = useRef<EventSource | null>(null);
  const [pid, setPid] = useState<number | null>(null);

  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/auth`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => setAuthStatus(data))
      .catch(() => {});

    fetch(`${API_BASE}/api/health`, { credentials: 'include' })
      .then(res => res.json())
      .then(data => {
        if (data.ok && data.pid) {
          setPid(data.pid);
        }
      })
      .catch(() => {});
  }, []);

  const cancelJob = useCallback(async () => {
    if (!jobIdRef.current) return;
    try {
      await fetch(`${API_BASE}/api/job/cancel`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: jobIdRef.current }),
      });
    } catch (err) {
      console.error('Failed to cancel job:', err);
    }
  }, []);

  const handleLogout = async () => {
    const authBaseUrl = authStatus?.authBaseUrl || 'https://auth.jeffersonwm.com';
    try {
      await fetch(`${authBaseUrl}/api/auth/logout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ siteContext: window.location.href }),
      });
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  const openCentralAuth = () => {
    const authBaseUrl = authStatus?.authBaseUrl || 'https://auth.jeffersonwm.com';
    const url = new URL(authBaseUrl);
    url.searchParams.set('returnTo', window.location.href);
    window.location.href = url.toString();
  };

  const scanFolder = useCallback(async (folder: string, recursive: boolean) => {
    if (!folder) return;
    try {
      const params = new URLSearchParams({ folder, recursive: String(recursive) });
      const res = await fetch(`${API_BASE}/api/scan?${params}`, { credentials: 'include' });
      const data = await res.json();
      setScanCount(data.count ?? null);
    } catch {
      setScanCount(null);
    }
  }, []);

  const startJob = useCallback(async () => {
    if (!output.input_folder) return;
    setImages([]);
    setErrorLog([]);
    setShowCompleteModal(false);
    setProgress({ phase: 'running', total: 0, current: 0, success: 0, errors: 0 });

    try {
      const res = await fetch(`${API_BASE}/api/job`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          folder: output.input_folder,
          recursive: output.recursive,
          pipeline,
          rename_rules: rules,
          output_mode: output.output_mode,
          output_folder: output.folder,
          output_format: output.output_format,
          jpeg_quality: output.jpeg_quality,
          export_zip: output.export_zip,
          separate_uncertain: output.separate_uncertain,
          organize_by_date: output.organize_by_date,
          duplicate_mode: output.duplicate_mode,
        }),
      });
      const data = await res.json();
      if (!data.job_id) {
        setProgress(p => ({ ...p, phase: 'error', error_msg: data.error || 'Unknown error' }));
        return;
      }
      jobIdRef.current = data.job_id;

      if (esRef.current) esRef.current.close();
      const es = new EventSource(`${API_BASE}/api/progress/${data.job_id}`, { withCredentials: true });
      esRef.current = es;

      es.onmessage = (e) => {
        const evt = JSON.parse(e.data);
        if (evt.type === 'start') {
          setProgress(p => ({ ...p, total: evt.total, currentFile: undefined }));
        } else if (evt.type === 'processing_file') {
          setProgress(p => ({ ...p, current: evt.index, currentFile: evt.src }));
        } else if (evt.type === 'image') {
          setProgress(p => ({
            ...p,
            current: evt.index + 1,
            success: evt.status === 'ok' ? p.success + 1 : p.success,
            errors: evt.status === 'error' ? p.errors + 1 : p.errors,
          }));
          if (output.show_live_feed) {
            const limit = output.live_feed_limit ?? 50;
            setImages(prev => {
              const sliceCount = limit - 1;
              const base = sliceCount <= 0 ? [] : prev.slice(-sliceCount);
              return [...base, {
                src: evt.src, dest: evt.dest, thumb_b64: evt.thumb_b64,
                status: evt.status, is_solid: evt.is_solid ?? true,
              }];
            });
          }
        } else if (evt.type === 'zipping') {
          setProgress(p => ({ ...p, phase: 'zipping', zip_path: evt.zip }));
        } else if (evt.type === 'done') {
          setProgress(p => ({ ...p, phase: 'done', success: evt.success, errors: evt.errors }));
          setShowCompleteModal(true);
          es.close();
          fetch(`${API_BASE}/api/errors/${jobIdRef.current}`, { credentials: 'include' })
            .then(r => r.json())
            .then(d => setErrorLog(d.errors || []))
            .catch(() => {});
        } else if (evt.type === 'error') {
          setProgress(p => ({ ...p, phase: 'error', error_msg: evt.error }));
          es.close();
        }
      };
      es.onerror = () => {
        setProgress(p => ({ ...p, phase: 'error', error_msg: 'Connection lost' }));
        es.close();
      };
    } catch (err: any) {
      setProgress(p => ({ ...p, phase: 'error', error_msg: err?.message || 'Failed to start job' }));
    }
  }, [output, pipeline, rules]);

  const isRunning = progress.phase === 'running' || progress.phase === 'zipping';

  // Lock app behind private gate if central auth is active and user is signed out
  if (authStatus && authStatus.requireAuth && !authStatus.user) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#F0F0F0]">
        <div className="bg-white border-[3px] border-black p-8 max-w-md w-full shadow-[4px_4px_0px_#000] flex flex-col gap-4 text-center">
          <h1 className="font-archivo text-xl font-bold uppercase tracking-wider">Millionfold Access Required</h1>
          <p className="font-sans text-sm text-[#666] leading-relaxed">
            This application uses the central account system at <span className="font-bold">{authStatus.authBaseUrl || 'https://auth.jeffersonwm.com'}</span>.
            Please sign in and ensure you have <span className="font-bold">millionfold</span> application membership.
          </p>
          <button
            onClick={openCentralAuth}
            className="w-full bg-black text-white font-archivo text-xs font-bold uppercase tracking-widest py-3 hover:bg-[#222] transition-colors border-[2px] border-black cursor-pointer mt-2"
          >
            Sign In with Central Auth
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-[#F0F0F0] overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b-[3px] border-black shrink-0 h-9 px-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="font-archivo text-[15px] uppercase tracking-wider font-bold">Millionfold</h1>
          {pid && (
            <span className="font-mono text-[9px] bg-black text-white px-1.5 py-0.5 uppercase font-bold tracking-wider rounded-sm" title="Process ID of the Millionfold backend server">
              PID: {pid}
            </span>
          )}
        </div>
        
        {/* Auth System Links */}
        <div className="flex items-center gap-3 text-[11px] font-archivo font-bold uppercase tracking-wider">
          {authStatus ? (
            authStatus.user ? (
              <>
                <a
                  href={`${authStatus.authBaseUrl || 'https://auth.jeffersonwm.com'}/home`}
                  className="text-[#888] hover:text-black transition-colors"
                >
                  Dashboard
                </a>
                {authStatus.user.isAdmin && (
                  <>
                    <span className="text-[#DDD]">|</span>
                    <a
                      href={`${authStatus.authBaseUrl || 'https://auth.jeffersonwm.com'}/admin`}
                      className="text-black underline decoration-[1.5px] underline-offset-[3px] transition-colors font-bold"
                    >
                      admin
                    </a>
                  </>
                )}
                <span className="text-[#DDD]">|</span>
                <button
                  onClick={handleLogout}
                  className="text-[#888] hover:text-black transition-colors cursor-pointer"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                onClick={openCentralAuth}
                className="text-[#888] hover:text-black transition-colors cursor-pointer"
              >
                Sign In
              </button>
            )
          ) : (
            <span className="text-[#aaa] animate-pulse">Loading auth...</span>
          )}
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left Panel */}
        <div className="w-[320px] shrink-0 border-r-[3px] border-black bg-[#F0F0F0]">
          <LeftPanel
            rules={rules}
            setRules={setRules}
            pipeline={pipeline}
            setPipeline={setPipeline}
            output={output}
            setOutput={setOutput}
            scanCount={scanCount}
            onScan={scanFolder}
            isRunning={isRunning}
            startJob={startJob}
            progress={progress}
          />
        </div>

        {/* Right Panel */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <ProgressPanel
            progress={progress}
            errorLog={errorLog}
            showErrors={showErrors}
            setShowErrors={setShowErrors}
            onCancel={cancelJob}
          />
          {output.show_live_feed && (
            <LiveFeed images={images} mode={output.live_feed_mode || 'both'} />
          )}
        </div>
      </div>

      <JobCompleteModal
        isOpen={showCompleteModal}
        onClose={() => setShowCompleteModal(false)}
        progress={progress}
        output={output}
        pipeline={pipeline}
        rules={rules}
      />
    </div>
  );
}
