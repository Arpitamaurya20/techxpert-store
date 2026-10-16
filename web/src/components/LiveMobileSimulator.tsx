import React, { useState, useEffect } from 'react';
import {
  MapPin,
  Search,
  ShoppingCart,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Truck,
  Percent,
  Headphones,
  Home,
  Grid,
  ClipboardList,
  HelpCircle,
} from 'lucide-react';
import type { Banner, HomepageSection, Product } from '../types';

interface LiveMobileSimulatorProps {
  banners: Banner[];
  sections: HomepageSection[];
  products: Product[];
  activeBannerId?: string;
  onBannerSelect?: (id: string) => void;
}

export const LiveMobileSimulator: React.FC<LiveMobileSimulatorProps> = ({
  banners,
  sections,
  products,
  activeBannerId,
  onBannerSelect,
}) => {
  const publishedBanners = banners.filter((b) => b.status === 'published' || b.status === 'scheduled');
  const [activeSlide, setActiveSlide] = useState(0);

  // If activeBannerId changes from parent, sync slide index
  useEffect(() => {
    if (activeBannerId) {
      const idx = publishedBanners.findIndex((b) => b.id === activeBannerId);
      if (idx !== -1) setActiveSlide(idx);
    }
  }, [activeBannerId, publishedBanners]);

  const currentBanner = publishedBanners[activeSlide] || publishedBanners[0];
  const sortedSections = [...sections].sort((a, b) => a.position - b.position);

  const categories = [
    { name: 'Cement', img: '/images/subcategories/white-cement.jpg' },
    { name: 'Paints', img: '/images/subcategories/wall-putty.jpg' },
    { name: 'Adhesives', img: '/images/subcategories/wood-adhesive.jpg' },
    { name: 'Plumbing', img: '/images/subcategories/pvc-pipes.jpg' },
    { name: 'Tiles', img: '/images/subcategories/wall-tiles.jpg' },
    { name: 'Electrical', img: '/images/subcategories/wires-cables.jpg' },
  ];

  return (
    <div style={styles.container}>
      <div style={styles.topInfo}>
        <div style={styles.infoTitle}>
          <span style={styles.livePulse} />
          <span>Real-Time Mobile Simulator</span>
        </div>
        <span style={styles.deviceLabel}>iPhone 16 Pro View</span>
      </div>

      {/* Phone Hardware Mockup */}
      <div style={styles.phoneOuter}>
        {/* Buttons / Bezel edges */}
        <div style={styles.volumeUp} />
        <div style={styles.volumeDown} />
        <div style={styles.powerBtn} />

        <div style={styles.phoneScreen}>
          {/* Status Bar */}
          <div style={styles.statusBar}>
            <span style={styles.statusTime}>9:41</span>
            <div style={styles.notch}>
              <div style={styles.notchCamera} />
            </div>
            <div style={styles.statusIcons}>
              <span style={{ fontSize: '0.65rem' }}>5G</span>
              <div style={styles.batteryIcon}>
                <div style={styles.batteryFill} />
              </div>
            </div>
          </div>

          {/* App Header */}
          <div style={styles.appHeader}>
            <div style={styles.locationSelector}>
              <MapPin size={13} color="var(--brand-orange)" />
              <div style={styles.locationTextWrapper}>
                <span style={styles.locationLabel}>Deliver to</span>
                <span style={styles.locationValue}>Sector 62, Noida ▾</span>
              </div>
            </div>

            <div style={styles.headerActions}>
              <div style={styles.cartIconBadge}>
                <ShoppingCart size={17} color="#fff" />
                <span style={styles.badgeNumber}>2</span>
              </div>
            </div>
          </div>

          {/* Search Field */}
          <div style={styles.searchBox}>
            <Search size={14} color="#94a3b8" />
            <span style={styles.searchPlaceholder}>Search cement, tiles, paints...</span>
          </div>

          {/* Scrollable Screen Content */}
          <div style={styles.screenScroll}>
            {sortedSections.map((sec) => {
              if (!sec.enabled) return null;

              switch (sec.type) {
                case 'hero_carousel':
                  return (
                    <div key={sec.id} style={styles.carouselSection}>
                      {currentBanner ? (
                        <div
                          style={{
                            ...styles.bannerCard,
                            backgroundImage: `linear-gradient(to top, rgba(15, 23, 42, 0.92) 20%, rgba(15, 23, 42, 0.3) 100%), url(${currentBanner.imageUrl})`,
                          }}
                          onClick={() => onBannerSelect?.(currentBanner.id)}
                        >
                          <div style={styles.bannerBadge}>
                            <Sparkles size={11} color="var(--brand-orange)" />
                            <span>Featured Deal</span>
                          </div>
                          <div style={styles.bannerCopy}>
                            <h3 style={styles.bannerTitle}>{currentBanner.title}</h3>
                            <p style={styles.bannerSub}>{currentBanner.subtitle}</p>
                            <div style={styles.bannerCta}>
                              <span>{currentBanner.ctaLabel}</span>
                              <ArrowRight size={12} />
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div style={styles.emptyBanner}>No active banners</div>
                      )}

                      {/* Carousel Dots */}
                      {publishedBanners.length > 1 && (
                        <div style={styles.dotsRow}>
                          {publishedBanners.map((b, i) => (
                            <button
                              key={b.id}
                              style={{
                                ...styles.dot,
                                width: i === activeSlide ? '20px' : '6px',
                                background: i === activeSlide ? 'var(--brand-orange)' : 'rgba(255,255,255,0.25)',
                              }}
                              onClick={() => {
                                setActiveSlide(i);
                                onBannerSelect?.(b.id);
                              }}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  );

                case 'category_shortcuts':
                  return (
                    <div key={sec.id} style={styles.subcatRail}>
                      <div style={styles.sectionHeading}>
                        <span>Popular Categories</span>
                        <span style={styles.seeAll}>See all</span>
                      </div>
                      <div style={styles.subcatScroll}>
                        {categories.map((c, idx) => (
                          <div key={idx} style={styles.subcatItem}>
                            <div style={styles.subcatImgWrap}>
                              <img
                                src={c.img}
                                alt={c.name}
                                style={styles.subcatImg}
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            </div>
                            <span style={styles.subcatName}>{c.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );

                case 'trust_strip':
                  return (
                    <div key={sec.id} style={styles.trustStrip}>
                      <div style={styles.trustItem}>
                        <ShieldCheck size={14} color="var(--brand-orange)" />
                        <span>100% Genuine</span>
                      </div>
                      <div style={styles.trustItem}>
                        <Truck size={14} color="#38bdf8" />
                        <span>Site Delivery</span>
                      </div>
                      <div style={styles.trustItem}>
                        <Percent size={14} color="#10b981" />
                        <span>Wholesale Rates</span>
                      </div>
                    </div>
                  );

                case 'diwali_banner':
                  return (
                    <div key={sec.id} style={styles.festiveCard}>
                      <div style={styles.festiveBadge}>DIWALI MEGA SALE</div>
                      <h4 style={styles.festiveHeading}>Bulk Savings on Cement & Paints</h4>
                      <p style={styles.festiveText}>Up to 15% off for site contractors</p>
                    </div>
                  );

                case 'featured_products':
                  return (
                    <div key={sec.id} style={styles.productRail}>
                      <div style={styles.sectionHeading}>
                        <span>Featured Materials</span>
                        <span style={styles.seeAll}>Catalog</span>
                      </div>
                      <div style={styles.productCards}>
                        {products.slice(0, 3).map((p) => (
                          <div key={p.id} style={styles.productCard}>
                            <div style={styles.productTop}>
                              <span style={styles.productCategory}>{p.categoryId}</span>
                              <span style={styles.stockBadge}>In Stock</span>
                            </div>
                            <div style={styles.productName}>{p.name}</div>
                            <div style={styles.productUnit}>{p.unit}</div>
                            <div style={styles.productPriceRow}>
                              <span style={styles.priceVal}>₹{p.price}</span>
                              <button style={styles.addBtn}>+ Add</button>
                            </div>
                            <div style={styles.bulkTag}>Tier savings up to 12%</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );

                case 'bulk_enquiry':
                  return (
                    <div key={sec.id} style={styles.enquiryCard}>
                      <div style={styles.enquiryContent}>
                        <Headphones size={20} color="var(--brand-orange)" />
                        <div>
                          <div style={styles.enquiryTitle}>Contractor Material Desk</div>
                          <div style={styles.enquirySub}>Direct wholesale quotation & delivery</div>
                        </div>
                      </div>
                    </div>
                  );

                default:
                  return null;
              }
            })}
          </div>

          {/* Bottom Navigation */}
          <div style={styles.bottomNav}>
            <div style={{ ...styles.navTab, color: 'var(--brand-orange)' }}>
              <Home size={16} />
              <span>Home</span>
            </div>
            <div style={styles.navTab}>
              <Grid size={16} />
              <span>Categories</span>
            </div>
            <div style={styles.navTab}>
              <ClipboardList size={16} />
              <span>Orders</span>
            </div>
            <div style={styles.navTab}>
              <HelpCircle size={16} />
              <span>Support</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '380px',
    padding: '24px 20px',
    background: 'var(--bg-sidebar)',
    borderLeft: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    flexShrink: 0,
    height: '100vh',
    position: 'sticky',
    top: 0,
    overflowY: 'auto',
  },
  topInfo: {
    width: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '16px',
  },
  infoTitle: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '0.8rem',
    fontWeight: 600,
    color: '#fff',
  },
  livePulse: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#10b981',
    boxShadow: '0 0 8px #10b981',
    animation: 'pulseGlow 2s infinite',
  },
  deviceLabel: {
    fontSize: '0.7rem',
    color: 'var(--text-dim)',
  },
  phoneOuter: {
    width: '330px',
    height: '680px',
    background: '#1e293b',
    borderRadius: '46px',
    padding: '10px',
    boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), inset 0 0 2px rgba(255, 255, 255, 0.3)',
    position: 'relative',
    border: '3px solid #334155',
  },
  volumeUp: {
    position: 'absolute',
    left: '-6px',
    top: '110px',
    width: '3px',
    height: '38px',
    background: '#475569',
    borderRadius: '2px',
  },
  volumeDown: {
    position: 'absolute',
    left: '-6px',
    top: '160px',
    width: '3px',
    height: '38px',
    background: '#475569',
    borderRadius: '2px',
  },
  powerBtn: {
    position: 'absolute',
    right: '-6px',
    top: '130px',
    width: '3px',
    height: '48px',
    background: '#475569',
    borderRadius: '2px',
  },
  phoneScreen: {
    width: '100%',
    height: '100%',
    background: '#090d16',
    borderRadius: '38px',
    overflow: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    position: 'relative',
  },
  statusBar: {
    height: '38px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 20px',
    color: '#fff',
    fontSize: '0.74rem',
    fontWeight: 600,
    flexShrink: 0,
    zIndex: 2,
  },
  statusTime: {
    letterSpacing: '-0.02em',
  },
  notch: {
    width: '90px',
    height: '24px',
    background: '#000',
    borderRadius: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  notchCamera: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#0f172a',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  statusIcons: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  batteryIcon: {
    width: '18px',
    height: '9px',
    border: '1px solid #fff',
    borderRadius: '3px',
    padding: '1px',
    display: 'flex',
    alignItems: 'center',
  },
  batteryFill: {
    width: '80%',
    height: '100%',
    background: '#fff',
    borderRadius: '1px',
  },
  appHeader: {
    padding: '8px 16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexShrink: 0,
  },
  locationSelector: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  locationTextWrapper: {
    display: 'flex',
    flexDirection: 'column',
  },
  locationLabel: {
    fontSize: '0.62rem',
    color: 'var(--text-dim)',
  },
  locationValue: {
    fontSize: '0.75rem',
    fontWeight: 700,
    color: '#fff',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
  },
  cartIconBadge: {
    position: 'relative',
    padding: '4px',
  },
  badgeNumber: {
    position: 'absolute',
    top: '-2px',
    right: '-4px',
    background: 'var(--brand-orange)',
    color: '#fff',
    fontSize: '0.58rem',
    fontWeight: 800,
    borderRadius: '999px',
    width: '14px',
    height: '14px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBox: {
    margin: '4px 16px 10px',
    background: 'rgba(255, 255, 255, 0.06)',
    borderRadius: '8px',
    padding: '7px 10px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    border: '1px solid var(--border-subtle)',
    flexShrink: 0,
  },
  searchPlaceholder: {
    fontSize: '0.72rem',
    color: 'var(--text-muted)',
  },
  screenScroll: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  carouselSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  bannerCard: {
    borderRadius: '14px',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    padding: '14px',
    minHeight: '140px',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    cursor: 'pointer',
    position: 'relative',
    overflow: 'hidden',
  },
  emptyBanner: {
    height: '100px',
    background: 'rgba(255, 255, 255, 0.05)',
    borderRadius: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    color: 'var(--text-dim)',
  },
  bannerBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    background: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
    padding: '3px 8px',
    borderRadius: '999px',
    fontSize: '0.62rem',
    fontWeight: 600,
    color: '#fff',
    alignSelf: 'flex-start',
  },
  bannerCopy: {
    display: 'flex',
    flexDirection: 'column',
    gap: '3px',
  },
  bannerTitle: {
    fontSize: '0.92rem',
    fontWeight: 800,
    color: '#fff',
    lineHeight: 1.2,
  },
  bannerSub: {
    fontSize: '0.68rem',
    color: 'rgba(255, 255, 255, 0.8)',
    lineHeight: 1.25,
  },
  bannerCta: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '6px',
    fontSize: '0.68rem',
    fontWeight: 700,
    color: 'var(--brand-orange)',
  },
  dotsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '4px',
  },
  dot: {
    height: '4px',
    borderRadius: '2px',
    border: 'none',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  sectionHeading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    fontSize: '0.76rem',
    fontWeight: 700,
    color: '#fff',
    marginBottom: '6px',
  },
  seeAll: {
    fontSize: '0.66rem',
    color: 'var(--brand-orange)',
    fontWeight: 600,
  },
  subcatRail: {
    display: 'flex',
    flexDirection: 'column',
  },
  subcatScroll: {
    display: 'flex',
    gap: '8px',
    overflowX: 'auto',
    paddingBottom: '4px',
  },
  subcatItem: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px',
    width: '52px',
    flexShrink: 0,
  },
  subcatImgWrap: {
    width: '46px',
    height: '46px',
    borderRadius: '10px',
    background: '#1a243d',
    border: '1px solid var(--border-subtle)',
    overflow: 'hidden',
  },
  subcatImg: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
  },
  subcatName: {
    fontSize: '0.62rem',
    color: 'var(--text-muted)',
    textAlign: 'center',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    width: '100%',
  },
  trustStrip: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    background: 'rgba(255, 255, 255, 0.03)',
    borderRadius: '10px',
    padding: '8px 10px',
    border: '1px solid var(--border-subtle)',
  },
  trustItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '0.62rem',
    fontWeight: 600,
    color: 'var(--text-muted)',
  },
  festiveCard: {
    background: 'linear-gradient(135deg, #7c2d12, #991b1b)',
    borderRadius: '12px',
    padding: '12px',
    border: '1px solid rgba(251, 146, 60, 0.3)',
  },
  festiveBadge: {
    fontSize: '0.6rem',
    fontWeight: 800,
    color: '#fef08a',
    letterSpacing: '0.06em',
  },
  festiveHeading: {
    fontSize: '0.84rem',
    fontWeight: 800,
    color: '#fff',
    marginTop: '2px',
  },
  festiveText: {
    fontSize: '0.66rem',
    color: 'rgba(255, 255, 255, 0.85)',
    marginTop: '2px',
  },
  productRail: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
  },
  productCards: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  productCard: {
    background: 'var(--bg-surface)',
    borderRadius: '10px',
    padding: '10px',
    border: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  productTop: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  productCategory: {
    fontSize: '0.58rem',
    color: 'var(--text-dim)',
    textTransform: 'uppercase',
  },
  stockBadge: {
    fontSize: '0.58rem',
    color: '#10b981',
    fontWeight: 600,
  },
  productName: {
    fontSize: '0.76rem',
    fontWeight: 700,
    color: '#fff',
  },
  productUnit: {
    fontSize: '0.64rem',
    color: 'var(--text-muted)',
  },
  productPriceRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: '4px',
  },
  priceVal: {
    fontSize: '0.85rem',
    fontWeight: 800,
    color: '#fff',
  },
  addBtn: {
    background: 'var(--brand-orange)',
    color: '#fff',
    border: 'none',
    padding: '3px 9px',
    borderRadius: '6px',
    fontSize: '0.66rem',
    fontWeight: 700,
    cursor: 'pointer',
  },
  bulkTag: {
    fontSize: '0.6rem',
    color: '#f59e0b',
    fontWeight: 600,
    marginTop: '3px',
  },
  enquiryCard: {
    background: 'rgba(249, 115, 22, 0.08)',
    border: '1px dashed rgba(249, 115, 22, 0.3)',
    borderRadius: '10px',
    padding: '10px',
  },
  enquiryContent: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px',
  },
  enquiryTitle: {
    fontSize: '0.74rem',
    fontWeight: 700,
    color: '#fff',
  },
  enquirySub: {
    fontSize: '0.62rem',
    color: 'var(--text-muted)',
  },
  bottomNav: {
    height: '46px',
    background: '#0d1322',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-around',
    flexShrink: 0,
    zIndex: 2,
  },
  navTab: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
    fontSize: '0.58rem',
    color: 'var(--text-dim)',
  },
};
