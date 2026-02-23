import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  TableProperties,
  ChevronLeft,
  Search,
  Calendar,
  Store,
  Layers,
  CreditCard,
  LogOut,
  Filter,
  RefreshCw
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Filters } from '../types';
import { fetchSucursales, fetchRubros, DateRange } from '../lib/salesService';

const MODALIDADES = ['Contado/Tarjeta', 'Cuenta Corriente'];
const PAYMENT_COLORS: Record<string, string> = {
  'Contado/Tarjeta': '#1269e2',
  'Cuenta Corriente': '#f59e0b',
};

interface SidebarProps {
  activeView: 'dashboard' | 'detail';
  onViewChange: (view: 'dashboard' | 'detail') => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  filters: Filters;
  onFiltersChange: (f: Filters) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onViewChange,
  isCollapsed,
  onToggleCollapse,
  filters,
  onFiltersChange,
}) => {
  const [sucursales, setSucursales] = useState<string[]>([]);
  const [rubros, setRubros] = useState<string[]>([]);

  useEffect(() => {
    const range: DateRange = { fechaDesde: filters.fechaDesde, fechaHasta: filters.fechaHasta };
    fetchSucursales(range).then(setSucursales);
    fetchRubros(range).then(setRubros);
  }, [filters.fechaDesde, filters.fechaHasta]);

  const toggleArray = (key: keyof Pick<Filters, 'sucursales' | 'rubros' | 'modalidades'>, value: string) => {
    const current = filters[key] as string[];
    const next = current.includes(value) ? current.filter(v => v !== value) : [...current, value];
    onFiltersChange({ ...filters, [key]: next });
  };

  const handleReset = () => {
    const today = new Date();
    const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const toISO = (d: Date) => d.toISOString().substring(0, 10);
    onFiltersChange({
      fechaDesde: toISO(firstOfMonth),
      fechaHasta: toISO(today),
      sucursales: [],
      rubros: [],
      modalidades: [],
      search: '',
    });
  };

  const activeFilterCount = [
    filters.sucursales.length > 0,
    filters.rubros.length > 0,
    filters.modalidades.length > 0,
    !!filters.search,
  ].filter(Boolean).length;

  return (
    <aside
      className={`flex-shrink-0 flex flex-col border-r border-border-dark bg-[#111418] h-full z-20 relative transition-all duration-300 ${isCollapsed ? 'w-20' : 'w-80'}`}
    >
      <button
        onClick={onToggleCollapse}
        className="absolute -right-3 top-6 bg-primary text-white rounded-full p-1 shadow-lg hover:bg-blue-600 focus:outline-none z-50 border border-border-dark transition-transform duration-300"
        style={{ transform: isCollapsed ? 'rotate(180deg)' : 'none' }}
      >
        <ChevronLeft size={16} />
      </button>

      {/* Logo */}
      <div className={`p-6 pb-2 flex-shrink-0 ${isCollapsed ? 'flex justify-center' : ''}`}>
        <div className="flex items-center gap-3 mb-8">
          <div
            className="bg-center bg-no-repeat bg-cover rounded-full size-10 shrink-0 border border-slate-700"
            style={{ backgroundImage: 'url("https://lh3.googleusercontent.com/aida-public/AB6AXuDOxoMuWiLWbn8XlRBhZ24Z68CTCLAeMQt2Fz8mLVD8BtCTSGYfZ93je1S5vyX0ZsxZZYQzz8ABlDHtyKXpTgBZqqXhGMyCRTlsL19797kMrPDLzSMFFE64whQR8F5tg40MfxPtdcuVbiFrTbPB7K7Evg_U1LEzE2qV5tLpTo4SqSg04z5Gz99VKQbglERmUJlyHIMHwdCo2kA9eYvXIjxm9X1Zon-tctxKe44g1DlOQ2ZfXWaKOHULOiRj7hQEkyZWsiSAjo7kQuQ")' }}
          />
          {!isCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
              <h1 className="text-white text-lg font-bold leading-none tracking-tight whitespace-nowrap">Retail Electro</h1>
              <p className="text-emerald-400 text-xs font-normal mt-1 whitespace-nowrap flex items-center gap-1">
                <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" />
                Supabase · En vivo
              </p>
            </motion.div>
          )}
        </div>

        <div className="mb-6">
          {!isCollapsed && <h3 className="text-slate-400 text-xs font-semibold uppercase tracking-wider mb-4 px-1">Navegación Principal</h3>}
          <nav className="flex flex-col gap-1">
            <button
              onClick={() => onViewChange('dashboard')}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer w-full ${activeView === 'dashboard' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              title="Tablero de Ventas"
            >
              <LayoutDashboard size={20} className="shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">Tablero de Ventas</span>}
            </button>
            <button
              onClick={() => onViewChange('detail')}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors cursor-pointer w-full ${activeView === 'detail' ? 'bg-primary/20 text-primary border border-primary/20' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}
              title="Detalle de Ventas"
            >
              <TableProperties size={20} className="shrink-0" />
              {!isCollapsed && <span className="text-sm font-medium whitespace-nowrap">Detalle de Ventas</span>}
            </button>
          </nav>
        </div>
      </div>

      <div className="h-px bg-slate-800 w-full mb-6" />

      {/* Filters */}
      <div className={`flex-1 overflow-y-auto px-6 flex flex-col gap-5 pb-10 custom-scrollbar ${isCollapsed ? 'items-center' : ''}`}>
        {isCollapsed ? (
          <div className="flex flex-col gap-6 items-center">
            <button className="text-primary hover:text-white bg-primary/10 p-2 rounded-full border border-primary/20 relative">
              <Filter size={20} />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-[#111418]">{activeFilterCount}</span>
              )}
            </button>
            <Search size={20} className="text-slate-400" />
            <Calendar size={20} className="text-slate-400" />
            <Store size={20} className="text-slate-400" />
            <Layers size={20} className="text-slate-400" />
            <CreditCard size={20} className="text-slate-400" />
          </div>
        ) : (
          <AnimatePresence>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

              {/* Header con reset */}
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                  <Filter size={14} /> Filtros
                  {activeFilterCount > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-primary text-white text-[10px] font-bold">{activeFilterCount}</span>
                  )}
                </span>
                <button
                  onClick={handleReset}
                  className="text-xs text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
                >
                  <RefreshCw size={12} /> Limpiar
                </button>
              </div>

              {/* Buscador */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">Buscar Artículo</label>
                <div className="relative">
                  <Search size={14} className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={filters.search}
                    onChange={e => onFiltersChange({ ...filters, search: e.target.value })}
                    className="w-full bg-[#1e293b] border border-slate-700 text-white text-xs rounded-lg pl-8 p-2 focus:ring-1 focus:ring-primary outline-none"
                    placeholder="SKU o descripción..."
                  />
                </div>
              </div>

              {/* Rango de Fechas */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">Rango de Fechas</label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="date"
                    value={filters.fechaDesde}
                    onChange={e => onFiltersChange({ ...filters, fechaDesde: e.target.value })}
                    className="bg-[#1e293b] border border-slate-700 text-white text-xs rounded-lg p-2 focus:ring-1 focus:ring-primary outline-none"
                  />
                  <input
                    type="date"
                    value={filters.fechaHasta}
                    onChange={e => onFiltersChange({ ...filters, fechaHasta: e.target.value })}
                    className="bg-[#1e293b] border border-slate-700 text-white text-xs rounded-lg p-2 focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>

              {/* Sucursales */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-slate-300">Sucursales</label>
                  <button
                    onClick={() => onFiltersChange({ ...filters, sucursales: [] })}
                    className="text-xs text-primary cursor-pointer hover:underline"
                  >
                    Todas
                  </button>
                </div>
                <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-2 max-h-36 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                  {sucursales.length === 0 ? (
                    <span className="text-xs text-slate-500 px-1">Cargando...</span>
                  ) : (
                    sucursales.map(s => (
                      <label key={s} className="flex items-center space-x-2 p-1 hover:bg-white/5 rounded cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={filters.sucursales.includes(s)}
                          onChange={() => toggleArray('sucursales', s)}
                          className="rounded border-slate-600 bg-slate-800 text-primary focus:ring-0 size-4"
                        />
                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors">Suc. {s}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Rubros */}
              <div className="flex flex-col gap-2">
                <div className="flex justify-between items-center">
                  <label className="text-sm font-medium text-slate-300">Rubros</label>
                  <button
                    onClick={() => onFiltersChange({ ...filters, rubros: [] })}
                    className="text-xs text-primary cursor-pointer hover:underline"
                  >
                    Todos
                  </button>
                </div>
                <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-2 max-h-36 overflow-y-auto flex flex-col gap-1 custom-scrollbar">
                  {rubros.length === 0 ? (
                    <span className="text-xs text-slate-500 px-1">Cargando...</span>
                  ) : (
                    rubros.map(r => (
                      <label key={r} className="flex items-center space-x-2 p-1 hover:bg-white/5 rounded cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={filters.rubros.includes(r)}
                          onChange={() => toggleArray('rubros', r)}
                          className="rounded border-slate-600 bg-slate-800 text-primary focus:ring-0 size-4"
                        />
                        <span className="text-sm text-slate-300 group-hover:text-white transition-colors truncate">{r}</span>
                      </label>
                    ))
                  )}
                </div>
              </div>

              {/* Modalidad de Venta */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-300">Modalidad de Venta</label>
                <div className="bg-[#1e293b] border border-slate-700 rounded-lg p-2 flex flex-col gap-1">
                  {MODALIDADES.map(m => (
                    <label key={m} className="flex items-center space-x-2 p-1 hover:bg-white/5 rounded cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={filters.modalidades.includes(m)}
                        onChange={() => toggleArray('modalidades', m)}
                        className="rounded border-slate-600 bg-slate-800 text-primary focus:ring-0 size-4"
                      />
                      <span className="flex items-center gap-2 text-sm text-slate-300 group-hover:text-white transition-colors">
                        <span className="size-2 rounded-full" style={{ backgroundColor: PAYMENT_COLORS[m] ?? '#64748b' }} />
                        {m}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

            </motion.div>
          </AnimatePresence>
        )}
      </div>

      {/* Footer */}
      <div className="mt-auto p-4 border-t border-slate-800 bg-[#0b0e11] flex items-center justify-between">
        <div className="flex items-center gap-3 overflow-hidden">
          <div className="size-9 rounded-full bg-slate-700 overflow-hidden shrink-0">
            <img
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDx8nwdKzISJRJwRbtBqpP3bP4hYlKCXk74qybs8HpnnNLv2CuqAHwLt9bjOKNSvYkIwUbiZFUpmXCyvEy3yKdh0xGeYTFo4d4aC8yV9r3c52UXk36HkkgXwyr3cjp1ttD747DtxiBBlO3Oh4qfF1C-c71hOV2JM67ozgkIdTg-tPF2uLbqXJdfwkx2y_emq2br2Fzrq8IOVP5v5uIZ885Dt3FzFZAQUABUPQ00qL8Kun06Xn2M7u2uLUzNT1sXOkDCSKqGX6yjORg"
              alt="Roberto Gomez"
              className="h-full w-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          {!isCollapsed && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col">
              <span className="text-sm font-medium text-white whitespace-nowrap">Roberto Gomez</span>
              <span className="text-xs text-slate-500 whitespace-nowrap">Gerente de Ventas</span>
            </motion.div>
          )}
        </div>
        {!isCollapsed && (
          <button className="text-slate-400 hover:text-white">
            <LogOut size={18} />
          </button>
        )}
      </div>
    </aside>
  );
};
