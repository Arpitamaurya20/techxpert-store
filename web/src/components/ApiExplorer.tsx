import React, { useState } from 'react';
import {
  Copy,
  Check,
  Play,
  Server,
  Smartphone,
} from 'lucide-react';

export const ApiExplorer: React.FC = () => {
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [selectedEndpoint, setSelectedEndpoint] = useState<number>(0);
  const [loading, setLoading] = useState(false);
  const [responseOutput, setResponseOutput] = useState<any>(null);

  const endpoints = [
    {
      method: 'GET',
      path: '/catalog/categories',
      desc: 'Categories for mobile home & category tabs',
      sampleBody: null,
    },
    {
      method: 'GET',
      path: '/catalog/subcategories',
      desc: 'Product type shortcuts under each category',
      sampleBody: null,
    },
    {
      method: 'GET',
      path: '/catalog/products?featured=true',
      desc: 'Products with unit, bulk tier cues & availability',
      sampleBody: null,
    },
    {
      method: 'POST',
      path: '/auth/login',
      desc: 'Authenticate contractor/customer account',
      sampleBody: JSON.stringify(
        {
          identifier: '9876543210',
          password: 'password123',
        },
        null,
        2
      ),
    },
    {
      method: 'GET',
      path: '/orders?all=true',
      desc: 'Fetch customer orders and line items',
      sampleBody: null,
    },
    {
      method: 'GET',
      path: '/cms/banners',
      desc: 'Active promotional banners for hero carousel',
      sampleBody: null,
    },
    {
      method: 'GET',
      path: '/pricing/bulk-tiers',
      desc: 'Bulk volume pricing tier rules & percentage discounts',
      sampleBody: null,
    },
  ];

  const currentEp = endpoints[selectedEndpoint];

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(id);
    setTimeout(() => setCopiedText(null), 2000);
  };

  const handleTestEndpoint = async () => {
    try {
      setLoading(true);
      const url = `http://localhost:5001${currentEp.path}`;
      const options: RequestInit = {
        method: currentEp.method,
        headers: {
          'Content-Type': 'application/json',
          'x-client': 'portal',
        },
      };

      if (currentEp.method === 'POST' && currentEp.sampleBody) {
        options.body = currentEp.sampleBody;
      }

      const res = await fetch(url, options);
      const data = await res.json();
      setResponseOutput({ status: res.status, data });
    } catch (err: any) {
      setResponseOutput({ error: err.message || 'Request failed' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      {/* Mobile App Connection Banner */}
      <div style={styles.appConnectBanner}>
        <div style={styles.bannerIconBox}>
          <Smartphone size={24} color="var(--brand-orange)" />
        </div>
        <div style={styles.bannerInfo}>
          <h3 style={styles.bannerTitle}>Connect Mobile App (Expo / React Native)</h3>
          <p style={styles.bannerDesc}>
            The mobile app in <code>app/</code> uses <code>EXPO_PUBLIC_API_BASE_URL</code> to reach
            this backend. Create <code>app/.env.local</code> with:
          </p>
          <div style={styles.envCodeRow}>
            <code style={styles.envCode}>EXPO_PUBLIC_API_BASE_URL=http://localhost:5001</code>
            <button
              onClick={() =>
                handleCopy('EXPO_PUBLIC_API_BASE_URL=http://localhost:5001', 'env')
              }
              style={styles.copyBtn}
            >
              {copiedText === 'env' ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
              <span>{copiedText === 'env' ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Explorer Split */}
      <div style={styles.splitGrid}>
        {/* Endpoints List */}
        <div style={styles.epListCol}>
          <div style={styles.colTitle}>Available Backend API Endpoints</div>
          <div style={styles.epList}>
            {endpoints.map((ep, idx) => (
              <button
                key={idx}
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
                      background: ep.method === 'GET' ? 'rgba(56, 189, 248, 0.15)' : 'rgba(16, 185, 129, 0.15)',
                      color: ep.method === 'GET' ? '#38bdf8' : '#34d399',
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
              <Server size={16} color="var(--brand-orange)" />
              <span>Interactive Request Runner</span>
            </div>
            <button
              onClick={handleTestEndpoint}
              disabled={loading}
              className="btn btn-primary"
              style={styles.runBtn}
            >
              <Play size={14} />
              <span>{loading ? 'Executing...' : 'Send Live Request'}</span>
            </button>
          </div>

          <div style={styles.requestUrlBar}>
            <span style={styles.requestMethod}>{currentEp.method}</span>
            <span style={styles.requestUrl}>http://localhost:5001{currentEp.path}</span>
          </div>

          {currentEp.sampleBody && (
            <div style={styles.reqBodySection}>
              <div style={styles.bodyLabel}>Request Payload (JSON)</div>
              <pre style={styles.codeBlock}>{currentEp.sampleBody}</pre>
            </div>
          )}

          {/* Response Box */}
          <div style={styles.responseSection}>
            <div style={styles.responseHeader}>
              <div style={styles.resLabel}>
                <span>Live Server Response</span>
                {responseOutput?.status && (
                  <span style={styles.statusPill}>Status {responseOutput.status} OK</span>
                )}
              </div>
              {responseOutput && (
                <button
                  onClick={() =>
                    handleCopy(JSON.stringify(responseOutput.data, null, 2), 'res')
                  }
                  style={styles.copySmallBtn}
                >
                  {copiedText === 'res' ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                  <span>{copiedText === 'res' ? 'Copied' : 'Copy Response'}</span>
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
                  Click "Send Live Request" above to test this endpoint against the live Express server.
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
    background: 'linear-gradient(135deg, rgba(249, 115, 22, 0.12), rgba(15, 23, 42, 0.6))',
    border: '1px solid rgba(249, 115, 22, 0.3)',
    borderRadius: 'var(--radius-xl)',
  },
  bannerIconBox: {
    padding: '10px',
    background: 'rgba(249, 115, 22, 0.15)',
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
    color: '#fff',
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
    background: '#090d16',
    border: '1px solid var(--border-medium)',
    padding: '8px 14px',
    borderRadius: 'var(--radius-md)',
    fontFamily: 'monospace',
    fontSize: '0.86rem',
    color: 'var(--brand-orange)',
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
    color: '#fff',
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
    borderColor: 'var(--brand-orange)',
    background: 'var(--bg-surface-elevated)',
    boxShadow: '0 4px 14px rgba(0,0,0,0.35)',
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
    color: '#fff',
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
    color: '#fff',
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
    color: 'var(--brand-orange)',
  },
  requestUrl: {
    fontFamily: 'monospace',
    fontSize: '0.84rem',
    color: '#fff',
  },
  reqBodySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  bodyLabel: {
    fontSize: '0.76rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  codeBlock: {
    background: '#090d16',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '12px',
    fontFamily: 'monospace',
    fontSize: '0.8rem',
    color: '#38bdf8',
    overflowX: 'auto',
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
    background: 'rgba(16, 185, 129, 0.15)',
    color: '#34d399',
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
    background: '#090d16',
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
    color: '#e2e8f0',
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
