/**
 * Table.tsx
 *
 * Reusable Table component with sorting, pagination, and composition support.
 */

import React, { ReactNode, CSSProperties, useState, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

export type SortDirection = "asc" | "desc" | null;

export interface TableColumn<T = any> {
  /** Column key */
  key: string;
  /** Column header */
  header: ReactNode;
  /** Cell renderer */
  cell?: (row: T, index: number) => ReactNode;
  /** Column width */
  width?: string | number;
  /** Whether column is sortable */
  sortable?: boolean;
  /** Custom sort function */
  sortFn?: (a: T, b: T, direction: SortDirection) => number;
  /** Text alignment */
  align?: "left" | "center" | "right";
  /** Additional CSS class */
  className?: string;
}

export interface TableProps<T = any> {
  /** Table data */
  data: T[];
  /** Column definitions */
  columns: TableColumn<T>[];
  /** Row key extractor */
  rowKey: (row: T, index: number) => string;
  /** Loading state */
  loading?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
  /** Row click handler */
  onRowClick?: (row: T, index: number) => void;
  /** Sort change handler */
  onSort?: (key: string, direction: SortDirection) => void;
  /** Current sort key */
  sortKey?: string;
  /** Current sort direction */
  sortDirection?: SortDirection;
  /** Enable hover effect on rows */
  hoverable?: boolean;
  /** Enable striped rows */
  striped?: boolean;
  /** Enable bordered style */
  bordered?: boolean;
  /** Compact style */
  compact?: boolean;
  /** Test id */
  "data-testid"?: string;
}

export interface PaginationProps {
  /** Current page */
  page: number;
  /** Total pages */
  totalPages: number;
  /** Total items */
  totalItems: number;
  /** Items per page */
  pageSize: number;
  /** Page change handler */
  onPageChange: (page: number) => void;
  /** Page size change handler */
  onPageSizeChange?: (pageSize: number) => void;
  /** Page size options */
  pageSizeOptions?: number[];
  /** Additional CSS class */
  className?: string;
  /** Inline styles */
  style?: CSSProperties;
}

// ─── Table Component ──────────────────────────────────────────────────────────

export function Table<T>({
  data,
  columns,
  rowKey,
  loading = false,
  emptyMessage = "No data available",
  className = "",
  style = {},
  onRowClick,
  onSort,
  sortKey: controlledSortKey,
  sortDirection: controlledSortDirection,
  hoverable = true,
  striped = false,
  bordered = true,
  compact = false,
  "data-testid": dataTestId,
}: TableProps<T>) {
  const [internalSortKey, setInternalSortKey] = useState<string | null>(null);
  const [internalSortDirection, setInternalSortDirection] = useState<SortDirection>(null);

  const sortKey = controlledSortKey ?? internalSortKey;
  const sortDirection = controlledSortDirection ?? internalSortDirection;

  const handleSort = useCallback(
    (column: TableColumn<T>) => {
      if (!column.sortable) return;

      let newDirection: SortDirection = "asc";
      if (sortKey === column.key) {
        if (sortDirection === "asc") newDirection = "desc";
        else if (sortDirection === "desc") newDirection = null;
      }

      if (!controlledSortKey) {
        setInternalSortKey(newDirection ? column.key : null);
        setInternalSortDirection(newDirection);
      }

      onSort?.(column.key, newDirection);
    },
    [sortKey, sortDirection, controlledSortKey, onSort]
  );

  const sortedData = React.useMemo(() => {
    if (!sortKey || !sortDirection) return data;

    const column = columns.find((c) => c.key === sortKey);
    if (!column) return data;

    return [...data].sort((a, b) => {
      if (column.sortFn) {
        return column.sortFn(a, b, sortDirection);
      }

      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];

      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return sortDirection === "asc" ? -1 : 1;
      if (bVal == null) return sortDirection === "asc" ? 1 : -1;

      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDirection === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }

      return sortDirection === "asc" ? (aVal > bVal ? 1 : -1) : aVal > bVal ? -1 : 1;
    });
  }, [data, sortKey, sortDirection, columns]);

  const baseStyles: CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: compact ? "14px" : "16px",
    ...style,
  };

  const thStyles: CSSProperties = {
    padding: compact ? "8px 12px" : "12px 16px",
    textAlign: "left",
    fontWeight: 600,
    color: "#333",
    backgroundColor: "#f5f5f5",
    borderBottom: bordered ? "2px solid #e0e0e0" : "none",
    whiteSpace: "nowrap",
  };

  const tdStyles: CSSProperties = {
    padding: compact ? "8px 12px" : "12px 16px",
    borderBottom: bordered ? "1px solid #e0e0e0" : "none",
  };

  const getSortIcon = (column: TableColumn<T>) => {
    if (!column.sortable) return null;
    if (sortKey !== column.key) return "⇅";
    if (sortDirection === "asc") return "↑";
    if (sortDirection === "desc") return "↓";
    return "⇅";
  };

  if (loading) {
    return (
      <div style={{ padding: "40px", textAlign: "center", color: "#666" }}>
        Loading...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        style={{
          padding: "40px",
          textAlign: "center",
          color: "#666",
          backgroundColor: "#f9f9f9",
          borderRadius: "4px",
        }}
      >
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        className={`ui-table ${className}`}
        style={baseStyles}
        data-testid={dataTestId || "table"}
      >
        <thead>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                className={column.className}
                style={{
                  ...thStyles,
                  width: column.width,
                  textAlign: column.align || "left",
                  cursor: column.sortable ? "pointer" : "default",
                  userSelect: "none",
                }}
                onClick={() => handleSort(column)}
              >
                <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  {column.header}
                  {column.sortable && (
                    <span style={{ fontSize: "12px", opacity: 0.5 }}>
                      {getSortIcon(column)}
                    </span>
                  )}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedData.map((row, index) => (
            <tr
              key={rowKey(row, index)}
              onClick={() => onRowClick?.(row, index)}
              style={{
                cursor: onRowClick ? "pointer" : "default",
                backgroundColor: striped && index % 2 === 1 ? "#fafafa" : "transparent",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => {
                if (hoverable) {
                  e.currentTarget.style.backgroundColor = "#f0f0f0";
                }
              }}
              onMouseLeave={(e) => {
                if (hoverable) {
                  e.currentTarget.style.backgroundColor =
                    striped && index % 2 === 1 ? "#fafafa" : "transparent";
                }
              }}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  style={{
                    ...tdStyles,
                    textAlign: column.align || "left",
                  }}
                >
                  {column.cell
                    ? column.cell(row, index)
                    : (row as any)[column.key] ?? "-"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Pagination Component ─────────────────────────────────────────────────────

export const Pagination: React.FC<PaginationProps> = ({
  page,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [10, 20, 50, 100],
  className = "",
  style = {},
}) => {
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, totalItems);

  const buttonStyles = (isActive: boolean, isDisabled: boolean): CSSProperties => ({
    padding: "6px 12px",
    fontSize: "14px",
    backgroundColor: isActive ? "#1976d2" : "#fff",
    color: isActive ? "#fff" : "#333",
    border: "1px solid #e0e0e0",
    borderRadius: "4px",
    cursor: isDisabled ? "not-allowed" : "pointer",
    opacity: isDisabled ? 0.5 : 1,
    transition: "all 0.2s",
  });

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (page <= 3) {
        for (let i = 1; i <= 4; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      } else if (page >= totalPages - 2) {
        pages.push(1);
        pages.push("...");
        for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push("...");
        for (let i = page - 1; i <= page + 1; i++) pages.push(i);
        pages.push("...");
        pages.push(totalPages);
      }
    }

    return pages;
  };

  return (
    <div
      className={`ui-pagination ${className}`}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "12px 0",
        ...style,
      }}
    >
      <div style={{ fontSize: "14px", color: "#666" }}>
        Showing {startItem} to {endItem} of {totalItems} items
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <button
          style={buttonStyles(false, page === 1)}
          onClick={() => onPageChange(page - 1)}
          disabled={page === 1}
        >
          Previous
        </button>

        {getPageNumbers().map((p, index) =>
          p === "..." ? (
            <span key={index} style={{ padding: "6px 8px", color: "#666" }}>
              ...
            </span>
          ) : (
            <button
              key={index}
              style={buttonStyles(p === page, false)}
              onClick={() => onPageChange(p as number)}
            >
              {p}
            </button>
          )
        )}

        <button
          style={buttonStyles(false, page === totalPages)}
          onClick={() => onPageChange(page + 1)}
          disabled={page === totalPages}
        >
          Next
        </button>
      </div>

      {onPageSizeChange && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "14px", color: "#666" }}>Items per page:</span>
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            style={{
              padding: "6px 12px",
              fontSize: "14px",
              border: "1px solid #e0e0e0",
              borderRadius: "4px",
              backgroundColor: "#fff",
            }}
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
};

export default Table;
