import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar, type TabId } from './components/Sidebar';
import { Header } from './components/Header';
import { CatalogOverview } from './components/CatalogOverview';
import { OrdersManager } from './components/OrdersManager';
import { UserManager } from './components/UserManager';
import { BulkPricingManager } from './components/BulkPricingManager';
import { BannerCMS } from './components/BannerCMS';
import { ApiExplorer } from './components/ApiExplorer';
import { AuditLogViewer } from './components/AuditLogViewer';
import { api } from './services/api';
import type { Banner, BulkPriceTier, Product, AuditLog } from './types';
import { CheckCircle2, X } from 'lucide-react';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('catalog');
  const [loading, setLoading] = useState<boolean>(true);
  const [serverOnline, setServerOnline] = useState<boolean>(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Live state from backend
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [bulkTiers, setBulkTiers] = useState<BulkPriceTier[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([
    {
      id: 'log-1',
      action: 'Backend API Service Initialized',
      entity: 'publish',
      details: 'Express API running on port 5001 with active endpoints for Expo Mobile and Admin Portal',
      user: 'System Service',
      timestamp: 'Just now',
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3800);
  };

  const addAuditLog = (action: string, entity: AuditLog['entity'], details: string) => {
    const newLog: AuditLog = {
      id: `log-${Date.now()}`,
      action,
      entity,
      details,
      user: 'Arpit Maurya (Store Admin)',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };
    setAuditLogs((prev) => [newLog, ...prev]);
  };

  // Fetch all data from live backend
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [prodsData, catsData, ordersData, usersData, tiersData, bannersData] = await Promise.all([
        api.getProducts().catch(() => []),
        api.getCategories().catch(() => []),
        api.getOrders().catch(() => []),
        api.getUsers().catch(() => []),
        api.getBulkTiers().catch(() => []),
        api.getBanners().catch(() => []),
      ]);

      setProducts(prodsData);
      setCategories(catsData);
      setOrders(ordersData);
      setUsers(usersData);
      setBulkTiers(tiersData);
      setBanners(bannersData);
      setServerOnline(true);
    } catch (err: any) {
      console.error('Failed to load from backend API', err);
      setServerOnline(false);
    } finally {

      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Product Actions
  const handleUpdateProduct = async (updated: Product) => {
    try {
      await api.updateProduct(updated.id, updated);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
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

  // Order Actions
  const handleUpdateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.updateOrderStatus(orderId, status);
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status } : o))
      );
      addAuditLog(
        'Updated Order Status',
        'publish',
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
      await api.updateBanner(id, { status: newStatus });
      setBanners((prev) =>
        prev.map((b) => (b.id === id ? { ...b, status: newStatus } : b))
      );
      showToast(`Banner marked as ${newStatus}`);
    } catch (err: any) {
      showToast(`Failed to update banner status: ${err.message}`);
    }
  };

  const titles: Record<TabId, { title: string; subtitle: string }> = {
    catalog: {
      title: 'Products & Inventory Management',
      subtitle: 'Live construction materials inventory, selling units, and base prices served via GET /catalog/products',
    },
    orders: {
      title: 'Orders & Fulfillment Desk',
      subtitle: 'Real-time order pipeline from customer mobile app and contractor procurement desk',
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
    api: {
      title: 'Backend API & Mobile App Integration',
      subtitle: 'Interactive endpoint tester and configuration guide for the Expo React Native app',
    },
    audit: {
      title: 'Audit Log & Change Trail',
      subtitle: 'Operational logs of product, pricing, and fulfillment changes',
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
        ordersCount={orders.length}
        productsCount={products.length}
        usersCount={users.length}
        serverOnline={serverOnline}
      />

      {/* Main Content */}
      <div style={styles.mainWrapper}>
        <Header
          title={titles[activeTab].title}
          subtitle={titles[activeTab].subtitle}
          onRefresh={loadData}
          loading={loading}
          serverOnline={serverOnline}
        />

        <main style={styles.contentArea}>
          {activeTab === 'catalog' && (
            <CatalogOverview
              products={products}
              categories={categories}
              onUpdateProduct={handleUpdateProduct}
            />
          )}

          {activeTab === 'orders' && (
            <OrdersManager
              orders={orders}
              onUpdateStatus={handleUpdateOrderStatus}
              loading={loading}
            />
          )}

          {activeTab === 'users' && <UserManager />}

          {activeTab === 'pricing' && (
            <BulkPricingManager
              tiers={bulkTiers}
              products={products}
              onAddTier={handleAddTier}
              onDeleteTier={handleDeleteTier}
            />
          )}


          {activeTab === 'banners' && (
            <BannerCMS
              banners={banners}
              onSaveBanner={handleSaveBanner}
              onDeleteBanner={handleDeleteBanner}
              onReorder={handleReorderBanner}
              onStatusChange={handleStatusChangeBanner}
              selectedBannerId={banners[0]?.id}
              onSelectBanner={() => {}}
            />
          )}

          {activeTab === 'api' && <ApiExplorer />}

          {activeTab === 'audit' && <AuditLogViewer logs={auditLogs} />}
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
  toastClose: {
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
  },
};

export default App;
