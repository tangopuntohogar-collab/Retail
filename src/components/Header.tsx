import React from 'react';
import { Search, Download, Bell, Database, AlertCircle } from 'lucide-react';
import { VentaRow } from '../types';

interface HeaderProps {
  title: string;
  subtitle?: string;
  isLoading?: boolean;
  error?: string | null;
  tableData?: VentaRow[];
}

/** Genera y descarga un CSV con todos los campos relevantes de la vista */
const exportToCSV = (rows: VentaRow[]) => {
  const fmt = (v: number | null) =>
    v != null ? v.toFixed(2).replace('.', ',') : '';

  const headers = [
    'Suc.', 'Tipo', 'Comprobante', 'Fecha',
    'Cód. Art.', 'Descripción', 'Info Adicional',
    'Cód. Cliente', 'Cliente', 'Rubro',
    'Medio de Pago', 'Cuotas',
    'Cantidad',
    'Precio Neto', 'Precio Unit.',
    'Total c/IVA',
    'Últ. Compra (c/IVA)',
    'Costo Unit.', 'Costo Total',
    'Rentab. %',
  ];

  const escape = (v: string | number | null | undefined) => {
    const s = v == null ? '' : String(v);
    return `"${s.replace(/"/g, '""')}"`;
  };

  const lines = rows.map(r => {
    const cant = r.cantidad ?? 0;
    const precioUnit = cant > 0 ? (r.importe_c_iva ?? 0) / cant : 0;
    const costoTotal = r.costo != null ? r.costo * cant : null;
    const mediopago = String(r.cod_cond_venta) === '1' ? r.desc_cuenta : r.desc_cond_venta;
    const fecha = r.fecha
      ? new Date(r.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })
      : '';

    return [
      r.nro_sucursal,
      r.t_comp,
      r.n_comp,
      fecha,
      r.cod_articu,
      r.descripcio,
      r.desc_adic ?? '',
      r.cod_client,
      r.razon_social,
      r.rubro,
      mediopago ?? '',
      r.cant_cuotas ?? '',
      cant.toFixed(0),
      fmt(r.precio_neto),
      fmt(precioUnit),
      fmt(r.importe_c_iva),
      fmt(r.pr_ult_cpa_c_iva),
      fmt(r.costo),
      fmt(costoTotal),
      (r.porcentaje_rentabilidad ?? 0).toFixed(2).replace('.', ','),
    ].map(escape).join(';');
  });

  const bom = '\uFEFF'; // BOM para que Excel abra con tildes correctamente
  const csv = bom + [headers.map(escape).join(';'), ...lines].join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ventas_${new Date().toISOString().substring(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
};

export const Header: React.FC<HeaderProps> = ({ title, subtitle, isLoading, error, tableData = [] }) => {
  return (
    <header className="h-16 border-b border-border-dark bg-[#0f172a]/95 backdrop-blur z-10 flex items-center justify-between px-8 shrink-0">
      <div className="flex items-center gap-4">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-white tracking-tight">{title}</h2>
          {subtitle && <p className="text-xs text-slate-400">{subtitle}</p>}
        </div>

        {error ? (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20 whitespace-nowrap flex items-center gap-1">
            <AlertCircle size={13} />
            Error de conexión
          </span>
        ) : (
          <span className="px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 whitespace-nowrap flex items-center gap-1">
            <Database size={13} />
            {isLoading ? 'Cargando...' : 'Supabase · En vivo'}
            {!isLoading && <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse ml-0.5" />}
          </span>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="h-6 w-px bg-border-dark mx-2 hidden sm:block" />
        <button className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors">
          <Search size={20} />
        </button>
        <button className="p-2 rounded-md hover:bg-slate-800 text-slate-400 hover:text-white transition-colors relative">
          <Bell size={20} />
          <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border border-slate-900" />
        </button>
        <button
          onClick={() => exportToCSV(tableData)}
          disabled={tableData.length === 0 || isLoading}
          title={tableData.length === 0 ? 'Sin datos para exportar' : `Exportar ${tableData.length} filas como CSV`}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors shadow-lg shadow-blue-500/20 whitespace-nowrap"
        >
          <Download size={18} />
          Exportar Reporte
        </button>
      </div>
    </header>
  );
};
