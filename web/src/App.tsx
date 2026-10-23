import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, type TabId } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { DashboardOverview } from './components/DashboardOverview';
import { CatalogOverview } from './components/CatalogOverview';
import { CategoryManager } from './components/CategoryManager';
import { OrdersManager } from './components/OrdersManager';
import { UserManager } from './components/UserManager';
import { BulkPricingManager } from './components/BulkPricingManager';
import { BannerCMS } from './components/BannerCMS';
import { SectionLayoutManager } from './components/SectionLayoutManager';
import { ApiExplorer } from './components/ApiExplorer';
import { AuditLogViewer } from './components/AuditLogViewer';
import { DeliveryPincodeManager } from './components/DeliveryPincodeManager';
import { AccessManager } from './components/AccessManager';
import { StoreTreeManager } from './components/StoreTreeManager';
import { api, setUnauthorizedHandler } from './services/api';
import { allowedTabs, can, hasAnyAccess, TAB_ORDER } from './services/access';
import {
  loadSession,
  clearSession,
  saveSession,
  type PortalSession,
} from './services/session';
import { INITIAL_SECTIONS } from './data/mockData';
import type { Banner, BulkPriceTier, Product, AuditLog, HomepageSection } from './types';
import type { NewProductInput } from './components/CatalogOverview';
import { CheckCircle2, ShieldOff, X } from 'lucide-react';

function getTabFromHash(): TabId {
  if (typeof window === 'undefined') return 'dashboard';
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase() as TabId;
  return TAB_ORDER.includes(hash) ? hash : 'dashboard';
}

export function App() {
  const [session, setSession] = useState<PortalSession | null>(() => loadSession());
  const [authChecking, setAuthChecking] = useState<boolean>(() => Boolean(loadSession()));
  const [activeTab, setActiveTabState] = useState<TabId>(() => getTabFromHash());
  const [loading, setLoading] = useState<boolean>(true);
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const handleTabChange = useCallback((tab: TabId) => {
    setActiveTabState(tab);
    if (typeof window !== 'undefined') {
      window.location.hash = tab;
    }
  }, []);

  useEffect(() => {
    const onHashChange = () => {
      setActiveTabState(getTabFromHash());
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      setSession(null);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!session?.admin?.id) {
      setAuthChecking(false);
      return;
    }
    let cancelled = false;
    setAuthChecking(true);
    api
      .getAdminMe()
      .then((profile) => {
        if (cancelled) return;
        const next: PortalSession = {
          admin: {
            id: Number(profile.id),
            name: profile.name,
            email: profile.email,
            role: profile.role,
            storeRole: profile.storeRole ?? null,
            permissions: profile.permissions ?? {},
          },
        };
        saveSession(next);
        setSession(next);
      })
      .catch(() => {
        if (cancelled) return;
        clearSession();
        setSession(null);
      })
      .finally(() => {
        if (!cancelled) setAuthChecking(false);
      });
    return () => {
      cancelled = true;
    };
    // Re-validate when admin id is present (cookie session)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.admin?.id]);

  const handleLogout = () => {
    api.adminLogout().catch(() => undefined);
    clearSession();
    setSession(null);
    handleTabChange('dashboard');
  };

  if (authChecking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-app)',
          color: 'var(--text-muted)',
          fontSize: '0.9rem',
        }}
      >
        Checking staff session…
      </div>
    );
  }

  if (!session) {
    return <LoginScreen onSuccess={setSession} />;
  }

  return (
    <PortalApp
      session={session}
      onLogout={handleLogout}
      activeTab={activeTab}
      setActiveTab={handleTabChange}
      loading={loading}
      setLoading={setLoading}
      serverOnline={serverOnline}
      setServerOnline={setServerOnline}
      toastMessage={toastMessage}
      setToastMessage={setToastMessage}
    />
  );
}

function PortalApp({
  session,
  onLogout,
  activeTab,
  setActiveTab,
  loading,
  setLoading,
  serverOnline,
  setServerOnline,
  toastMessage,
  setToastMessage,
}: {
  session: PortalSession;
  onLogout: () => void;
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  serverOnline: boolean;
  setServerOnline: (v: boolean) => void;
  toastMessage: string | null;
  setToastMessage: (v: string | null) => void;
}) {
  const permissions = session.admin.permissions;
  const tabs = allowedTabs(permissions);
  const currentTab: TabId | undefined = tabs.includes(activeTab) ? activeTab : tabs[0];

  useEffect(() => {
    if (currentTab && currentTab !== activeTab) setActiveTab(currentTab);
  }, [currentTab, activeTab, setActiveTab]);

  // Live state from backend
  const [products, setProducts] = useState<Product[]>([]);
  /** Full catalogue size from API meta.total (not products.length — list is paginated). */
  const [catalogTotal, setCatalogTotal] = useState(0);
  const [categories, setCategories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bulkTiers, setBulkTiers] = useState<BulkPriceTier[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [sections, setSections] = useState<HomepageSection[]>(INITIAL_SECTIONS);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  const addAuditLog = (action: string, entity: AuditLog['entity'], details: string) => {
    const actor = `${session.admin.name} (${session.admin.storeRole ?? 'no role'})`;
    const optimisticId = `log-pending-${Date.now()}`;
    const optimistic: AuditLog = {
      id: optimisticId,
      action,
      entity,
      details,
      user: actor,
      timestamp: new Date().toISOString(),
    };
    setAuditLogs((prev) => [optimistic, ...prev]);

    api
      .createAuditLog({
        action,
        entity,
        details,
        user: actor,
      })
      .then((saved) => {
        if (!saved?.id) {
          setAuditLogs((prev) => prev.filter((l) => l.id !== optimisticId));
          return;
        }
        setAuditLogs((prev) =>
          prev.map((l) =>
            l.id === optimisticId
              ? {
                  ...l,
                  id: String(saved.id),
                  timestamp: saved.timestamp || l.timestamp,
                }
              : l
          )
        );
      })
      .catch((err) => {
        // L1: do not leave a fake row if persist failed
        setAuditLogs((prev) => prev.filter((l) => l.id !== optimisticId));
        console.warn('Failed to persist audit log', err);
        showToast('Audit log could not be saved — change still applied, trail incomplete');
      });
  };

  // Fetch all data from live backend
  const loadData = useCallback(async () => {
    if (!hasAnyAccess(permissions)) return;
    try {
      setLoading(true);
      const [
        prodsData,
        catsData,
        ordersData,
        usersData,
        tiersData,
        bannersData,
        sectionsData,
        auditData,
      ] = await Promise.all([
        api.getProducts({ page: 1, limit: 100 }).catch(() => ({ products: [], meta: { total: 0 } })),
        api.getCategories().catch(() => []),
        can(permissions, 'orders', 'view') ? api.getOrders().catch(() => []) : Promise.resolve([]),
        can(permissions, 'customers', 'view') ? api.getUsers().catch(() => []) : Promise.resolve([]),
        api.getBulkTiers().catch(() => []),
        api.getBanners().catch(() => []),
        api.getSections().catch(() => INITIAL_SECTIONS),
        can(permissions, 'audit', 'view') ? api.getAuditLogs(100).catch(() => []) : Promise.resolve([]),
      ]);

      setProducts(prodsData.products || []);
      setCatalogTotal(Number(prodsData.meta?.total) || (prodsData.products || []).length);
      setCategories(catsData);
      setOrders(ordersData);
      setUsers(usersData);
      setBulkTiers(tiersData);
      setBanners(bannersData);
      if (Array.isArray(sectionsData) && sectionsData.length > 0) {
        setSections(sectionsData as HomepageSection[]);
      }
      if (Array.isArray(auditData)) {
        setAuditLogs(auditData as AuditLog[]);
      }
      setServerOnline(true);
    } catch (err: any) {
      console.error('Failed to load from backend API', err);
      setServerOnline(false);
    } finally {
      setLoading(false);
    }
  }, [permissions, setLoading, setServerOnline]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Product Actions
  const handleUpdateProduct = async (updated: Product) => {
    try {
      const saved = await api.updateProduct(updated.id, updated);
      setProducts((prev) =>
        prev.map((p) =>
          p.id === updated.id
            ? {
                ...updated,
                price: Number(saved?.price ?? updated.price),
                stockQuantity: Number(saved?.stockQuantity ?? updated.stockQuantity),
                stockStatus: saved?.stockStatus ?? updated.stockStatus,
                unit: saved?.unit ?? updated.unit,
              }
            : p
        )
      );
      addAuditLog(
        'Updated Material SKU',
        'product',
        `Adjusted ${updated.name}: ₹${updated.price}, Stock: ${updated.stockQuantity} units`
      );
      showToast(`Product "${updated.name}" updated on backend!`);
    } catch (err: any) {
      showToast(`Failed to update product: ${err.message}`);
    }
  };

  const handleCreateProduct = async (input: NewProductInput) => {
    try {
      const created = await api.createProduct(input);
      const categoryName = categories.find((c) => String(c.id) === String(input.categoryId))?.name;
      const product: Product = {
        id: String(created.id ?? `prod-${Date.now()}`),
        name: created.name ?? input.name,
        categoryId: String(created.categoryId ?? input.categoryId),
        categoryName: created.categoryName ?? categoryName,
        sku: created.sku ?? input.sku,
        brandName: created.brandName ?? input.brandName,
        unit: created.unit ?? input.unit,
        price: Number(created.price ?? input.price),
        stockQuantity: Number(created.stockQuantity ?? input.stockQuantity),
        stockStatus:
          created.stockStatus ??
          (Number(input.stockQuantity) > 0 ? 'in_stock' : 'out_of_stock'),
        description: created.description ?? input.description ?? '',
      };
      setProducts((prev) => [product, ...prev]);
      setCatalogTotal((n) => n + 1);
      addAuditLog('Created Material SKU', 'product', `Added ${product.name} at ₹${product.price}`);
      showToast(`Product "${product.name}" created.`);
    } catch (err: any) {
      showToast(`Failed to create product: ${err.message}`);
      throw err;
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await api.deleteProduct(id);
      const removed = products.find((p) => p.id === id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setCatalogTotal((n) => Math.max(0, n - 1));
      addAuditLog('Deleted Material SKU', 'product', `Removed ${removed?.name || id}`);
      showToast(removed ? `"${removed.name}" removed from catalogue.` : 'Product removed.');
    } catch (err: any) {
      showToast(`Failed to delete product: ${err.message}`);
      throw err;
    }
  };

  // Order Actions
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.updateOrderStatus(orderId, status);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      addAuditLog(
        'Updated Order Status',
        'order',
        `Order ${orderId} marked as ${status}`
      );
      showToast(`Order status updated to "${status.replace(/_/g, ' ')}"`);
    } catch (err: any) {
      showToast(`Failed to update status: ${err.message}`);
    }
  };

  // Bulk Tier Actions
  const handleAddTier = async (newTier: BulkPriceTier) => {
    try {
      const created = await api.createBulkTier(newTier);
      setBulkTiers((prev) => [...prev, created]);
      addAuditLog(
        'Created Bulk Tier',
        'bulk_tier',
        `Added ${newTier.discountValue}% tier for ${newTier.productName}`
      );
      showToast(`Bulk pricing tier added for ${newTier.productName}!`);
    } catch (err: any) {
      showToast(`Failed to save bulk tier: ${err.message}`);
    }
  };

  const handleUpdateTier = async (tier: BulkPriceTier) => {
    try {
      const saved = await api.updateBulkTier(tier.id, {
        productId: tier.productId,
        productName: tier.productName,
        minQty: tier.minQty,
        maxQty: tier.maxQty ?? null,
        discountType: tier.discountType,
        discountValue: tier.discountValue,
        terms: tier.terms,
      });
      setBulkTiers((prev) =>
        prev.map((row) => (row.id === tier.id ? { ...row, ...saved, id: String(saved?.id ?? tier.id) } : row))
      );
      addAuditLog(
        'Updated Bulk Tier',
        'bulk_tier',
        `Updated ${tier.productName || tier.productId}: ${tier.minQty}+ at ${tier.discountValue}`
      );
      showToast(`Bulk tier updated for ${tier.productName || 'product'}.`);
    } catch (err: any) {
      showToast(`Failed to update bulk tier: ${err.message}`);
    }
  };

  const handleDeleteTier = async (id: string) => {
    try {
      await api.deleteBulkTier(id);
      setBulkTiers((prev) => prev.filter((t) => t.id !== id));
      addAuditLog('Deleted Bulk Tier', 'bulk_tier', `Removed tier rule ${id}`);
      showToast('Bulk pricing tier removed from backend.');
    } catch (err: any) {
      showToast(`Failed to delete tier: ${err.message}`);
    }
  };

  // Banner Actions
  const handleSaveBanner = async (banner: Banner) => {
    try {
      const exists = banners.some((b) => b.id === banner.id);
      let resultBanner: Banner;
      if (exists) {
        resultBanner = await api.updateBanner(banner.id, banner);
        setBanners((prev) => prev.map((b) => (b.id === banner.id ? resultBanner : b)));
      } else {
        resultBanner = await api.createBanner(banner);
        setBanners((prev) => [...prev, resultBanner]);
      }
      addAuditLog('Saved Campaign Banner', 'banner', `Saved "${banner.title}"`);
      showToast(`Banner "${banner.title}" saved successfully!`);
    } catch (err: any) {
      showToast(`Failed to save banner: ${err.message}`);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    try {
      await api.deleteBanner(id);
      setBanners((prev) => prev.filter((b) => b.id !== id));
      addAuditLog('Deleted Banner', 'banner', `Removed banner ${id}`);
      showToast('Banner removed.');
    } catch (err: any) {
      showToast(`Failed to delete banner: ${err.message}`);
    }
  };

  const handleReorderBanner = async (id: string, direction: 'up' | 'down') => {
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
    await api.updateBanner(sorted[index].id, { position: targetPos });
    await api.updateBanner(sorted[targetIndex].id, { position: currentPos });
    showToast('Banner order updated.');
  };

  const handleStatusChangeBanner = async (id: string, newStatus: Banner['status']) => {
    try {
      if (newStatus === 'published') {
        const banner = banners.find((b) => b.id === id);
        if (banner) {
          const imageOk =
            Boolean(banner.imageUrl?.trim()) &&
            (banner.imageUrl.startsWith('/') || /^https?:\/\//i.test(banner.imageUrl));
          const ctaOk = Boolean(banner.ctaLabel?.trim());
          if (!imageOk || !ctaOk || !banner.title?.trim()) {
            showToast('Cannot publish: fix title, image URL, and CTA first.');
            return;
          }
        }
      }
      await api.updateBanner(id, { status: newStatus });
      setBanners((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
      );
      showToast(`Banner marked as ${newStatus}`);
    } catch (err: any) {
      showToast(`Failed to update banner status: ${err.message}`);
    }
  };

  // Homepage section actions
  const handleToggleSection = async (id: string) => {
    const current = sections.find((s) => s.id === id);
    if (!current) return;
    const nextEnabled = !current.enabled;
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: nextEnabled } : s)));
    try {
      await api.updateSection(id, { enabled: nextEnabled });
      addAuditLog(
        nextEnabled ? 'Enabled Homepage Section' : 'Disabled Homepage Section',
        'section',
        `${current.title} set to ${nextEnabled ? 'visible' : 'hidden'}`
      );
      showToast(`Section "${current.title}" ${nextEnabled ? 'shown' : 'hidden'} on mobile home.`);
    } catch (err: any) {
      setSections((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: current.enabled } : s)));
      showToast(`Failed to update section: ${err.message}`);
    }
  };

  const handleReorderSection = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...sections].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((s) => s.id === id);
    if (index === -1) return;
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const currentPos = sorted[index].position;
    const targetPos = sorted[targetIndex].position;
    sorted[index] = { ...sorted[index], position: targetPos };
    sorted[targetIndex] = { ...sorted[targetIndex], position: currentPos };
    setSections([...sorted]);

    try {
      await api.reorderSections([
        { id: sorted[index].id, position: sorted[index].position },
        { id: sorted[targetIndex].id, position: sorted[targetIndex].position },
      ]);
      addAuditLog('Reordered Homepage Sections', 'section', `Moved "${sorted[index].title}" ${direction}`);
      showToast('Homepage section order updated.');
    } catch (err: any) {
      showToast(`Failed to reorder sections: ${err.message}`);
      loadData();
    }
  };

  const handleResetSections = async () => {
    try {
      const reset = await api.resetSections();
      setSections(Array.isArray(reset) && reset.length ? (reset as HomepageSection[]) : INITIAL_SECTIONS);
      addAuditLog('Reset Homepage Layout', 'section', 'Restored SRS default section order and visibility');
      showToast('Homepage sections reset to SRS defaults.');
    } catch (err: any) {
      setSections(INITIAL_SECTIONS);
      showToast(`Reset locally (API: ${err.message})`);
    }
  };

  const titles: Record<TabId, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Store Operations Dashboard',
      subtitle: 'KPI overview and shortcuts into catalog, CMS, pricing, and fulfillment workflows',
    },
    catalog: {
      title: 'Products & Inventory Management',
      subtitle: 'Live construction materials inventory, selling units, and base prices served via GET /catalog/products',
    },
    categories: {
      title: 'Categories & Subcategories',
      subtitle: 'Maintain the trade hierarchy the mobile Categories tab and product filters consume',
    },
    orders: {
      title: 'Orders & Fulfillment Desk',
      subtitle: 'Real-time order pipeline from customer mobile app and contractor procurement desk',
    },
    delivery: {
      title: 'Delivery Pincodes',
      subtitle: 'Where each store delivers; checkout refuses pincodes that are paused or have no store',
    },
    stores: {
      title: 'Stores & Groups',
      subtitle: 'Which store serves which pincode, and the zones, areas and clusters they sit in',
    },
    users: {
      title: 'Customer Directory & Accounts (homecare DB)',
      subtitle: 'Customer identities, registered delivery locations and spend metrics synced from homecare.users and techxpertstore',
    },
    pricing: {
      title: 'Bulk Pricing Rules & Tier Precedence',
      subtitle: 'Wholesale quantity thresholds and volume discount calculation rules',
    },
    banners: {
      title: 'Campaign & Hero Carousel Banners',
      subtitle: 'Promotional banners for the mobile app home screen served via GET /cms/banners',
    },
    sections: {
      title: 'Homepage Section Layout',
      subtitle: 'Toggle and reorder mobile home modules via GET/PUT /cms/sections — no app release required',
    },
    api: {
      title: 'Backend API & Mobile App Integration',
      subtitle: 'Interactive endpoint tester and configuration guide for the Expo React Native app',
    },
    audit: {
      title: 'Audit Log & Change Trail',
      subtitle: 'Operational logs of product, pricing, and fulfillment changes',
    },
    access: {
      title: 'Roles & Access',
      subtitle: 'Who can open which module, and whether they can edit or delete there',
    },
  };

  if (!currentTab) {
    return (
      <div style={styles.noAccess}>
        <ShieldOff size={28} color="var(--text-dim)" />
        <h2 style={styles.noAccessTitle}>No portal access yet</h2>
        <p style={styles.noAccessText}>
          You're signed in as {session.admin.name}, but no store role has been given to this login. Ask a store
          admin to assign you a role in Roles &amp; Access.
        </p>
        <button type="button" onClick={onLogout} style={styles.noAccessButton}>
          Sign out
        </button>
      </div>
    );
  }

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
        activeTab={currentTab}
        visibleTabs={tabs}
        onTabChange={(tab) => setActiveTab(tab)}
        ordersCount={orders.length}
        productsCount={catalogTotal || products.length}
        usersCount={users.length}
        serverOnline={serverOnline}
        adminName={session.admin.name}
        adminRole={session.admin.storeRole ?? 'No role'}
        onLogout={onLogout}
      />

      {/* Main Content */}
      <div style={styles.mainWrapper}>
        <Header
          title={titles[currentTab].title}
          subtitle={titles[currentTab].subtitle}
          onRefresh={loadData}
          loading={loading}
          serverOnline={serverOnline}
        />

        <main style={styles.contentArea}>
          {currentTab === 'dashboard' && (
            <DashboardOverview
              products={products}
              catalogTotal={catalogTotal}
              orders={orders}
              users={users}
              banners={banners}
              bulkTiers={bulkTiers}
              sectionsCount={sections.length}
              sectionsEnabled={sections.filter((s) => s.enabled).length}
              serverOnline={serverOnline}
              onNavigate={setActiveTab}
              canView={(tab) => tabs.includes(tab)}
            />
          )}

          {currentTab === 'catalog' && (
            <CatalogOverview
              products={products}
              catalogTotal={catalogTotal}
              onCatalogTotalChange={setCatalogTotal}
              categories={categories}
              onUpdateProduct={handleUpdateProduct}
              onCreateProduct={handleCreateProduct}
              canEdit={can(permissions, 'products', 'edit')}
              canDelete={can(permissions, 'products', 'delete')}
              onDeleteProduct={handleDeleteProduct}
            />
          )}

          {currentTab === 'categories' && (
            <CategoryManager
              canEdit={can(permissions, 'categories', 'edit')}
              canDelete={can(permissions, 'categories', 'delete')}
              onHierarchyChanged={loadData}
              onAudit={(action, details) => addAuditLog(action, 'category', details)}
            />
          )}

          {currentTab === 'orders' && (
            <OrdersManager
              orders={orders}
              onUpdateStatus={handleUpdateOrderStatus}
              loading={loading}
              canEdit={can(permissions, 'orders', 'edit')}
            />
          )}

          {currentTab === 'delivery' && (
            <DeliveryPincodeManager
              canManage={can(permissions, 'delivery', 'edit')}
              canSeeStores={can(permissions, 'stores', 'view')}
              onAudit={(action, details) => addAuditLog(action, 'delivery', details)}
              onToast={showToast}
            />
          )}

          {currentTab === 'stores' && (
            <StoreTreeManager
              canEdit={can(permissions, 'stores', 'edit')}
              canDelete={can(permissions, 'stores', 'delete')}
              onToast={showToast}
            />
          )}

          {currentTab === 'users' && <UserManager />}

          {currentTab === 'pricing' && (
            <BulkPricingManager
              tiers={bulkTiers}
              products={products}
              onAddTier={handleAddTier}
              onUpdateTier={handleUpdateTier}
              canEdit={can(permissions, 'pricing', 'edit')}
              canDelete={can(permissions, 'pricing', 'delete')}
              onDeleteTier={handleDeleteTier}
            />
          )}

          {currentTab === 'banners' && (
            <BannerCMS
              banners={banners}
              onSaveBanner={handleSaveBanner}
              canEdit={can(permissions, 'banners', 'edit')}
              canDelete={can(permissions, 'banners', 'delete')}
              onDeleteBanner={handleDeleteBanner}
              onReorder={handleReorderBanner}
              onStatusChange={handleStatusChangeBanner}
              selectedBannerId={banners[0]?.id}
              onSelectBanner={() => {}}
            />
          )}

          {currentTab === 'sections' && (
            <SectionLayoutManager
              sections={sections}
              onToggleSection={handleToggleSection}
              onReorderSection={handleReorderSection}
              canEdit={can(permissions, 'sections', 'edit')}
              canDelete={can(permissions, 'sections', 'delete')}
              onResetDefaultOrder={handleResetSections}
            />
          )}

          {currentTab === 'api' && <ApiExplorer />}

          {currentTab === 'audit' && <AuditLogViewer logs={auditLogs} />}

          {currentTab === 'access' && (
            <AccessManager
              permissions={permissions}
              canEdit={can(permissions, 'access', 'edit')}
              canDelete={can(permissions, 'access', 'delete')}
              onToast={showToast}
            />
          )}
        </main>
      </div>
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
    maxWidth: '1440px',
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
  noAccess: {
    minHeight: '100vh',
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '12px',
    padding: '24px',
    background: 'var(--bg-app)',
    textAlign: 'center',
  },
  noAccessTitle: {
    margin: 0,
    color: '#fff',
    fontSize: '1.2rem',
    fontWeight: 700,
  },
  noAccessText: {
    margin: 0,
    maxWidth: '440px',
    color: 'var(--text-muted)',
    fontSize: '0.9rem',
    lineHeight: 1.5,
  },
  noAccessButton: {
    marginTop: '8px',
    padding: '8px 16px',
    borderRadius: 'var(--radius-md)',
    border: '1px solid var(--border-subtle)',
    background: 'rgba(255,255,255,0.06)',
    color: '#fff',
    fontWeight: 600,
    cursor: 'pointer',
  },
  toastClose: {
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
};

export default App;
