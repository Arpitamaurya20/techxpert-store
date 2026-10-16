import React, { useState, useEffect } from 'react';
import { Sidebar, type TabId } from './components/Sidebar';
import { Header } from './components/Header';
import { BannerCMS } from './components/BannerCMS';
import { SectionLayoutManager } from './components/SectionLayoutManager';
import { BulkPricingManager } from './components/BulkPricingManager';
import { CatalogOverview } from './components/CatalogOverview';
import { AuditLogViewer } from './components/AuditLogViewer';
import { LiveMobileSimulator } from './components/LiveMobileSimulator';
import {
  INITIAL_BANNERS,
  INITIAL_SECTIONS,
  INITIAL_CATEGORIES,
  INITIAL_PRODUCTS,
  INITIAL_BULK_TIERS,
  INITIAL_AUDIT_LOGS,
} from './data/mockData';
import type { Banner, HomepageSection, BulkPriceTier, Product, AuditLog, BannerStatus } from './types';
import { CheckCircle2, X } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('banners');
  const [showMobileSimulator, setShowMobileSimulator] = useState<boolean>(true);
  const [selectedBannerId, setSelectedBannerId] = useState<string | undefined>(
    INITIAL_BANNERS[0]?.id
  );

  // Core application states initialized with seed data or saved localStorage
  const [banners, setBanners] = useState<Banner[]>(() => {
    const saved = localStorage.getItem('techxpert_banners');
    return saved ? JSON.parse(saved) : INITIAL_BANNERS;
  });

  const [sections, setSections] = useState<HomepageSection[]>(() => {
    const saved = localStorage.getItem('techxpert_sections');
    return saved ? JSON.parse(saved) : INITIAL_SECTIONS;
  });

  const [bulkTiers, setBulkTiers] = useState<BulkPriceTier[]>(() => {
    const saved = localStorage.getItem('techxpert_bulk_tiers');
    return saved ? JSON.parse(saved) : INITIAL_BULK_TIERS;
  });

  const [products, setProducts] = useState<Product[]>(() => {
    const saved = localStorage.getItem('techxpert_products');
    return saved ? JSON.parse(saved) : INITIAL_PRODUCTS;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => {
    const saved = localStorage.getItem('techxpert_audit_logs');
    return saved ? JSON.parse(saved) : INITIAL_AUDIT_LOGS;
  });

  const [isPublishing, setIsPublishing] = useState(false);
  const [lastPublished, setLastPublished] = useState('Today at 11:30 AM');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Sync to localStorage
  useEffect(() => {
    localStorage.setItem('techxpert_banners', JSON.stringify(banners));
  }, [banners]);

  useEffect(() => {
    localStorage.setItem('techxpert_sections', JSON.stringify(sections));
  }, [sections]);

  useEffect(() => {
    localStorage.setItem('techxpert_bulk_tiers', JSON.stringify(bulkTiers));
  }, [bulkTiers]);

  useEffect(() => {
    localStorage.setItem('techxpert_products', JSON.stringify(products));
  }, [products]);

  useEffect(() => {
    localStorage.setItem('techxpert_audit_logs', JSON.stringify(auditLogs));
  }, [auditLogs]);

  // Helper to append an audit log
  const addAuditLog = (action: string, entity: AuditLog['entity'], details: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action,
      entity,
      details,
      user: 'Arpit Maurya (Merchandiser)',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => {
      setToastMessage(null);
    }, 3800);
  };

  // Banner Actions
  const handleSaveBanner = (savedBanner: Banner) => {
    setBanners((prev) => {
      const exists = prev.some((b) => b.id === savedBanner.id);
      if (exists) {
        return prev.map((b) => (b.id === savedBanner.id ? savedBanner : b));
      }
      return [...prev, savedBanner];
    });
    setSelectedBannerId(savedBanner.id);
    addAuditLog('Saved Campaign Banner', 'banner', `Updated "${savedBanner.title}" banner details`);
    showToast(`Banner "${savedBanner.title}" saved successfully!`);
  };

  const handleDeleteBanner = (id: string) => {
    const bannerToDelete = banners.find((b) => b.id === id);
    setBanners((prev) => prev.filter((b) => b.id !== id));
    addAuditLog('Deleted Banner', 'banner', `Removed banner "${bannerToDelete?.title}"`);
    showToast('Banner removed from campaign list.');
  };

  const handleReorderBanner = (id: string, direction: 'up' | 'down') => {
    const sorted = [...banners].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((b) => b.id === id);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const currentPos = sorted[index].position;
    const targetPos = sorted[targetIndex].position;

    sorted[index].position = targetPos;
    sorted[targetIndex].position = currentPos;

    setBanners([...sorted]);
    addAuditLog('Reordered Banner', 'banner', `Adjusted position of "${sorted[index].title}"`);
    showToast('Banner carousel ordering updated.');
  };

  const handleStatusChange = (id: string, newStatus: BannerStatus) => {
    setBanners((prev) =>
      prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
    );
    const b = banners.find((x) => x.id === id);
    addAuditLog(
      `${newStatus === 'published' ? 'Published' : 'Updated'} Banner`,
      'banner',
      `Set "${b?.title}" status to ${newStatus}`
    );
    showToast(`Banner status changed to ${newStatus}.`);
  };

  // Section Layout Actions
  const handleToggleSection = (id: string) => {
    setSections((prev) =>
      prev.map((s) => (s.id === id ? { ...s, enabled: !s.enabled } : s))
    );
    const sec = sections.find((s) => s.id === id);
    addAuditLog(
      'Toggled Section Visibility',
      'section',
      `${sec?.enabled ? 'Disabled' : 'Enabled'} homepage block "${sec?.title}"`
    );
    showToast(`Homepage section visibility toggled.`);
  };

  const handleReorderSection = (id: string, direction: 'up' | 'down') => {
    const sorted = [...sections].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((s) => s.id === id);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const currentPos = sorted[index].position;
    const targetPos = sorted[targetIndex].position;

    sorted[index].position = targetPos;
    sorted[targetIndex].position = currentPos;

    setSections([...sorted]);
    addAuditLog('Reordered Section', 'section', `Moved section "${sorted[index].title}"`);
    showToast('Homepage section arrangement updated.');
  };

  const handleResetDefaultSections = () => {
    setSections([...INITIAL_SECTIONS]);
    addAuditLog('Reset Sections', 'section', 'Restored SRS recommended homepage order');
    showToast('Reset homepage sections to SRS defaults.');
  };

  // Bulk Pricing Actions
  const handleAddTier = (tier: BulkPriceTier) => {
    setBulkTiers((prev) => [...prev, tier]);
    addAuditLog(
      'Created Bulk Pricing Tier',
      'bulk_tier',
      `Added ${tier.discountValue}% tier for ${tier.productName}`
    );
    showToast(`Bulk pricing tier added for ${tier.productName}.`);
  };

  const handleDeleteTier = (id: string) => {
    setBulkTiers((prev) => prev.filter((t) => t.id !== id));
    addAuditLog('Deleted Bulk Tier', 'bulk_tier', `Removed tier rule ${id}`);
    showToast('Bulk pricing tier removed.');
  };

  // Product Catalog Actions
  const handleUpdateProduct = (updated: Product) => {
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
    addAuditLog(
      'Updated Material SKU',
      'product',
      `Adjusted ${updated.name}: ₹${updated.price}, Stock: ${updated.stockQuantity} units`
    );
    showToast(`Catalog item "${updated.name}" updated!`);
  };

  // Publish All
  const handlePublishAll = () => {
    setIsPublishing(true);
    setTimeout(() => {
      setIsPublishing(false);
      const nowStr = `Today at ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      setLastPublished(nowStr);
      addAuditLog(
        'Published CMS Deployment',
        'publish',
        'Synced all banners, section orders, and bulk rules to production mobile cache'
      );
      showToast('All changes successfully deployed to Techxpert Mobile API!');
    }, 1200);
  };

  const titles: Record<TabId, { title: string; subtitle: string }> = {
    banners: {
      title: 'Campaign Banners & Hero CMS',
      subtitle: 'Manage visual carousels, seasonal offers, and contractor promotions for the mobile app',
    },
    sections: {
      title: 'Homepage Section Layout',
      subtitle: 'Dynamically arrange, order, and toggle mobile homepage blocks without native store updates',
    },
    pricing: {
      title: 'Bulk Pricing & Volume Discounts',
      subtitle: 'Configure wholesale tier savings and test customer checkout calculation rules',
    },
    catalog: {
      title: 'Catalog & Stock Status',
      subtitle: 'Monitor construction material inventory, selling units, and base prices',
    },
    audit: {
      title: 'Publishing Audit & Version Trail',
      subtitle: 'Review timeline of changes, deployments, and editor accountability',
    },
  };

  return (
    <div style={styles.appContainer}>
      {/* Toast Notification */}
      {toastMessage && (
        <div style={styles.toast}>
          <CheckCircle2 size={18} color="#10b981" />
          <span style={styles.toastText}>{toastMessage}</span>
          <button onClick={() => setToastMessage(null)} style={styles.toastClose}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Left Sidebar */}
      <Sidebar
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab)}
        showMobileSimulator={showMobileSimulator}
        onToggleSimulator={() => setShowMobileSimulator(!showMobileSimulator)}
      />

      {/* Main Workspace */}
      <div style={styles.mainWrapper}>
        <Header
          title={titles[activeTab].title}
          subtitle={titles[activeTab].subtitle}
          onPublishAll={handlePublishAll}
          isPublishing={isPublishing}
          lastPublished={lastPublished}
        />

        <main style={styles.contentArea}>
          {activeTab === 'banners' && (
            <BannerCMS
              banners={banners}
              onSaveBanner={handleSaveBanner}
              onDeleteBanner={handleDeleteBanner}
              onReorder={handleReorderBanner}
              onStatusChange={handleStatusChange}
              selectedBannerId={selectedBannerId}
              onSelectBanner={(id) => setSelectedBannerId(id)}
            />
          )}

          {activeTab === 'sections' && (
            <SectionLayoutManager
              sections={sections}
              onToggleSection={handleToggleSection}
              onReorderSection={handleReorderSection}
              onResetDefaultOrder={handleResetDefaultSections}
            />
          )}

          {activeTab === 'pricing' && (
            <BulkPricingManager
              tiers={bulkTiers}
              products={products}
              onAddTier={handleAddTier}
              onDeleteTier={handleDeleteTier}
            />
          )}

          {activeTab === 'catalog' && (
            <CatalogOverview
              products={products}
              categories={INITIAL_CATEGORIES}
              onUpdateProduct={handleUpdateProduct}
            />
          )}

          {activeTab === 'audit' && <AuditLogViewer logs={auditLogs} />}
        </main>
      </div>

      {/* Right Live Mobile Simulator */}
      {showMobileSimulator && (
        <LiveMobileSimulator
          banners={banners}
          sections={sections}
          products={products}
          activeBannerId={selectedBannerId}
          onBannerSelect={(id) => setSelectedBannerId(id)}
        />
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  appContainer: {
    display: 'flex',
    width: '100%',
    minHeight: '100vh',
    background: 'var(--bg-app)',
    position: 'relative',
  },
  mainWrapper: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflowY: 'auto',
  },
  contentArea: {
    padding: '28px 32px 60px',
    maxWidth: '1280px',
    width: '100%',
    margin: '0 auto',
  },
  toast: {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    background: '#131b2e',
    border: '1px solid #10b981',
    borderRadius: 'var(--radius-lg)',
    padding: '12px 18px',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5), 0 0 15px rgba(16, 185, 129, 0.2)',
    zIndex: 999,
    animation: 'fadeIn 0.25s ease-out',
  },
  toastText: {
    fontSize: '0.86rem',
    fontWeight: 600,
    color: '#fff',
  },
  toastClose: {
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
};

export default App;
