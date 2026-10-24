import React, { useState } from 'react';
import {
  Copy,
  Check,
  Play,
  Server,
  Smartphone,
} from 'lucide-react';
import { getToken } from '../services/session';
import { PageIntro } from './ui';

const API_BASE =
  (import.meta as any).env?.VITE_API_BASE_URL?.replace(/\/$/, '') || 'http://localhost:5001';

export const ApiExplorer: React.FC = () => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [responseOutput, setResponseOutput] = useState<any>(null);

  /** Read-only on purpose: a request here runs as the signed-in super admin. */
  const endpoints: { method: 'GET'; path: string; desc: string }[] = [
    { method: 'GET', path: '/health', desc: 'Server and database health' },
    { method: 'GET', path: '/auth/admin/me', desc: 'Your staff session and permissions' },
    { method: 'GET', path: '/catalog/products?page=1&limit=5', desc: 'First 5 products; meta.total is the full count' },
    { method: 'GET', path: '/catalog/categories', desc: 'Categories the app shows' },
    { method: 'GET', path: '/orders?all=true', desc: 'Every order you can see' },
    { method: 'GET', path: '/cms/banners', desc: 'Banners: the app gets only published ones, staff get all' },
    { method: 'GET', path: '/cms/sections', desc: 'App home screen sections, their order and visibility' },
    { method: 'GET', path: '/cms/help', desc: 'Help page: phone, WhatsApp, email, hours and questions' },
    { method: 'GET', path: '/pricing/bulk-tiers', desc: 'Bulk price rules' },
    { method: 'GET', path: '/audit/logs?limit=20', desc: 'Latest 20 audit trail entries' },
  ];

  const currentEp = endpoints[selectedEndpoint];
  const envLine = `EXPO_PUBLIC_API_BASE_URL=${API_BASE}`;

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleTestEndpoint = async () => {
    try {
      setLoading(true);
      const url = `${API_BASE}${currentEp.path}`;
      const token = getToken();
      const options: RequestInit = {
        method: currentEp.method,
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          'x-client': 'portal',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      };

      const res = await fetch(url, options);
      const text = await res.text();
      let data: unknown = text;
      try {
        data = JSON.parse(text);
      } catch {
        // Not JSON; show the raw body.
      }
      setResponseOutput({ status: res.status, ok: res.ok, data });
    } catch (err: any) {
      setResponseOutput({ error: err.message || "Can't reach the server." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <PageIntro>
        Read-only checks against the server this portal uses ({API_BASE}). Each request runs with your sign-in, so it
        returns what you are allowed to see.
      </PageIntro>


      <div style={styles.appConnectBanner}>
        <div style={styles.bannerIconBox}>
          <Smartphone size={24} color="var(--accent)" />
        </div>
        <div style={styles.bannerInfo}>
          <h3 style={styles.bannerTitle}>Connect the phone app</h3>
          <p style={styles.bannerDesc}>
            The mobile app in <code>app/</code> uses <code>EXPO_PUBLIC_API_BASE_URL</code> to reach
            this backend. Create <code>app/.env.local</code> with:
          </p>
          <div style={styles.envCodeRow}>
            <code style={styles.envCode}>{envLine}</code>
            <button type="button" onClick={() => handleCopy(envLine, 'env')}
              style={styles.copyBtn}
            >
              {copiedText === 'env' ? <Check size={14} color="var(--success)" /> : <Copy size={14} />}
              <span>{copiedText === 'env' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Explorer Split */}
      <div style={styles.splitGrid}>
        {/* Endpoints List */}
        <div style={styles.epListCol}>
          <div style={styles.colTitle}>Endpoints</div>
          <div style={styles.epList}>
            {endpoints.map((ep, idx) => (
              <button
                type="button"
                key={idx}
                aria-pressed={selectedEndpoint === idx}
                onClick={() => {
                  setSelectedEndpoint(idx);
                  setResponseOutput(null);
                }}
                style={{
                  ...styles.epCard,
                  ...(selectedEndpoint === idx ? styles.epCardActive : {}),
                }}
              >
                <div style={styles.epHeader}>
                  <span
                    style={{
                      ...styles.methodPill,
                      background: ep.method === 'GET' ? 'var(--info-soft)' : 'var(--success-soft)',
                      color: ep.method === 'GET' ? 'var(--info)' : 'var(--success)',
                    }}
                  >
                    {ep.method}
                  </span>
                  <span style={styles.epPath}>{ep.path}</span>
                </div>
                <div style={styles.epDesc}>{ep.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Live Test Console */}
        <div style={styles.testConsole}>
          <div style={styles.consoleHeader}>
            <div style={styles.consoleTitle}>
              <Server size={16} color="var(--accent)" />
              <span>Try a request</span>
            </div>
            <button
              type="button"
              onClick={handleTestEndpoint}
              disabled={loading}
              className="btn btn-primary"
              style={styles.runBtn}
            >
              <Play size={14} />
              <span>{loading ? 'Sending…' : 'Send request'}</span>
            </button>
          </div>

          <div style={styles.requestUrlBar}>
            <span style={styles.requestMethod}>{currentEp.method}</span>
            <span style={styles.requestUrl}>{API_BASE}{currentEp.path}</span>
          </div>

          {/* Response Box */}
          <div style={styles.responseSection}>
            <div style={styles.responseHeader}>
              <div style={styles.resLabel}>
                <span>Response</span>
                {responseOutput?.status && (
                  <span
                    style={{
                      ...styles.statusPill,
                      ...(responseOutput.ok ? {} : { background: 'var(--danger-soft)', color: 'var(--danger)' }),
                    }}
                  >
                    Status {responseOutput.status}
                    {responseOutput.ok ? ' OK' : ''}
                  </span>
                )}
              </div>
              {responseOutput && (
                <button
                  type="button"
                  onClick={() =>
                    handleCopy(JSON.stringify(responseOutput.data ?? responseOutput.error, null, 2), 'res')
                  }
                  style={styles.copySmallBtn}
                >
                  {copiedText === 'res' ? <Check size={12} color="var(--success)" /> : <Copy size={12} />}
                  <span>{copiedText === 'res' ? 'Copied' : 'Copy response'}</span>
                </button>
              )}
            </div>

            <div style={styles.responseViewer}>
              {responseOutput ? (
                <pre style={styles.resCode}>
                  {JSON.stringify(responseOutput.data || responseOutput.error, null, 2)}
                </pre>
              ) : (
                <div style={styles.emptyRes}>
                  Press "Send request" to call this endpoint on the server this portal uses.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  appConnectBanner: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: '18px',
    padding: '20px 24px',
    background: 'var(--accent-soft)',
    border: '1px solid var(--accent-border)',
    borderRadius: 'var(--radius-xl)',
  },
  bannerIconBox: {
    padding: '10px',
    background: 'var(--accent-soft)',
    borderRadius: 'var(--radius-md)',
  },
  bannerInfo: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  bannerTitle: {
    fontSize: '1.1rem',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  bannerDesc: {
    fontSize: '0.84rem',
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
  envCodeRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    marginTop: '6px',
  },
  envCode: {
    background: 'var(--bg-app)',
    border: '1px solid var(--border-medium)',
    padding: '8px 14px',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'monospace',
    fontSize: '0.86rem',
    color: 'var(--accent)',
    fontWeight: 600,
  },
  copyBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    borderRadius: 'var(--radius-md)',
    background: 'var(--bg-surface-elevated)',
    border: '1px solid var(--border-medium)',
    color: 'var(--text-main)',
    fontSize: '0.82rem',
    fontWeight: 600,
    cursor: 'pointer',
  },
  splitGrid: {
    display: 'grid',
    gridTemplateColumns: '1.1fr 1.6fr',
    gap: '24px',
    alignItems: 'start',
  },
  epListCol: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  colTitle: {
    fontSize: '0.9rem',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  epList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  epCard: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    padding: '14px 16px',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'all var(--transition-fast)',
  },
  epCardActive: {
    borderColor: 'var(--accent)',
    background: 'var(--bg-surface-elevated)',
    boxShadow: '0 4px 14px var(--tint-3)',
  },
  epHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  methodPill: {
    padding: '2px 8px',
    borderRadius: 'var(--radius-sm)',
    fontSize: '0.72rem',
    fontWeight: 800,
    fontFamily: 'monospace',
  },
  epPath: {
    fontFamily: 'monospace',
    fontSize: '0.84rem',
    fontWeight: 600,
    color: 'var(--text-main)',
  },
  epDesc: {
    fontSize: '0.76rem',
    color: 'var(--text-muted)',
  },
  testConsole: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-xl)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  consoleHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  consoleTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '1rem',
    fontWeight: 700,
    color: 'var(--text-main)',
  },
  runBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '8px 14px',
    fontSize: '0.8rem',
  },
  requestUrlBar: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
    background: 'var(--bg-app)',
    border: '1px solid var(--border-medium)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 14px',
  },
  requestMethod: {
    fontFamily: 'monospace',
    fontWeight: 800,
    fontSize: '0.8rem',
    color: 'var(--accent)',
  },
  requestUrl: {
    fontFamily: 'monospace',
    fontSize: '0.84rem',
    color: 'var(--text-main)',
  },
  responseSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  responseHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resLabel: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  statusPill: {
    background: 'var(--success-soft)',
    color: 'var(--success)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    fontSize: '0.72rem',
    fontWeight: 700,
  },
  copySmallBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    background: 'none',
    border: 'none',
    color: 'var(--text-dim)',
    fontSize: '0.72rem',
    cursor: 'pointer',
  },
  responseViewer: {
    background: 'var(--bg-app)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    minHeight: '180px',
    maxHeight: '340px',
    overflowY: 'auto',
  },
  resCode: {
    fontFamily: 'monospace',
    fontSize: '0.78rem',
    color: 'var(--text-muted)',
    whiteSpace: 'pre-wrap',
  },
  emptyRes: {
    height: '140px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    color: 'var(--text-dim)',
    fontSize: '0.82rem',
    padding: '0 20px',
  },
};
