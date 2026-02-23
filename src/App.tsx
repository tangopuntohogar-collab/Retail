import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { DashboardView } from './components/DashboardView';
import { SalesTable } from './components/SalesTable';
import { DetailSidebar } from './components/DetailSidebar';
import { VentaRow, Filters, DetailFilters, DetailFilterOptions, DEFAULT_DETAIL_FILTERS } from './types';
import {
  fetchVentas, fetchVentasAgregadas, fetchVentasAgregadasPrevio, PAGE_SIZE,
  fetchSucursales, fetchRubros, fetchDescCuentas, fetchTopClientes, fetchCuotas,
  DateRange,
} from './lib/salesService';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const today = new Date();
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
const toISO = (d: Date) => d.toISOString().substring(0, 10);

const DEFAULT_FILTERS: Filters = {
  fechaDesde: toISO(firstOfMonth),
  fechaHasta: toISO(today),
  sucursales: [],
  rubros: [],
  modalidades: [],
  search: '',
};

const EMPTY_DETAIL_OPTIONS: DetailFilterOptions = {
  sucursales: [], rubros: [], cuentas: [], clientes: [], cuotas: [],
};

export default function App() {
  const [activeView, setActiveView] = useState<'dashboard' | 'detail'>('dashboard');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  // ── Global filters (dashboard + table) ────────────────────────────────────
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  // ── Detail-only filters ───────────────────────────────────────────────────
  const [detailFilters, setDetailFilters] = useState<DetailFilters>(DEFAULT_DETAIL_FILTERS);
  const [detailOptions, setDetailOptions] = useState<DetailFilterOptions>(EMPTY_DETAIL_OPTIONS);
  const [isLoadingOptions, setIsLoadingOptions] = useState(true);

  // ── Data state ────────────────────────────────────────────────────────────
  const [dashData, setDashData] = useState<VentaRow[]>([]);
  const [dashPrevData, setDashPrevData] = useState<VentaRow[]>([]);
  const [tableData, setTableData] = useState<VentaRow[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));

  // ── Load detail sidebar options (re-runs when date range changes) ─────────
  useEffect(() => {
    const range: DateRange = { fechaDesde: filters.fechaDesde, fechaHasta: filters.fechaHasta };
    setIsLoadingOptions(true);
    Promise.all([
      fetchSucursales(range),
      fetchRubros(range),
      fetchDescCuentas(range),
      fetchTopClientes(range),
      fetchCuotas(range),
    ])
      .then(([suc, rub, cuentas, clientes, cuotas]) => {
        setDetailOptions({ sucursales: suc, rubros: rub, cuentas, clientes, cuotas });
      })
      .catch(e => console.error('Error cargando opciones de detalle:', e))
      .finally(() => setIsLoadingOptions(false));
  }, [filters.fechaDesde, filters.fechaHasta]); // ← re-carga al cambiar fechas

  // ── Load dashboard (aggregated) ───────────────────────────────────────────
  const loadDashboard = useCallback(async (f: Filters) => {
    try {
      const [rows, prevRows] = await Promise.all([
        fetchVentasAgregadas(f),
        fetchVentasAgregadasPrevio(f),
      ]);
      setDashData(rows);
      setDashPrevData(prevRows);
    } catch (e: any) {
      console.error('Dashboard error:', e);
    }
  }, []);

  // ── Load table (paginated, detail filters applied) ────────────────────────
  const loadTable = useCallback(async (f: Filters, df: DetailFilters, page: number) => {
    try {
      const { data, count } = await fetchVentas(f, df, page * PAGE_SIZE);
      setTableData(data);
      setTotalCount(count);
    } catch (e: any) {
      console.error('Table error:', e);
    }
  }, []);

  // ── React to global filter changes ────────────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);
    setCurrentPage(0);

    Promise.all([
      loadDashboard(filters),
      loadTable(filters, detailFilters, 0),
    ])
      .catch((e: any) => {
        if (!cancelled) setError(e?.message ?? 'Error al conectar con Supabase');
      })
      .finally(() => { if (!cancelled) setIsLoading(false); });

    return () => { cancelled = true; };
  }, [filters]); // global filters trigger full reload

  // ── React to detail filter changes (only reloads table) ───────────────────
  useEffect(() => {
    setCurrentPage(0);
    setIsLoading(true);
    loadTable(filters, detailFilters, 0)
      .finally(() => setIsLoading(false));
  }, [detailFilters]); // detail filters reload table only

  // ── Pagination ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (currentPage === 0) return;
    setIsLoading(true);
    loadTable(filters, detailFilters, currentPage)
      .finally(() => setIsLoading(false));
  }, [currentPage]);

  const handleViewChange = (view: 'dashboard' | 'detail') => {
    setActiveView(view);
    setIsSidebarCollapsed(view === 'detail');
  };

  const handlePageChange = (delta: number) =>
    setCurrentPage(p => Math.min(Math.max(0, p + delta), totalPages - 1));

  const pageFrom = currentPage * PAGE_SIZE + 1;
  const pageTo = Math.min((currentPage + 1) * PAGE_SIZE, totalCount);

  return (
    <div className="flex h-screen w-full relative overflow-hidden bg-surface-dark">
      {/* Main nav sidebar */}
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        filters={filters}
        onFiltersChange={setFilters}
      />

      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        <Header
          title={activeView === 'dashboard' ? 'Tablero General' : 'Detalle de Ventas'}
          subtitle={
            activeView === 'dashboard'
              ? 'Operaciones Diarias > Vista Dashboard'
              : 'Operaciones Diarias > Vista Grilla'
          }
          isLoading={isLoading}
          error={error}
          tableData={activeView === 'detail' ? tableData : []}
        />

        <div className="flex-1 overflow-hidden relative w-full flex flex-col">
          <AnimatePresence mode="wait">

            {/* ── Dashboard View ─────────────────────────────────────────── */}
            {activeView === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                <DashboardView data={dashData} prevData={dashPrevData} filters={filters} isLoading={isLoading} />
              </motion.div>
            )}

            {/* ── Detail View ────────────────────────────────────────────── */}
            {activeView === 'detail' && (
              <motion.div
                key="detail"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full flex"
              >
                {/* Filter sidebar dedicated to the detail view */}
                <DetailSidebar
                  filters={detailFilters}
                  onFiltersChange={setDetailFilters}
                  options={detailOptions}
                  isLoadingOptions={isLoadingOptions}
                />

                {/* Table + pagination */}
                <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
                  <SalesTable data={tableData} isLoading={isLoading} />

                  {/* Pagination Footer */}
                  <div className="h-14 border-t border-border-dark bg-[#0f172a] shrink-0 flex items-center justify-between px-6 z-20">
                    <div className="text-xs text-slate-400">
                      {isLoading
                        ? 'Cargando datos...'
                        : totalCount === 0
                          ? 'Sin registros para los filtros seleccionados'
                          : (
                            <>
                              Mostrando{' '}
                              <span className="font-medium text-white">{pageFrom}</span>
                              {' – '}
                              <span className="font-medium text-white">{pageTo}</span>
                              {' de '}
                              <span className="font-medium text-white">
                                {totalCount.toLocaleString('es-AR')}
                              </span>
                              {' registros'}
                            </>
                          )
                      }
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400 mr-2">
                        Pág. {currentPage + 1} / {totalPages}
                      </span>
                      <div className="flex items-center rounded-md border border-border-dark bg-[#020617] overflow-hidden">
                        <button
                          onClick={() => handlePageChange(-1)}
                          disabled={currentPage === 0 || isLoading}
                          className="px-3 py-1.5 text-slate-500 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
                        >
                          <ChevronLeft size={16} />
                        </button>
                        <div className="w-px h-4 bg-border-dark" />
                        <button
                          onClick={() => handlePageChange(1)}
                          disabled={currentPage >= totalPages - 1 || isLoading}
                          className="px-3 py-1.5 text-slate-500 hover:bg-slate-800 hover:text-white transition-colors disabled:opacity-50"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
