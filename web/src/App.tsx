import React, { useState, useEffect, useCallback, useRef } from 'react';
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
import type { Banner, BulkPriceTier, Product, AuditLog, HomepageSection } from './types';
import type { NewProductInput } from './components/CatalogOverview';
import { ShieldOff } from 'lucide-react';
import { useToast } from './components/ui';

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
  /** null until the first health check answers. */
  const [serverOnline, setServerOnline] = useState<boolean | null>(null);
  const toast = useToast();

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

  /** A wrong password is also a 401; only a real session ending deserves a toast. */
  const signedIn = useRef(false);
  useEffect(() => {
    signedIn.current = Boolean(session);
  }, [session]);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      clearSession();
      if (signedIn.current) toast.info('Your session ended. Sign in again to continue.');
      signedIn.current = false;
      setSession(null);
    });
    return () => setUnauthorizedHandler(null);
  }, [toast]);

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
        // A 401 already signed out through the unauthorized handler. Anything else means the server
        // can't be reached: keep the stored profile so the screens show "Can't reach the server".
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
    toast.info('You are signed out.');
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
}: {
  session: PortalSession;
  onLogout: () => void;
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  serverOnline: boolean | null;
  setServerOnline: (v: boolean) => void;
}) {
  const toast = useToast();
  const permissions = session.admin.permissions;
  const tabs = allowedTabs(permissions, session.admin.role === 'super_admin');
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
  /** Sidebar counts stay hidden until they have loaded once, so a failed first load never reads as 0. */
  const [countsKnown, setCountsKnown] = useState({ products: false, orders: false, users: false });
  const [users, setUsers] = useState<any[]>([]);
  const [bulkTiers, setBulkTiers] = useState<BulkPriceTier[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [sectionsError, setSectionsError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);

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
        toast.error('The change was saved, but it could not be added to the audit trail.');
      });
  };

  // Fetch all data from live backend
  const loadData = useCallback(async (announce = false) => {
    if (!hasAnyAccess(permissions)) return;
    const failed: string[] = [];
    /** A failed piece resolves to undefined so the screen keeps the last data that did load. */
    const soft = <T,>(request: Promise<T>, what: string): Promise<T | undefined> =>
      request.catch(() => {
        failed.push(what);
        return undefined;
      });
    const skip = Promise.resolve(undefined);
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
        healthy,
      ] = await Promise.all([
        soft(api.getProducts({ page: 1, limit: 100 }), 'products'),
        soft(api.getCategories(), 'categories'),
        can(permissions, 'orders', 'view') ? soft(api.getOrders(), 'orders') : skip,
        can(permissions, 'customers', 'view') ? soft(api.getUsers(), 'customers') : skip,
        soft(api.getBulkTiers(), 'bulk pricing'),
        soft(api.getBanners(), 'banners'),
        soft(api.getSections(), 'homepage sections'),
        can(permissions, 'audit', 'view') ? soft(api.getAuditLogs(100), 'audit trail') : skip,
        api
          .getHealth()
          .then(() => true)
          .catch(() => false),
      ]);

      if (prodsData) {
        setProducts(prodsData.products || []);
        setCatalogTotal(Number(prodsData.meta?.total) || (prodsData.products || []).length);
      }
      if (catsData) setCategories(catsData);
      if (ordersData) setOrders(ordersData);
      if (usersData) setUsers(usersData);
      setCountsKnown((prev) => ({
        products: prev.products || Boolean(prodsData),
        orders: prev.orders || Boolean(ordersData),
        users: prev.users || Boolean(usersData),
      }));
      if (tiersData) setBulkTiers(tiersData);
      if (bannersData) setBanners(bannersData);
      if (Array.isArray(sectionsData)) {
        setSections(sectionsData as HomepageSection[]);
        setSectionsError(null);
      } else {
        setSectionsError("Couldn't load homepage sections.");
      }
      if (Array.isArray(auditData)) {
        setAuditLogs(auditData as AuditLog[]);
      }
      setServerOnline(healthy);
      if (!healthy) {
        toast.error("Can't reach the server. What you see may be out of date; press Refresh to try again.");
      } else if (failed.length) {
        toast.error(`Couldn't load ${failed.join(', ')}. Press Refresh to try again.`);
      } else if (announce) {
        toast.success('Everything is up to date.');
      }
    } catch (err: any) {
      console.error('Failed to load from backend API', err);
      setServerOnline(false);
      toast.error("Can't reach the server. Press Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [permissions, setLoading, setServerOnline, toast]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useEffect(() => {
    const timer = setInterval(() => {
      api
        .getHealth()
        .then(() => true)
        .catch(() => false)
        .then((healthy) => {
          if (healthy && serverOnline === false) toast.success('Connected to the server again.');
          if (healthy !== serverOnline) setServerOnline(healthy);
        });
    }, 30_000);
    return () => clearInterval(timer);
  }, [serverOnline, setServerOnline, toast]);

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
      toast.success(`"${updated.name}" saved.`);
    } catch (err: any) {
      toast.error(`Couldn't save "${updated.name}": ${err.message}`);
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
      toast.success(`"${product.name}" added to products.`);
    } catch (err: any) {
      toast.error(`Couldn't add the product: ${err.message}`);
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
      toast.success(removed ? `"${removed.name}" removed from products.` : 'Product removed.');
    } catch (err: any) {
      toast.error(`Couldn't remove the product: ${err.message}`);
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
      toast.success(`Order marked as ${status.replace(/_/g, ' ')}.`);
    } catch (err: any) {
      toast.error(`Couldn't change the order status: ${err.message}`);
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
      toast.success(`Bulk price added for ${newTier.productName || 'the product'}.`);
    } catch (err: any) {
      toast.error(`Couldn't add the bulk price: ${err.message}`);
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
      toast.success(`Bulk price saved for ${tier.productName || 'the product'}.`);
    } catch (err: any) {
      toast.error(`Couldn't save the bulk price: ${err.message}`);
    }
  };

  const handleDeleteTier = async (id: string) => {
    try {
      await api.deleteBulkTier(id);
      setBulkTiers((prev) => prev.filter((t) => t.id !== id));
      addAuditLog('Deleted Bulk Tier', 'bulk_tier', `Removed tier rule ${id}`);
      toast.success('Bulk price removed.');
    } catch (err: any) {
      toast.error(`Couldn't remove the bulk price: ${err.message}`);
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
      toast.success(`Banner "${banner.title}" saved.`);
    } catch (err: any) {
      toast.error(`Couldn't save the banner: ${err.message}`);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    try {
      await api.deleteBanner(id);
      setBanners((prev) => prev.filter((b) => b.id !== id));
      addAuditLog('Deleted Banner', 'banner', `Removed banner ${id}`);
      toast.success('Banner removed.');
    } catch (err: any) {
      toast.error(`Couldn't remove the banner: ${err.message}`);
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
    try {
      await api.updateBanner(sorted[index].id, { position: targetPos });
      await api.updateBanner(sorted[targetIndex].id, { position: currentPos });
      toast.success('Banner order saved.');
    } catch (err: any) {
      toast.error(`Couldn't save the banner order: ${err.message}`);
      loadData();
    }
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
            toast.error("Can't publish yet: the banner needs a title, an image and a button label.");
            return;
          }
        }
      }
      await api.updateBanner(id, { status: newStatus });
      setBanners((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
      );
      toast.success(newStatus === 'draft' ? 'Banner moved back to draft.' : `Banner ${newStatus}.`);
    } catch (err: any) {
      toast.error(`Couldn't change the banner: ${err.message}`);
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
      toast.success(`"${current.title}" is now ${nextEnabled ? 'shown' : 'hidden'} on the app home screen.`);
    } catch (err: any) {
      setSections((prev) => prev.map((s) => (s.id === id ? { ...s, enabled: current.enabled } : s)));
      toast.error(`Couldn't change "${current.title}": ${err.message}`);
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
      toast.success('Homepage section order saved.');
    } catch (err: any) {
      toast.error(`Couldn't save the section order: ${err.message}`);
      loadData();
    }
  };

  const handleResetSections = async () => {
    try {
      const reset = await api.resetSections();
      if (Array.isArray(reset) && reset.length) setSections(reset as HomepageSection[]);
      else await loadData();
      addAuditLog('Reset Homepage Layout', 'section', 'Restored the default section order and visibility');
      toast.success('Homepage sections reset to the default layout.');
    } catch (err: any) {
      toast.error(`Couldn't reset the homepage sections: ${err.message}`);
    }
  };

  const titles: Record<TabId, { title: string; subtitle: string }> = {
    dashboard: {
      title: 'Dashboard',
      subtitle: 'Today at a glance, with shortcuts to the screens you use most',
    },
    catalog: {
      title: 'Products',
      subtitle: 'What customers can buy in the app: names, selling units, prices and stock',
    },
    categories: {
      title: 'Categories',
      subtitle: 'The categories and subcategories customers browse in the app',
    },
    orders: {
      title: 'Orders',
      subtitle: 'Orders placed in the app, and where each one is in fulfilment',
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
      title: 'Customers',
      subtitle: 'People who signed up in the app, their saved addresses and what they have ordered',
    },
    pricing: {
      title: 'Bulk Pricing',
      subtitle: 'Discounts for buying larger quantities',
    },
    banners: {
      title: 'Campaign Banners',
      subtitle: 'The promotional banners on the app home screen',
    },
    sections: {
      title: 'Homepage Sections',
      subtitle: 'Which blocks the app home screen shows, and in what order. Changes appear without an app update',
    },
    api: {
      title: 'Developer tools',
      subtitle: 'For developers: test server endpoints and connect the phone app (super admin only)',
    },
    audit: {
      title: 'Audit Trail',
      subtitle: 'Who changed what in the portal, and when',
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
      {/* Left Sidebar */}
      <Sidebar
        activeTab={currentTab}
        visibleTabs={tabs}
        onTabChange={(tab) => setActiveTab(tab)}
        ordersCount={countsKnown.orders ? orders.length : undefined}
        productsCount={countsKnown.products ? catalogTotal || products.length : undefined}
        usersCount={countsKnown.users ? users.length : undefined}
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
          onRefresh={() => loadData(true)}
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
            />
          )}

          {currentTab === 'stores' && (
            <StoreTreeManager
              canEdit={can(permissions, 'stores', 'edit')}
              canDelete={can(permissions, 'stores', 'delete')}
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
              loadError={sectionsError}
              onRetry={() => loadData(true)}
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
    color: 'var(--text-main)',
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
    background: 'var(--tint-2)',
    color: 'var(--text-main)',
    fontWeight: 600,
    cursor: 'pointer',
  },
};

export default App;
