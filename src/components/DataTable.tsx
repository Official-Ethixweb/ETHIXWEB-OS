import { useMemo, useState, type ComponentType } from "react";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Download,
  FileSpreadsheet,
  MoreHorizontal,
  Printer,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { exportToCsv, exportToExcel, printRows, type ExportColumn } from "@/lib/export";

export interface DataTableColumn<T> {
  key: string;
  header: string;
  cell: (row: T) => React.ReactNode;
  sortAccessor?: (row: T) => string | number;
  exportAccessor?: (row: T) => string | number;
  className?: string;
}

export interface BulkAction {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick: (ids: string[]) => void;
  variant?: "default" | "destructive";
}

export interface RowAction<T> {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick: (row: T) => void;
  variant?: "default" | "destructive";
  hidden?: (row: T) => boolean;
}

interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  rows: T[];
  getId: (row: T) => string;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  emptyIcon?: ComponentType<{ className?: string }>;
  emptyTitle: string;
  emptyDescription?: string;
  toolbarExtra?: React.ReactNode;
  bulkActions?: BulkAction[];
  rowActions?: (row: T) => RowAction<T>[];
  onRowClick?: (row: T) => void;
  exportFilenameBase?: string;
  exportTitle?: string;
}

const PAGE_SIZES = [10, 25, 50];

export function DataTable<T>({
  columns,
  rows,
  getId,
  isLoading,
  isError,
  onRetry,
  emptyIcon: EmptyIcon,
  emptyTitle,
  emptyDescription,
  toolbarExtra,
  bulkActions,
  rowActions,
  onRowClick,
  exportFilenameBase = "export",
  exportTitle = "Export",
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const col = columns.find((c) => c.key === sortKey);
    if (!col?.sortAccessor) return rows;
    const sorted = [...rows].sort((a, b) => {
      const av = col.sortAccessor!(a);
      const bv = col.sortAccessor!(b);
      if (typeof av === "number" && typeof bv === "number") return av - bv;
      return String(av).localeCompare(String(bv));
    });
    if (sortDir === "desc") sorted.reverse();
    return sorted;
  }, [rows, sortKey, sortDir, columns]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const clampedPage = Math.min(page, pageCount);
  const pageRows = sortedRows.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const toggleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir("asc");
    } else if (sortDir === "asc") {
      setSortDir("desc");
    } else {
      setSortKey(null);
    }
  };

  const toggleRow = (id: string) => {
    setSelected((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const allVisibleSelected = pageRows.length > 0 && pageRows.every((r) => selected.has(getId(r)));
  const toggleAllVisible = () => {
    setSelected((s) => {
      const next = new Set(s);
      if (allVisibleSelected) pageRows.forEach((r) => next.delete(getId(r)));
      else pageRows.forEach((r) => next.add(getId(r)));
      return next;
    });
  };

  const clearSelection = () => setSelected(new Set());

  const exportColumns: ExportColumn<T>[] = columns
    .filter((c) => c.exportAccessor)
    .map((c) => ({ header: c.header, accessor: c.exportAccessor! }));

  const exportRows = selected.size > 0 ? rows.filter((r) => selected.has(getId(r))) : sortedRows;

  return (
    <div className="space-y-3">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex gap-2 items-center flex-wrap flex-1">{toolbarExtra}</div>
        <div className="flex gap-1.5 items-center">
          <Button
            variant="outline"
            size="sm"
            className="bg-secondary/40 border-border/60"
            onClick={() => exportToCsv(exportRows, exportColumns, `${exportFilenameBase}.csv`)}
            title="Export CSV"
          >
            <Download className="h-3.5 w-3.5 mr-1.5" /> CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-secondary/40 border-border/60"
            onClick={() => exportToExcel(exportRows, exportColumns, `${exportFilenameBase}.xlsx`)}
            title="Export Excel"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 mr-1.5" /> Excel
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="bg-secondary/40 border-border/60"
            onClick={() => printRows(exportRows, exportColumns, exportTitle)}
            title="Print"
          >
            <Printer className="h-3.5 w-3.5 mr-1.5" /> Print
          </Button>
        </div>
      </div>

      {selected.size > 0 && bulkActions && bulkActions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap rounded-xl border border-primary/30 bg-primary/10 px-4 py-2.5">
          <span className="text-sm font-medium">{selected.size} selected</span>
          <button onClick={clearSelection} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
          <div className="flex-1" />
          {bulkActions.map((action) => (
            <Button
              key={action.label}
              size="sm"
              variant={action.variant === "destructive" ? "destructive" : "outline"}
              className={action.variant !== "destructive" ? "bg-secondary/40 border-border/60" : undefined}
              onClick={() => {
                action.onClick([...selected]);
                clearSelection();
              }}
            >
              {action.icon && <action.icon className="h-3.5 w-3.5 mr-1.5" />}
              {action.label}
            </Button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div className="glass rounded-2xl p-6 space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-10 w-full rounded-lg overflow-hidden">
              <div className="skeleton-shimmer h-full w-full" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <div className="glass rounded-3xl p-12 text-center">
          <div className="font-semibold text-lg">We couldn't reach the API</div>
          {onRetry && <Button onClick={onRetry} className="mt-5">Retry</Button>}
        </div>
      ) : rows.length === 0 ? (
        <div className="glass rounded-3xl p-12 text-center">
          {EmptyIcon && (
            <div className="h-16 w-16 mx-auto rounded-2xl bg-gradient-primary/20 grid place-items-center mb-4">
              <EmptyIcon className="h-7 w-7 text-primary-glow" />
            </div>
          )}
          <div className="font-semibold text-lg">{emptyTitle}</div>
          {emptyDescription && <div className="text-sm text-muted-foreground mt-1">{emptyDescription}</div>}
        </div>
      ) : (
        <div className="glass rounded-2xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-border/60 hover:bg-transparent">
                {bulkActions && bulkActions.length > 0 && (
                  <TableHead className="w-10">
                    <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} aria-label="Select all" />
                  </TableHead>
                )}
                {columns.map((col) => (
                  <TableHead key={col.key} className={col.className}>
                    {col.sortAccessor ? (
                      <button
                        onClick={() => toggleSort(col.key)}
                        className="inline-flex items-center gap-1 hover:text-foreground transition-colors"
                      >
                        {col.header}
                        {sortKey === col.key ? (
                          sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40" />
                        )}
                      </button>
                    ) : (
                      col.header
                    )}
                  </TableHead>
                ))}
                {rowActions && <TableHead className="w-10" />}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => {
                const id = getId(row);
                const actions = rowActions?.(row).filter((a) => !a.hidden?.(row)) ?? [];
                return (
                  <TableRow
                    key={id}
                    className={cn("border-border/60", onRowClick && "cursor-pointer")}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('[role="checkbox"], [data-no-row-click]')) return;
                      onRowClick?.(row);
                    }}
                  >
                    {bulkActions && bulkActions.length > 0 && (
                      <TableCell>
                        <Checkbox checked={selected.has(id)} onCheckedChange={() => toggleRow(id)} aria-label="Select row" />
                      </TableCell>
                    )}
                    {columns.map((col) => (
                      <TableCell key={col.key} className={col.className}>
                        {col.cell(row)}
                      </TableCell>
                    ))}
                    {rowActions && (
                      <TableCell data-no-row-click>
                        {actions.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="h-7 w-7 grid place-items-center rounded-lg hover:bg-secondary/60 transition-colors text-muted-foreground hover:text-foreground">
                                <MoreHorizontal className="h-4 w-4" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {actions.map((action) => (
                                <DropdownMenuItem
                                  key={action.label}
                                  onClick={() => action.onClick(row)}
                                  className={action.variant === "destructive" ? "text-destructive focus:text-destructive" : undefined}
                                >
                                  {action.icon && <action.icon className="h-3.5 w-3.5 mr-2" />}
                                  {action.label}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!isLoading && !isError && rows.length > 0 && (
        <div className="flex items-center justify-between gap-3 flex-wrap text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <span>Showing {(clampedPage - 1) * pageSize + 1}-{Math.min(clampedPage * pageSize, sortedRows.length)} of {sortedRows.length}</span>
            <Select value={String(pageSize)} onValueChange={(v) => { setPageSize(Number(v)); setPage(1); }}>
              <SelectTrigger className="w-24 h-8 bg-secondary/40 border-border/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAGE_SIZES.map((s) => <SelectItem key={s} value={String(s)}>{s} / page</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-8 w-8 bg-secondary/40 border-border/60" disabled={clampedPage <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="px-2">{clampedPage} / {pageCount}</span>
            <Button variant="outline" size="icon" className="h-8 w-8 bg-secondary/40 border-border/60" disabled={clampedPage >= pageCount} onClick={() => setPage((p) => Math.min(pageCount, p + 1))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
