import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { GridLayout, useContainerWidth, type Layout } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import { useQuery } from "@tanstack/react-query";
import { Copy, EyeOff, GripVertical, Loader2, Pencil, Plus, RotateCcw, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { dashboardLayoutApi, type LayoutItem } from "@/api/dashboardLayout";
import { baseWidgetId, type DashboardWidgetDef } from "@/config/dashboardWidgets";
import { useIsMobile } from "@/hooks/use-mobile";
import { useDebouncedCallback } from "@/hooks/useDebounce";

interface DashboardGridProps {
  /** Already permission-filtered — only widgets the current user may see at all. */
  registry: DashboardWidgetDef[];
  content: Record<string, ReactNode>;
}

function defaultLayoutFor(registry: DashboardWidgetDef[]): LayoutItem[] {
  return registry.map((w) => ({ i: w.id, ...w.defaultLayout }));
}

export function DashboardGrid({ registry, content }: DashboardGridProps) {
  const registryById = useMemo(() => new Map(registry.map((w) => [w.id, w])), [registry]);
  const isMobile = useIsMobile();
  const { width, containerRef, mounted } = useContainerWidth();
  const [editMode, setEditMode] = useState(false);
  const [layout, setLayout] = useState<LayoutItem[]>(() => defaultLayoutFor(registry));
  const [hiddenWidgets, setHiddenWidgets] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const loadedRef = useRef(false);

  const { data, isLoading } = useQuery({ queryKey: ["dashboard-layout"], queryFn: () => dashboardLayoutApi.get() });

  useEffect(() => {
    if (!data || loadedRef.current) return;
    loadedRef.current = true;
    if (data.layout.length === 0) {
      setLayout(defaultLayoutFor(registry.filter((w) => !data.hiddenWidgets.includes(w.id))));
    } else {
      // Drop any saved instance whose base widget no longer exists (e.g. a
      // module got disabled) or that the viewer no longer has permission for.
      setLayout(data.layout.filter((item) => registryById.has(baseWidgetId(item.i))));
    }
    setHiddenWidgets(data.hiddenWidgets);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  const persist = useDebouncedCallback((nextLayout: LayoutItem[], nextHidden: string[]) => {
    setSaving(true);
    dashboardLayoutApi.save({ layout: nextLayout, hiddenWidgets: nextHidden }).finally(() => setSaving(false));
  }, 800);

  const updateLayout = (nextLayout: LayoutItem[], nextHidden = hiddenWidgets) => {
    setLayout(nextLayout);
    setHiddenWidgets(nextHidden);
    if (loadedRef.current) persist(nextLayout, nextHidden);
  };

  const onGridLayoutChange = (rglLayout: Layout) => {
    if (!editMode) return;
    const next = rglLayout.map((l) => ({ i: l.i, x: l.x, y: l.y, w: l.w, h: l.h }));
    updateLayout(next);
  };

  const hideWidget = (instanceId: string) => {
    const base = baseWidgetId(instanceId);
    const remaining = layout.filter((l) => l.i !== instanceId);
    const stillHasOriginal = remaining.some((l) => l.i === base || baseWidgetId(l.i) === base);
    updateLayout(remaining, stillHasOriginal ? hiddenWidgets : [...hiddenWidgets, base]);
  };

  const duplicateWidget = (instanceId: string) => {
    const source = layout.find((l) => l.i === instanceId);
    if (!source) return;
    const newId = `${baseWidgetId(instanceId)}--copy-${Date.now()}`;
    updateLayout([...layout, { i: newId, x: source.x, y: source.y + source.h, w: source.w, h: source.h }]);
  };

  const addWidget = (widgetId: string) => {
    const def = registryById.get(widgetId);
    if (!def) return;
    updateLayout(
      [...layout, { i: widgetId, ...def.defaultLayout }],
      hiddenWidgets.filter((h) => h !== widgetId)
    );
  };

  const resetLayout = () => {
    dashboardLayoutApi.reset().finally(() => {
      loadedRef.current = true;
      setLayout(defaultLayoutFor(registry));
      setHiddenWidgets([]);
    });
  };

  const hiddenOptions = registry.filter((w) => hiddenWidgets.includes(w.id));

  // Merge in each widget type's min-size constraints (not persisted — these
  // are properties of the widget definition, not the user's saved layout).
  const layoutWithConstraints: Layout = useMemo(
    () =>
      layout.map((item) => {
        const def = registryById.get(baseWidgetId(item.i));
        return { ...item, minW: def?.minW, minH: def?.minH };
      }),
    [layout, registryById]
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isMobile) {
    // Drag/resize is impractical on touch-narrow screens — fall back to a
    // simple permission/hidden-filtered stack in registry order.
    return (
      <div className="space-y-4">
        {registry
          .filter((w) => !hiddenWidgets.includes(w.id))
          .map((w) => (
            <div key={w.id}>{content[w.id]}</div>
          ))}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-end gap-2 mb-3">
        {saving && (
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Loader2 className="h-3 w-3 animate-spin" /> Saving…
          </span>
        )}
        {editMode && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" disabled={hiddenOptions.length === 0}>
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Add widget
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {hiddenOptions.map((w) => (
                  <DropdownMenuItem key={w.id} onClick={() => addWidget(w.id)}>
                    {w.title}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Button variant="outline" size="sm" onClick={resetLayout}>
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Reset
            </Button>
          </>
        )}
        <Button variant={editMode ? "default" : "outline"} size="sm" onClick={() => setEditMode((v) => !v)} className={editMode ? "bg-gradient-primary text-primary-foreground" : ""}>
          <Pencil className="h-3.5 w-3.5 mr-1.5" /> {editMode ? "Done" : "Edit layout"}
        </Button>
      </div>

      <div ref={containerRef}>
        {mounted && (
          <GridLayout
            width={width}
            layout={layoutWithConstraints}
            gridConfig={{ cols: 12, rowHeight: 30, margin: [16, 16], containerPadding: [0, 0], maxRows: Infinity }}
            dragConfig={{ enabled: editMode, handle: ".widget-drag-handle" }}
            resizeConfig={{ enabled: editMode }}
            onLayoutChange={onGridLayoutChange}
            autoSize
          >
            {layout.map((item) => {
              const base = baseWidgetId(item.i);
              const def = registryById.get(base);
              if (!def) return <div key={item.i} />;
              return (
                <div key={item.i} className="overflow-hidden">
                  <div className="h-full flex flex-col rounded-2xl">
                    {editMode && (
                      <div className="widget-drag-handle flex items-center gap-2 px-1 pb-1.5 cursor-move text-muted-foreground">
                        <GripVertical className="h-3.5 w-3.5 shrink-0" />
                        <span className="text-xs font-medium truncate flex-1">{def.title}</span>
                        <button onClick={() => duplicateWidget(item.i)} className="hover:text-foreground transition-colors" aria-label="Duplicate widget">
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => hideWidget(item.i)} className="hover:text-destructive transition-colors" aria-label="Hide widget">
                          {item.i === base ? <EyeOff className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                        </button>
                      </div>
                    )}
                    <div className="flex-1 min-h-0 overflow-auto">{content[base]}</div>
                  </div>
                </div>
              );
            })}
          </GridLayout>
        )}
      </div>
    </div>
  );
}
