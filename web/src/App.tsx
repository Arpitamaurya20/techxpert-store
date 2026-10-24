import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Sidebar, type TabId } from './components/Sidebar';
import { Header } from './components/Header';
import { LoginScreen } from './components/LoginScreen';
import { DashboardOverview, type LoadedPieces } from './components/DashboardOverview';
import { CatalogOverview } from './components/CatalogOverview';
import { CategoryManager } from './components/CategoryManager';
import { OrdersManager, type Order } from './components/OrdersManager';
import { UserManager, type CustomerRecord } from './components/UserManager';
import { BulkPricingManager } from './components/BulkPricingManager';
import { BannerCMS } from './components/BannerCMS';
import { SectionLayoutManager } from './components/SectionLayoutManager';
import { HelpManager } from './components/HelpManager';
import { HomeMerchManager } from './components/HomeMerchManager';
import { SearchIdeasManager } from './components/SearchIdeasManager';
import { ApiExplorer } from './components/ApiExplorer';
import { AuditLogViewer } from './components/AuditLogViewer';
import { DeliveryPincodeManager } from './components/DeliveryPincodeManager';
import { AccessManager } from './components/AccessManager';
import { StoreTreeManager } from './components/StoreTreeManager';
import { ChangePasswordDialog, ChangePasswordScreen } from './components/ChangePassword';
import { api, setPasswordChangeHandler, setUnauthorizedHandler } from './services/api';
import { allowedTabs, can, hasAnyAccess, TAB_ORDER } from './services/access';
import { orderStatusLabel } from './services/orderStatus';
import { inr } from './services/format';
import { tierSummary } from './services/bulkTier';
import {
  loadSession,
  clearSession,
  saveSession,
  sessionFrom,
  type PortalSession,
} from './services/session';
import type { Banner, BulkPriceTier, Product, AuditLog, HomepageSection } from './types';
import type { HelpContent, HomeContent, SearchIdeas } from './services/api';
import type { NewProductInput } from './components/CatalogOverview';
import { ShieldOff } from 'lucide-react';
import { useToast } from './components/ui';

function getTabFromHash(): TabId {
  if (typeof window === 'undefined') return 'dashboard';
  const hash = window.location.hash.replace(/^#\/?/, '').toLowerCase() as TabId;
  return TAB_ORDER.includes(hash) ? hash : 'dashboard';
}

const AUDIT_LIMIT = 100;

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
    setPasswordChangeHandler(() => {
      setSession((current) => {
        if (!current || current.admin.mustChangePassword) return current;
        const next = { ...current, admin: { ...current.admin, mustChangePassword: true } };
        saveSession(next);
        return next;
      });
    });
    return () => {
      setUnauthorizedHandler(null);
      setPasswordChangeHandler(null);
    };
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
        const next = sessionFrom(profile);
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

  if (session.admin.mustChangePassword) {
    return <ChangePasswordScreen admin={session.admin} onDone={setSession} onLogout={handleLogout} />;
  }

  return (
    <PortalApp
      session={session}
      onSessionChange={setSession}
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
  onSessionChange,
  onLogout,
  activeTab,
  setActiveTab,
  loading,
  setLoading,
  serverOnline,
  setServerOnline,
}: {
  session: PortalSession;
  onSessionChange: (session: PortalSession) => void;
  onLogout: () => void;
  activeTab: TabId;
  setActiveTab: (t: TabId) => void;
  loading: boolean;
  setLoading: (v: boolean) => void;
  serverOnline: boolean | null;
  setServerOnline: (v: boolean) => void;
}) {
  const toast = useToast();
  const [changingPassword, setChangingPassword] = useState(false);
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
  const [orders, setOrders] = useState<Order[]>([]);
  /** Counts stay hidden until their data has loaded once, so a failed first load never reads as 0. */
  const [loaded, setLoaded] = useState<LoadedPieces>({
    products: false,
    categories: false,
    orders: false,
    users: false,
    banners: false,
    tiers: false,
    sections: false,
    audit: false,
  });
  /** Why each piece failed on the last load; absent when it loaded. */
  const [loadErrors, setLoadErrors] = useState<Partial<Record<keyof LoadedPieces, string>>>({});
  const [users, setUsers] = useState<CustomerRecord[]>([]);
  const [bulkTiers, setBulkTiers] = useState<BulkPriceTier[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [sections, setSections] = useState<HomepageSection[]>([]);
  const [help, setHelp] = useState<HelpContent | null>(null);
  const [helpError, setHelpError] = useState<string | null>(null);
  const [homeMerch, setHomeMerch] = useState<HomeContent | null>(null);
  const [homeMerchError, setHomeMerchError] = useState<string | null>(null);
  const [searchIdeas, setSearchIdeas] = useState<SearchIdeas | null>(null);
  const [searchIdeasError, setSearchIdeasError] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  /** Screens that load their own data reload when this goes up. */
  const [refreshKey, setRefreshKey] = useState(0);

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
    const errors: Partial<Record<keyof LoadedPieces, string>> = {};
    /** A failed piece resolves to undefined so the screen keeps the last data that did load. */
    const soft = <T,>(request: Promise<T>, what: string, piece?: keyof LoadedPieces): Promise<T | undefined> =>
      request.catch((err: Error) => {
        failed.push(what);
        if (piece) errors[piece] = err?.message || "The server didn't answer.";
        return undefined;
      });
    const skip = Promise.resolve(undefined);
    let helpFailed: string | null = null;
    let homeFailed: string | null = null;
    let searchFailed: string | null = null;
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
        helpData,
        homeData,
        searchData,
        auditData,
        healthy,
      ] = await Promise.all([
        soft(api.getProducts({ page: 1, limit: 100 }), 'products', 'products'),
        soft(api.getCategories(), 'categories', 'categories'),
        can(permissions, 'orders', 'view') ? soft(api.getOrders(), 'orders', 'orders') : skip,
        can(permissions, 'customers', 'view') ? soft(api.getUsers(), 'customers', 'users') : skip,
        soft(api.getBulkTiers(), 'bulk pricing', 'tiers'),
        soft(api.getBanners(), 'banners', 'banners'),
        soft(api.getSections(), 'home screen sections', 'sections'),
        can(permissions, 'help', 'view')
          ? api.getHelp().catch((err: Error) => {
              failed.push('the help page');
              helpFailed = err?.message || "The server didn't answer.";
              return undefined;
            })
          : skip,
        can(permissions, 'sections', 'view')
          ? api.getHome().catch((err: Error) => {
              failed.push('the home shortcuts');
              homeFailed = err?.message || "The server didn't answer.";
              return undefined;
            })
          : skip,
        can(permissions, 'sections', 'view')
          ? api.getSearchSuggestions().catch((err: Error) => {
              failed.push('the search ideas');
              searchFailed = err?.message || "The server didn't answer.";
              return undefined;
            })
          : skip,
        can(permissions, 'audit', 'view') ? soft(api.getAuditLogs(AUDIT_LIMIT), 'audit trail', 'audit') : skip,
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
      if (ordersData) setOrders(ordersData as Order[]);
      if (usersData) setUsers(usersData as CustomerRecord[]);
      const sectionsOk = Array.isArray(sectionsData);
      setLoaded((prev) => ({
        products: prev.products || Boolean(prodsData),
        categories: prev.categories || Boolean(catsData),
        orders: prev.orders || Boolean(ordersData),
        users: prev.users || Boolean(usersData),
        banners: prev.banners || Boolean(bannersData),
        tiers: prev.tiers || Boolean(tiersData),
        sections: prev.sections || sectionsOk,
        audit: prev.audit || Array.isArray(auditData),
      }));
      if (!healthy) {
        const unreachable = "Can't reach the server.";
        for (const piece of Object.keys(errors) as (keyof LoadedPieces)[]) errors[piece] = unreachable;
      }
      setLoadErrors(errors);
      if (tiersData) setBulkTiers(tiersData);
      if (bannersData) setBanners(bannersData);
      if (sectionsOk) setSections(sectionsData as HomepageSection[]);
      setHelpError(helpFailed);
      if (helpData) setHelp(helpData);
      setHomeMerchError(homeFailed);
      if (homeData) setHomeMerch(homeData);
      setSearchIdeasError(searchFailed);
      if (searchData) setSearchIdeas(searchData);
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
  /** Rejects on refusal; the edit form shows the reason next to the fields. */
  const handleUpdateProduct = async (updated: Product) => {
    const saved = await api.updateProduct(updated.id, updated);
    const price = saved?.price ?? updated.price;
    const next: Product = {
      ...updated,
      price: price == null ? null : Number(price),
      stockQuantity: Number(saved?.stockQuantity ?? updated.stockQuantity),
      stockStatus: saved?.stockStatus ?? updated.stockStatus,
      unit: saved?.unit ?? updated.unit,
    };
    setProducts((prev) => prev.map((p) => (p.id === updated.id ? next : p)));
    addAuditLog(
      'Saved product',
      'product',
      `Saved ${next.name}: price ${next.price == null ? 'not set' : inr(next.price)}, stock ${
        updated.variants?.length
          ? updated.variants.map((variant) => `${variant.name} ${variant.stockQuantity}`).join(', ')
          : next.stockQuantity
      }, ${updated.highlights?.length ?? 0} highlights, ${updated.specifications?.length ?? 0} specifications`
    );
    toast.success(`"${next.name}" saved.`);
  };

  /** Rejects on refusal; the add form shows the reason. */
  const handleCreateProduct = async (input: NewProductInput) => {
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
      stockStatus: created.stockStatus ?? (Number(input.stockQuantity) > 0 ? 'in_stock' : 'out_of_stock'),
      description: created.description ?? input.description ?? '',
    };
    setProducts((prev) => [product, ...prev]);
    setCatalogTotal((n) => n + 1);
    addAuditLog('Added product', 'product', `Added ${product.name} at ${inr(Number(product.price))}`);
    toast.success(`"${product.name}" added to products.`);
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await api.deleteProduct(id);
      const removed = products.find((p) => p.id === id);
      setProducts((prev) => prev.filter((p) => p.id !== id));
      setCatalogTotal((n) => Math.max(0, n - 1));
      addAuditLog('Removed product', 'product', `Removed ${removed?.name || id}`);
      toast.success(removed ? `"${removed.name}" removed from products.` : 'Product removed.');
    } catch (err: any) {
      toast.error(`Couldn't remove the product: ${err.message}`);
      throw err;
    }
  };

  // Order Actions
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    const order = orders.find((o) => String(o.id) === orderId);
    const number = order?.orderNumber ?? orderId;
    const label = orderStatusLabel(status).toLowerCase();
    try {
      const result = await api.updateOrderStatus(orderId, status);
      setOrders((prev) => prev.map((o) => (String(o.id) === orderId ? { ...o, status } : o)));
      const units = (result?.stockReturned ?? []).reduce((sum: number, line: any) => sum + Number(line.quantity || 0), 0);
      const stockNote = status === 'cancelled' ? (units ? `; ${units} ${units === 1 ? 'unit' : 'units'} put back in stock` : '; no stock put back') : '';
      addAuditLog('Changed order status', 'order', `Marked order ${number} as ${label}${stockNote}`);
      toast.success(`Order ${number} marked as ${label}${stockNote}.`);
      return true;
    } catch (err: any) {
      toast.error(`Couldn't change order ${number}: ${err.message}`);
      return false;
    }
  };

  // Bulk Tier Actions
  /** Rejects on refusal; the bulk price form shows the reason. */
  const handleAddTier = async (newTier: BulkPriceTier) => {
    const created = await api.createBulkTier(newTier);
    setBulkTiers((prev) => [...prev, created]);
    addAuditLog('Added bulk price', 'bulk_tier', `Added ${tierSummary(newTier)}`);
    toast.success(`Bulk price added for ${newTier.productName || 'the product'}.`);
  };

  /** Rejects on refusal; the bulk price form shows the reason. */
  const handleUpdateTier = async (tier: BulkPriceTier) => {
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
    addAuditLog('Saved bulk price', 'bulk_tier', `Saved ${tierSummary(tier)}`);
    toast.success(`Bulk price saved for ${tier.productName || 'the product'}.`);
  };

  const handleDeleteTier = async (id: string) => {
    const tier = bulkTiers.find((t) => t.id === id);
    const what = tier?.productName ? `the bulk price for ${tier.productName}` : 'the bulk price';
    try {
      await api.deleteBulkTier(id);
      setBulkTiers((prev) => prev.filter((t) => t.id !== id));
      addAuditLog('Removed bulk price', 'bulk_tier', tier ? `Removed ${tierSummary(tier)}` : `Removed ${what}`);
      toast.success(`Removed ${what}.`);
    } catch (err: any) {
      toast.error(`Couldn't remove ${what}: ${err.message}`);
    }
  };

  // Banner Actions
  const handleSaveBanner = async (banner: Banner, isNew: boolean) => {
    if (isNew) {
      const created: Banner = await api.createBanner(banner);
      setBanners((prev) => [...prev, created]);
      addAuditLog('Added banner', 'banner', `Added banner "${banner.title}"`);
      toast.success(`Banner "${banner.title}" added.`);
    } else {
      const saved: Banner = await api.updateBanner(banner.id, banner);
      setBanners((prev) => prev.map((b) => (b.id === banner.id ? saved : b)));
      addAuditLog('Saved banner', 'banner', `Saved banner "${banner.title}"`);
      toast.success(`Banner "${banner.title}" saved.`);
    }
  };

  const handleDeleteBanner = async (id: string) => {
    const title = banners.find((b) => b.id === id)?.title ?? `#${id}`;
    try {
      await api.deleteBanner(id);
      setBanners((prev) => prev.filter((b) => b.id !== id));
      addAuditLog('Deleted banner', 'banner', `Deleted banner "${title}"`);
      toast.success(`Banner "${title}" removed.`);
    } catch (err: any) {
      toast.error(`Couldn't remove "${title}": ${err.message}`);
    }
  };

  const handleReorderBanner = async (id: string, direction: 'up' | 'down') => {
    const sorted = [...banners].sort((a, b) => a.position - b.position);
    const index = sorted.findIndex((b) => b.id === id);
    if (index === -1) return;

    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sorted.length) return;

    const order = [...sorted];
    [order[index], order[targetIndex]] = [order[targetIndex], order[index]];
    const renumbered = order.map((b, i) => ({ ...b, position: i + 1 }));
    const changed = renumbered.filter((b) => sorted.find((s) => s.id === b.id)?.position !== b.position);

    setBanners(renumbered);
    try {
      for (const b of changed) await api.updateBanner(b.id, { position: b.position });
      addAuditLog('Moved banner', 'banner', `Moved banner "${sorted[index].title}" ${direction}`);
    } catch (err: any) {
      toast.error(`Couldn't save the banner order: ${err.message}`);
      loadData();
    }
  };

  const handleStatusChangeBanner = async (id: string, newStatus: Banner['status']) => {
    const title = banners.find((b) => b.id === id)?.title ?? `#${id}`;
    const verb = newStatus === 'published' ? 'published' : newStatus === 'paused' ? 'paused' : `set to ${newStatus}`;
    try {
      const saved: Banner = await api.updateBanner(id, { status: newStatus });
      setBanners((prev) => prev.map((b) => (b.id === id ? saved : b)));
      addAuditLog(
        'Changed banner status',
        'banner',
        newStatus === 'published'
          ? `Published banner "${title}"`
          : newStatus === 'paused'
            ? `Paused banner "${title}"`
            : `Set banner "${title}" to ${newStatus}`
      );
      toast.success(`Banner "${title}" ${verb}.`);
    } catch (err: any) {
      toast.error(`Couldn't change "${title}": ${err.message}`);
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
        nextEnabled ? 'Showed home screen section' : 'Hid home screen section',
        'section',
        `${nextEnabled ? 'Showed' : 'Hid'} "${current.title}" on the app home screen`
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
      addAuditLog('Moved home screen section', 'section', `Moved "${sorted[index].title}" ${direction} on the app home screen`);
      toast.success('Home screen order saved.');
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
      addAuditLog('Reset home screen layout', 'section', 'Reset the app home screen to the default sections and order');
      toast.success('The app home screen is back to the default sections and order.');
    } catch (err: any) {
      toast.error(`Couldn't reset the home screen: ${err.message}`);
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
      title: 'Delivery pincodes',
      subtitle: 'Where each store delivers; checkout refuses pincodes that are paused or have no store',
    },
    stores: {
      title: 'Stores & groups',
      subtitle: 'Which store serves which pincode, and the zones, areas and clusters they sit in',
    },
    users: {
      title: 'Customers',
      subtitle: 'People who signed up in the app, their saved addresses and what they have ordered',
    },
    pricing: {
      title: 'Bulk pricing',
      subtitle: 'Discounts for buying larger quantities',
    },
    banners: {
      title: 'Campaign banners',
      subtitle: 'The promotional banners on the app home screen',
    },
    sections: {
      title: 'Home screen sections',
      subtitle: 'Which blocks the app home screen shows, and in what order. Changes appear without an app update',
    },
    shortcuts: {
      title: 'Shortcuts & projects',
      subtitle: 'The category row and project tiles on the app home screen',
    },
    help: {
      title: 'Help & support',
      subtitle: 'The phone number, WhatsApp number and questions the app shows on Help',
    },
    api: {
      title: 'Developer tools',
      subtitle: 'For developers: test server endpoints and connect the phone app (super admin only)',
    },
    audit: {
      title: 'Audit trail',
      subtitle: 'Who changed what in the portal, and when',
    },
    access: {
      title: 'Roles & access',
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
          admin to assign you a role in Roles &amp; access.
        </p>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" onClick={() => setChangingPassword(true)} style={styles.noAccessButton}>
            Change password
          </button>
          <button type="button" onClick={onLogout} style={styles.noAccessButton}>
            Sign out
          </button>
        </div>
        <ChangePasswordDialog
          admin={session.admin}
          isOpen={changingPassword}
          onClose={() => setChangingPassword(false)}
          onDone={onSessionChange}
        />
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
        ordersCount={loaded.orders ? orders.length : undefined}
        productsCount={loaded.products ? catalogTotal || products.length : undefined}
        usersCount={loaded.users ? users.length : undefined}
        adminName={session.admin.name}
        adminRole={session.admin.storeRole ?? 'No role'}
        onChangePassword={() => setChangingPassword(true)}
        onLogout={onLogout}
      />
      <ChangePasswordDialog
        admin={session.admin}
        isOpen={changingPassword}
        onClose={() => setChangingPassword(false)}
        onDone={onSessionChange}
      />

      {/* Main Content */}
      <div style={styles.mainWrapper}>
        <Header
          title={titles[currentTab].title}
          subtitle={titles[currentTab].subtitle}
          onRefresh={() => {
            setRefreshKey((n) => n + 1);
            loadData(true);
          }}
          loading={loading}
          serverOnline={serverOnline}
        />

        <main style={styles.contentArea}>
          {currentTab === 'dashboard' && (
            <DashboardOverview
              adminName={session.admin.name}
              loaded={loaded}
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
              categoriesLoaded={loaded.categories}
              onUpdateProduct={handleUpdateProduct}
              onCreateProduct={handleCreateProduct}
              canEdit={can(permissions, 'products', 'edit')}
              canDelete={can(permissions, 'products', 'delete')}
              onDeleteProduct={handleDeleteProduct}
              refreshKey={refreshKey}
            />
          )}

          {currentTab === 'categories' && (
            <CategoryManager
              canEdit={can(permissions, 'categories', 'edit')}
              canDelete={can(permissions, 'categories', 'delete')}
              onHierarchyChanged={loadData}
              onAudit={(action, details) => addAuditLog(action, 'category', details)}
              refreshKey={refreshKey}
            />
          )}

          {currentTab === 'orders' && (
            <OrdersManager
              orders={orders}
              onUpdateStatus={handleUpdateOrderStatus}
              loading={loading}
              loadError={loadErrors.orders ?? null}
              loaded={loaded.orders}
              onRetry={() => loadData(true)}
              canEdit={can(permissions, 'orders', 'edit')}
            />
          )}

          {currentTab === 'delivery' && (
            <DeliveryPincodeManager
              canManage={can(permissions, 'delivery', 'edit')}
              canSeeStores={can(permissions, 'stores', 'view')}
              onAudit={(action, details) => addAuditLog(action, 'delivery', details)}
              refreshKey={refreshKey}
            />
          )}

          {currentTab === 'stores' && (
            <StoreTreeManager
              canEdit={can(permissions, 'stores', 'edit')}
              canDelete={can(permissions, 'stores', 'delete')}
              refreshKey={refreshKey}
            />
          )}

          {currentTab === 'users' && (
            <UserManager
              customers={users}
              loading={loading}
              loadError={loadErrors.users ?? null}
              loaded={loaded.users}
              onRetry={() => loadData(true)}
            />
          )}

          {currentTab === 'pricing' && (
            <BulkPricingManager
              tiers={bulkTiers}
              products={products}
              productsLoaded={loaded.products}
              loading={loading}
              loadError={loadErrors.tiers ?? null}
              loaded={loaded.tiers}
              onRetry={() => loadData(true)}
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
              categories={categories}
              loading={loading}
              loadError={loadErrors.banners ?? null}
              loaded={loaded.banners}
              onRetry={() => loadData(true)}
              onSaveBanner={handleSaveBanner}
              canEdit={can(permissions, 'banners', 'edit')}
              canDelete={can(permissions, 'banners', 'delete')}
              onDeleteBanner={handleDeleteBanner}
              onReorder={handleReorderBanner}
              onStatusChange={handleStatusChangeBanner}
            />
          )}

          {currentTab === 'help' && (
            <HelpManager
              content={help}
              loading={loading}
              loadError={helpError}
              onRetry={() => loadData(true)}
              canEdit={can(permissions, 'help', 'edit')}
              onSaved={setHelp}
              onAudit={(action, details) => addAuditLog(action, 'help', details)}
            />
          )}

          {currentTab === 'shortcuts' && (
            <>
              <HomeMerchManager
                content={homeMerch}
                categories={categories}
                loading={loading}
                loadError={homeMerchError}
                onRetry={() => loadData(true)}
                canEdit={can(permissions, 'sections', 'edit')}
                onSaved={setHomeMerch}
                onAudit={(action, details) => addAuditLog(action, 'section', details)}
              />
              <SearchIdeasManager
                ideas={searchIdeas}
                loading={loading}
                loadError={searchIdeasError}
                onRetry={() => loadData(true)}
                canEdit={can(permissions, 'sections', 'edit')}
                onSaved={setSearchIdeas}
                onAudit={(action, details) => addAuditLog(action, 'section', details)}
              />
            </>
          )}

          {currentTab === 'sections' && (
            <SectionLayoutManager
              sections={sections}
              loading={loading}
              loadError={loadErrors.sections ?? null}
              loaded={loaded.sections}
              onRetry={() => loadData(true)}
              onToggleSection={handleToggleSection}
              onReorderSection={handleReorderSection}
              canEdit={can(permissions, 'sections', 'edit')}
              canDelete={can(permissions, 'sections', 'delete')}
              onResetDefaultOrder={handleResetSections}
            />
          )}

          {currentTab === 'api' && <ApiExplorer />}

          {currentTab === 'audit' && (
            <AuditLogViewer
              logs={auditLogs}
              limit={AUDIT_LIMIT}
              loading={loading}
              loadError={loadErrors.audit ?? null}
              loaded={loaded.audit}
              onRetry={() => loadData(true)}
            />
          )}

          {currentTab === 'access' && (
            <AccessManager
              permissions={permissions}
              canEdit={can(permissions, 'access', 'edit')}
              canDelete={can(permissions, 'access', 'delete')}
              refreshKey={refreshKey}
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
