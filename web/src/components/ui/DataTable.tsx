import React, { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { SearchInput } from './SearchInput';
import { EmptyState } from './EmptyState';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T, index: number) => React.ReactNode;
  width?: string;
  align?: 'left' | 'center' | 'right';
  sortable?: boolean;
}

export interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  keyExtractor: (item: T, index: number) => string | number;
  searchPlaceholder?: string;
  searchKeys?: (keyof T)[];
  searchFilter?: (item: T, query: string) => boolean;
  extraControls?: React.ReactNode;
  pageSize?: number;
  loading?: boolean;
  onRowClick?: (item: T) => void;
  emptyTitle?: string;
  emptyDescription?: string;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  searchPlaceholder = 'Search records...',
  searchKeys,
  searchFilter,
  extraControls,
  pageSize = 10,
  loading = false,
  onRowClick,
  emptyTitle,
  emptyDescription,
}: DataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Filter items based on search query
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();

    if (searchFilter) {
      return data.filter((item) => searchFilter(item, q));
    }

    if (searchKeys && searchKeys.length > 0) {
      return data.filter((item) =>
        searchKeys.some((k) => {
          const val = item[k];
          return val !== undefined && val !== null && String(val).toLowerCase().includes(q);
        })
      );
    }

    // Default: search all string / number fields
    return data.filter((item) =>
      Object.values(item).some(
        (v) => typeof v === 'string' || typeof v === 'number' ? String(v).toLowerCase().includes(q) : false
      )
    );
  }, [data, search, searchKeys, searchFilter]);

  // Sort items
  const sortedData = useMemo(() => {
    if (!sortKey) return filteredData;
    return [...filteredData].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;

      const comp = typeof valA === 'number' && typeof valB === 'number'
        ? valA - valB
        : String(valA).localeCompare(String(valB));

      return sortDir === 'asc' ? comp : -comp;
    });
  }, [filteredData, sortKey, sortDir]);

  // Pagination
  const totalPages = Math.ceil(sortedData.length / pageSize) || 1;
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return sortedData.slice(start, start + pageSize);
  }, [sortedData, currentPage, pageSize]);

  const handleSort = (colKey: string) => {
    if (sortKey === colKey) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortKey(null);
        setSortDir('asc');
      }
    } else {
      setSortKey(colKey);
      setSortDir('asc');
    }
  };

  const handleSearchChange = (q: string) => {
    setSearch(q);
    setCurrentPage(1);
  };

  return (
    <div style={styles.wrapper}>
      {/* Table Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.leftToolbar}>
          <SearchInput
            value={search}
            onChange={handleSearchChange}
            placeholder={searchPlaceholder}
          />
          {extraControls}
        </div>
        <div style={styles.countText}>
          Showing <strong>{sortedData.length > 0 ? (currentPage - 1) * pageSize + 1 : 0}</strong>–
          <strong>{Math.min(currentPage * pageSize, sortedData.length)}</strong> of{' '}
          <strong>{sortedData.length}</strong> items
        </div>
      </div>

      {/* Table Surface */}
      <div style={styles.tableCard}>
        <div style={styles.tableResponsive}>
          <table style={styles.table}>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{
                      ...styles.th,
                      width: col.width,
                      textAlign: col.align || 'left',
                      cursor: col.sortable ? 'pointer' : 'default',
                    }}
                    onClick={() => col.sortable && handleSort(col.key)}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        justifyContent:
                          col.align === 'right'
                            ? 'flex-end'
                            : col.align === 'center'
                            ? 'center'
                            : 'flex-start',
                      }}
                    >
                      <span>{col.header}</span>
                      {col.sortable && (
                        <span style={styles.sortIcon}>
                          {sortKey === col.key ? (
                            sortDir === 'asc' ? <ArrowUp size={13} color="var(--brand-orange)" /> : <ArrowDown size={13} color="var(--brand-orange)" />
                          ) : (
                            <ArrowUpDown size={12} />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedData.map((row, index) => {
                const key = keyExtractor(row, index);
                return (
                  <tr
                    key={key}
                    onClick={() => onRowClick && onRowClick(row)}
                    style={{
                      ...styles.tr,
                      cursor: onRowClick ? 'pointer' : 'default',
                    }}
                  >
                    {columns.map((col) => (
                      <td
                        key={`${key}-${col.key}`}
                        style={{
                          ...styles.td,
                          width: col.width,
                          textAlign: col.align || 'left',
                        }}
                      >
                        {col.render ? col.render(row, index) : row[col.key]}
                      </td>
                    ))}
                  </tr>
                );
              })}

              {paginatedData.length === 0 && !loading && (
                <tr>
                  <td colSpan={columns.length} style={{ padding: 0 }}>
                    <EmptyState
                      title={emptyTitle || (search ? 'No matching results' : 'No records yet')}
                      description={emptyDescription}
                    />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {totalPages > 1 && (
          <div style={styles.paginationBar}>
            <div style={styles.pageInfo}>
              Page <strong>{currentPage}</strong> of <strong>{totalPages}</strong>
            </div>
            <div style={styles.paginationButtons}>
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                style={{
                  ...styles.pageBtn,
                  opacity: currentPage === 1 ? 0.4 : 1,
                  cursor: currentPage === 1 ? 'not-allowed' : 'pointer',
                }}
              >
                <ChevronLeft size={16} />
                <span>Previous</span>
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, totalPages))}
                disabled={currentPage === totalPages}
                style={{
                  ...styles.pageBtn,
                  opacity: currentPage === totalPages ? 0.4 : 1,
                  cursor: currentPage === totalPages ? 'not-allowed' : 'pointer',
                }}
              >
                <span>Next</span>
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    width: '100%',
  },
  toolbar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '16px',
    flexWrap: 'wrap',
  },
  leftToolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    flex: 1,
    flexWrap: 'wrap',
  },
  countText: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
  },
  tableCard: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-lg)',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-md)',
  },
  tableResponsive: {
    overflowX: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    textAlign: 'left',
  },
  th: {
    padding: '13px 18px',
    fontSize: '0.74rem',
    fontWeight: 700,
    color: 'var(--text-dim)',
    letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border-subtle)',
    background: 'rgba(0, 0, 0, 0.18)',
    userSelect: 'none',
  },
  sortIcon: {
    display: 'flex',
    alignItems: 'center',
    color: 'var(--text-dim)',
  },
  tr: {
    borderBottom: '1px solid var(--border-subtle)',
    transition: 'background var(--transition-fast)',
  },
  td: {
    padding: '14px 18px',
    fontSize: '0.86rem',
    verticalAlign: 'middle',
  },
  paginationBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 20px',
    borderTop: '1px solid var(--border-subtle)',
    background: 'rgba(0, 0, 0, 0.1)',
  },
  pageInfo: {
    fontSize: '0.82rem',
    color: 'var(--text-muted)',
  },
  paginationButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  pageBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    background: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid var(--border-subtle)',
    borderRadius: 'var(--radius-md)',
    padding: '6px 12px',
    color: '#fff',
    fontSize: '0.8rem',
    fontWeight: 600,
  },
};
