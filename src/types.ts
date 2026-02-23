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
  cod_cta_cupon: string | null;
  cant_cuotas: number | null;
  imp_cupon: number | null;
  neto_cupon: number | null;
  plan_tarjeta: string | null;
  /** 'Cuenta Corriente' | 'Contado/Tarjeta' */
  modalidad_venta: string;
  porcentaje_rentabilidad: number;
}

/** Filtros aplicables en servidor */
export interface Filters {
  fechaDesde: string;         // 'YYYY-MM-DD'
  fechaHasta: string;         // 'YYYY-MM-DD'
  sucursales: string[];        // nro_sucursal
  rubros: string[];
  modalidades: string[];       // modalidad_venta
  search: string;              // ilike en descripcio
}

/** Filtros adicionales exclusivos de la vista Detalle de Ventas */
export interface DetailFilters {
  /** Sobreescribe el rango global cuando están definidos */
  fechaDesde: string;    // 'YYYY-MM-DD' — vacío = usa el rango global
  fechaHasta: string;    // 'YYYY-MM-DD' — vacío = usa el rango global
  comprobante: string;   // ilike en n_comp
  search: string;        // OR en cod_articu + descripcio (search-as-you-type)
  sucursales: string[];  // nro_sucursal (AND con filtros globales)
  rubros: string[];      // rubro (AND con filtros globales)
  cuentas: string[];     // desc_cuenta
  clientes: string[];    // razon_social
  cuotas: number[];      // cant_cuotas seleccionadas
}

/** Opciones disponibles para los checkboxes del DetailSidebar */
export interface DetailFilterOptions {
  sucursales: string[];
  rubros: string[];
  cuentas: string[];
  clientes: string[];
  cuotas: number[];      // valores distintos de cant_cuotas
}

export const DEFAULT_DETAIL_FILTERS: DetailFilters = {
  fechaDesde: '',
  fechaHasta: '',
  comprobante: '',
  search: '',
  sucursales: [],
  rubros: [],
  cuentas: [],
  clientes: [],
  cuotas: [],
};

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
  avgMargen: number;
  totalCantidad: number;
}
