/** Fila exacta que retorna la vista v_ventas_consolidadas */
export interface VentaRow {
  nro_sucursal: string;
  t_comp: string;
  n_comp: string;
  fecha: string;              // timestamp → string al serializar
  cod_articu: string;
  cod_client: string;
  razon_social: string;
  cod_cond_venta: string;
  desc_cond_venta: string;
  cantidad: number;
  importe_c_iva: number;
  imp_prop_c_iva: number | null;     // monto proporcional (fuente de verdad de facturación)
  precio_neto: number | null;        // precio neto sin IVA
  pr_ult_cpa_c_iva: number | null;   // último precio de compra c/IVA
  costo: number | null;              // costo unitario (nuevo campo en la vista)
  margen_contribucion: number;
  descripcio: string;
  desc_adic: string | null;
  rubro: string;
  monto_comprobante: number;
  cod_cta: string;
  desc_cuenta: string;
  cant_cuotas: number | null;
  /** 'Cuenta Corriente' | 'Contado/Tarjeta' */
  modalida_venta: string;
  porcentaje_rentabilidad: number;
  familia: string | null;
  categoria: string | null;
  tipo: string | null;
  genero: string | null;
  proveedor: string | null;
}

/** Filtros unificados para todas las vistas (Dashboard y Detalle) */
export interface VentasFilters {
  fechaDesde: string;         // 'YYYY-MM-DD'
  fechaHasta: string;         // 'YYYY-MM-DD'
  sucursales: string[];        // nro_sucursal
  rubros: string[];
  modalidades: string[];       // modalida_venta
  search: string;              // ilike en descripcio o cod_articu
  cuentas: string[];           // desc_cuenta
  clientes: string[];          // razon_social
  cuotas: number[];            // cant_cuotas seleccionadas
  comprobante: string;         // ilike en n_comp
  familias: string[];
  categorias: string[];
  tipos: string[];
  generos: string[];
  proveedores: string[];
}

/** Helper para obtener los filtros iniciales (mes en curso) */
export const getInitialFilters = (): VentasFilters => {
  const today = new Date();
  const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const toISO = (d: Date) => {
    // Offset local para evitar cambios de día por zona horaria
    const offset = d.getTimezoneOffset();
    const localDate = new Date(d.getTime() - (offset * 60 * 1000));
    return localDate.toISOString().substring(0, 10);
  };

  return {
    fechaDesde: toISO(firstOfMonth),
    fechaHasta: toISO(today),
    sucursales: [],
    rubros: [],
    modalidades: [],
    search: '',
    cuentas: [],
    clientes: [],
    cuotas: [],
    comprobante: '',
    familias: [],
    categorias: [],
    tipos: [],
    generos: [],
    proveedores: [],
  };
};

/** Alias para compatibilidad parcial (se irán eliminando) */
export type Filters = VentasFilters;
export type DetailFilters = VentasFilters;

/** Opciones disponibles para los checkboxes de los sidebars de filtros */
export interface DetailFilterOptions {
  sucursales: string[];
  rubros: string[];
  cuentas: string[];
  clientes: string[];
  cuotas: number[];      // valores distintos de cant_cuotas
  familias: string[];
  categorias: string[];
  tipos: string[];
  generos: string[];
  proveedores: string[];
}

export interface DashboardStats {
  totalFacturado: number;
  margenTotal: number;
  rentabilidad: number;
  ticketPromedio: number;
}

export interface BranchSales {
  name: string;
  amount: number;
  percentage: number;
}

export interface PaymentMix {
  key: string;
  label: string;
  color: string;
  amount: number;
  pct: number;
}

export interface RubroPoint {
  rubro: string;
  avg_margen: number;
  total_cantidad: number;
}

export interface DashboardKPIs {
  totalFacturado: number;
  margenTotal: number;
  rentabilidad: number;
  voucherCount: number;
}

export interface StackedDataPoint {
  nro_sucursal: string;
  categoria_negocio: string;
  medio_pago: string;
  monto: number;
}

export interface TopArticle {
  cod_articu: string;
  descripcio: string;
  total: number;
  cant: number;
  margen: number;
}

export interface DashboardMetrics {
  kpis: DashboardKPIs;
  stacked_data: StackedDataPoint[];
  top_articles: TopArticle[];
  rubro_points: RubroPoint[];
  rows_count?: number;
}
