import { supabase } from './supabaseClient';
import { VentaRow, Filters, DetailFilters, VentasFilters, DashboardMetrics } from '../types';

const VIEW = 'v_ventas_consolidadas';

/** Límite de filas para el detalle de grilla */
export const PAGE_SIZE = 500;

/**
 * Trae filas de v_ventas_consolidadas con filtros globales + filtros de detalle en servidor.
 */
export async function fetchVentas(
    filters: VentasFilters,
    from = 0
): Promise<{ data: VentaRow[]; count: number }> {
    let query = supabase
        .from(VIEW)
        .select('*', { count: 'exact' });

    // Re-usar lógica de filtros si fuera necesario, pero por ahora fetchVentas
    // se usa en la grilla que tiene su propios filtros aplicados manualmente 
    // o podemos extraer applyCommonFilters de nuevo.

    // Por simplicidad para no romper la grilla, restauramos applyCommonFilters mínimamente
    const applyFilters = (q: any, f: VentasFilters) => {
        let res = q;
        if (f.fechaDesde) res = res.gte('fecha', f.fechaDesde);
        if (f.fechaHasta) res = res.lte('fecha', f.fechaHasta);
        if (f.sucursales?.length) res = res.in('nro_sucursal', f.sucursales.filter(Boolean));
        if (f.rubros?.length) res = res.in('rubro', f.rubros.filter(Boolean));
        if (f.modalidades?.length) res = res.in('modalida_venta', f.modalidades.filter(Boolean));
        if (f.familias?.length) res = res.in('familia', f.familias.filter(Boolean));
        if (f.categorias?.length) res = res.in('categoria', f.categorias.filter(Boolean));
        if (f.tipos?.length) res = res.in('tipo', f.tipos.filter(Boolean));
        if (f.generos?.length) res = res.in('genero', f.generos.filter(Boolean));
        if (f.proveedores?.length) res = res.in('proveedor', f.proveedores.filter(Boolean));
        if (f.clientes?.length) res = res.in('razon_social', f.clientes.filter(Boolean));
        if (f.cuotas?.length) res = res.in('cant_cuotas', f.cuotas.filter(v => v != null));

        // Medios de pago (Cuentas)
        if (f.cuentas?.length) {
            const clean = f.cuentas.filter(Boolean).map(v => `"${v}"`);
            if (clean.length > 0) {
                const list = `(${clean.join(',')})`;
                res = res.or(`desc_cuenta.in.${list},desc_cond_venta.in.${list}`);
            }
        }

        if (f.comprobante?.trim()) {
            res = res.ilike('n_comp', `%${f.comprobante.trim()}%`);
        }

        if (f.search?.trim()) {
            const s = `%${f.search.trim()}%`;
            res = res.or(`descripcio.ilike.${s},cod_articu.ilike.${s}`);
        }
        return res;
    };

    query = applyFilters(query, filters);

    const { data, error, count } = await query
        .order('fecha', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

    if (error) {
        console.error('[salesService] fetchVentas error:', error);
        throw error;
    }

    return { data: (data ?? []) as VentaRow[], count: count ?? 0 };
}

/**
 * Agregados para el Dashboard vía RPC (Eficiencia máxima).
 */
export async function fetchVentasAgregadas(filters: VentasFilters): Promise<DashboardMetrics> {
    console.log('[DASHBOARD] fetchVentasAgregadas RPC - Start with filters:', filters);

    const rpcParams = {
        p_fecha_desde: filters.fechaDesde || null,
        p_fecha_hasta: filters.fechaHasta || null,
        p_sucursales: filters.sucursales?.length ? filters.sucursales.filter(Boolean).map(String) : null,
        p_rubros: filters.rubros?.length ? filters.rubros.filter(Boolean) : null,
        p_modalidades: filters.modalidades?.length ? filters.modalidades.filter(Boolean) : null,
        p_cuentas: filters.cuentas?.length ? filters.cuentas.filter(Boolean) : null,
        p_clientes: filters.clientes?.length ? filters.clientes.filter(Boolean) : null,
        p_cuotas: filters.cuotas?.length ? filters.cuotas.filter(v => v != null) : null,
        p_familias: filters.familias?.length ? filters.familias.filter(Boolean) : null,
        p_categorias: filters.categorias?.length ? filters.categorias.filter(Boolean) : null,
        p_tipos: filters.tipos?.length ? filters.tipos.filter(Boolean) : null,
        p_generos: filters.generos?.length ? filters.generos.filter(Boolean) : null,
        p_proveedores: filters.proveedores?.length ? filters.proveedores.filter(Boolean) : null,
        p_comprobante: filters.comprobante?.trim() || null,
        p_search: filters.search?.trim() || null
    };
    console.log('[DASHBOARD] RPC Params Payload:', JSON.stringify(rpcParams, null, 2));

    const { data, error } = await supabase.rpc('get_dashboard_metrics', rpcParams);

    if (error) {
        console.error('[DASHBOARD] RPC Error:', JSON.stringify(error, null, 2));
        throw error;
    }

    console.log('[DASHBOARD] RPC Success:', data);
    return data as DashboardMetrics;
}

/**
 * Calcula el rango del período anterior (mismo tramo N días, un mes antes)
 * y devuelve los datos agregados para la comparación en el dashboard.
 */
export async function fetchVentasAgregadasPrevio(filters: VentasFilters): Promise<DashboardMetrics> {
    if (!filters.fechaDesde || !filters.fechaHasta) {
        return {
            kpis: { totalFacturado: 0, margenTotal: 0, rentabilidad: 0, voucherCount: 0 },
            stacked_data: [],
            top_articles: [],
            rubro_points: []
        };
    }

    // Desplazar ambas fechas exactamente un mes hacia atrás
    const shiftMonth = (iso: string, delta: number): string => {
        const d = new Date(`${iso}T00:00:00`);
        d.setMonth(d.getMonth() + delta);
        return d.toISOString().substring(0, 10);
    };

    const prevFilters: VentasFilters = {
        ...filters,
        fechaDesde: shiftMonth(filters.fechaDesde, -1),
        fechaHasta: shiftMonth(filters.fechaHasta, -1),
    };
    return fetchVentasAgregadas(prevFilters);
}

export interface DateRange { fechaDesde: string; fechaHasta: string; }

/**
 * Sucursales con actividad en el rango (SELECT DISTINCT, orden numérico).
 * Llama la función RPC `get_distinct_sucursales`; si falla o devuelve vacío,
 * hace fallback con query directa a la vista.
 */
export async function fetchSucursales(range: DateRange): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_distinct_sucursales', {
        p_fecha_desde: range.fechaDesde || null,
        p_fecha_hasta: range.fechaHasta || null,
    });
    if (!error) {
        const result = (data ?? []).map((r: any) => r.nro_sucursal as string).filter(Boolean);
        if (result.length > 0) return result;
        console.warn('[salesService] get_distinct_sucursales devolvió vacío, activando fallback...');
    } else {
        console.error('[salesService] fetchSucursales RPC:', error);
    }

    // Fallback: query directa a la vista
    try {
        let q = supabase.from(VIEW).select('nro_sucursal').not('nro_sucursal', 'is', null).limit(2000);
        if (range.fechaDesde) q = q.gte('fecha', range.fechaDesde);
        if (range.fechaHasta) q = q.lte('fecha', range.fechaHasta);
        const { data: rows, error: fbErr } = await q;
        if (fbErr) { console.error('[salesService] fetchSucursales fallback:', fbErr); return []; }
        const values = new Set<string>();
        (rows ?? []).forEach((r: any) => { if (r.nro_sucursal) values.add(r.nro_sucursal); });
        return Array.from(values).sort((a, b) => Number(a) - Number(b));
    } catch (e) {
        console.error('[salesService] fetchSucursales fallback exception:', e);
        return [];
    }
}

/**
 * Rubros con actividad en el rango (SELECT DISTINCT).
 * Llama la función RPC `get_distinct_rubros` creada en Supabase.
 */
export async function fetchRubros(range: DateRange): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_distinct_rubros', {
        p_fecha_desde: range.fechaDesde || null,
        p_fecha_hasta: range.fechaHasta || null,
    });
    if (error) { console.error('[salesService] fetchRubros RPC:', error); return []; }
    return (data ?? []).map((r: any) => r.rubro as string).filter(Boolean);
}

/**
 * Medios de pago unificados: desc_cuenta (cond='1') + desc_cond_venta (resto).
 * RPC: get_distinct_medios_pago (nombre exacto en Supabase).
 * Si el RPC falla o devuelve vacío, hace un fallback con query directa a la vista.
 */
export async function fetchMediosPago(range: DateRange): Promise<string[]> {
    console.log('[fetchMediosPago] Llamando RPC get_distinct_medios_pago con:', range);

    const { data, error } = await supabase.rpc('get_distinct_medios_pago', {
        p_fecha_desde: range.fechaDesde || null,
        p_fecha_hasta: range.fechaHasta || null,
    });

    if (error) {
        console.error('[fetchMediosPago] ERROR del RPC:', JSON.stringify(error, null, 2));
        console.warn('[fetchMediosPago] Activando fallback con query directa...');
    } else {
        const result = (data ?? []).map((r: any) => r.medio_pago as string).filter(Boolean);
        console.log(`[fetchMediosPago] RPC OK → ${result.length} medios:`, result);
        if (result.length > 0) return result;
        console.warn('[fetchMediosPago] RPC devolvió array vacío, activando fallback...');
    }

    // ── Fallback de emergencia: query directa a la vista ─────────────────────
    try {
        let q = supabase
            .from(VIEW)
            .select('cod_cond_venta, desc_cuenta, desc_cond_venta')
            .limit(5000);
        if (range.fechaDesde) q = q.gte('fecha', range.fechaDesde);
        if (range.fechaHasta) q = q.lte('fecha', range.fechaHasta);

        const { data: rows, error: fbErr } = await q;
        if (fbErr) { console.error('[fetchMediosPago] Fallback también falló:', fbErr); return []; }

        const medios = new Set<string>();
        (rows ?? []).forEach((r: any) => {
            if (r.cod_cond_venta === '1') {
                if (r.desc_cuenta) medios.add(r.desc_cuenta);
            } else {
                if (r.desc_cond_venta) medios.add(r.desc_cond_venta);
            }
        });
        const result = Array.from(medios).sort();
        console.log(`[fetchMediosPago] Fallback OK → ${result.length} medios:`, result);
        return result;
    } catch (e) {
        console.error('[fetchMediosPago] Excepción en fallback:', e);
        return [];
    }
}

/** @deprecated Usa fetchMediosPago en su lugar */
export const fetchDescCuentas = fetchMediosPago;



/**
 * Top 50 clientes por volumen de compra (GROUP BY + SUM en servidor).
 * Llama la función RPC `get_top_clientes`; si falla o devuelve vacío,
 * hace fallback con query directa a la vista.
 */
export async function fetchTopClientes(range: DateRange): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_top_clientes', {
        p_fecha_desde: range.fechaDesde || null,
        p_fecha_hasta: range.fechaHasta || null,
    });
    if (!error) {
        const result = (data ?? []).map((r: any) => r.razon_social as string).filter(Boolean);
        if (result.length > 0) return result;
        console.warn('[salesService] get_top_clientes devolvió vacío, activando fallback...');
    } else {
        console.error('[salesService] fetchTopClientes RPC:', error);
    }

    // Fallback: query directa a la vista, top 50 por frecuencia
    try {
        let q = supabase.from(VIEW).select('razon_social').not('razon_social', 'is', null).limit(5000);
        if (range.fechaDesde) q = q.gte('fecha', range.fechaDesde);
        if (range.fechaHasta) q = q.lte('fecha', range.fechaHasta);
        const { data: rows, error: fbErr } = await q;
        if (fbErr) { console.error('[salesService] fetchTopClientes fallback:', fbErr); return []; }
        const counts = new Map<string, number>();
        (rows ?? []).forEach((r: any) => {
            if (r.razon_social) counts.set(r.razon_social, (counts.get(r.razon_social) ?? 0) + 1);
        });
        return Array.from(counts.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, 50)
            .map(([name]) => name);
    } catch (e) {
        console.error('[salesService] fetchTopClientes fallback exception:', e);
        return [];
    }
}

/**
 * Valores distintos de cant_cuotas para los checkboxes del DetailSidebar.
 * Llama la función RPC `get_distinct_cuotas` creada en Supabase.
 */
export async function fetchCuotas(range: DateRange): Promise<number[]> {
    const { data, error } = await supabase.rpc('get_distinct_cuotas', {
        p_fecha_desde: range.fechaDesde || null,
        p_fecha_hasta: range.fechaHasta || null,
    });
    if (error) { console.error('[salesService] fetchCuotas RPC:', error); return []; }
    return (data ?? []).map((r: any) => r.cant_cuotas as number).filter((v) => v != null);
}

/**
 * Helper genérico para campos distintos.
 * Intenta el RPC `get_distinct_<field>`; si falla o devuelve vacío,
 * hace fallback con query directa a la vista (mismo patrón que fetchMediosPago).
 */
async function fetchDistinctField(field: string, range: DateRange): Promise<string[]> {
    const rpcName = `get_distinct_${field}`;
    const { data, error } = await supabase.rpc(rpcName, {
        p_fecha_desde: range.fechaDesde || null,
        p_fecha_hasta: range.fechaHasta || null,
    });
    if (!error) {
        const result = (data ?? []).map((r: any) => r[field] as string).filter(Boolean);
        if (result.length > 0) return result;
        console.warn(`[salesService] ${rpcName} devolvió vacío, activando fallback...`);
    } else {
        console.error(`[salesService] ${rpcName} error:`, error);
    }

    // Fallback: query directa a la vista
    try {
        let q = supabase.from(VIEW).select(field).not(field, 'is', null).limit(2000);
        if (range.fechaDesde) q = q.gte('fecha', range.fechaDesde);
        if (range.fechaHasta) q = q.lte('fecha', range.fechaHasta);
        const { data: rows, error: fbErr } = await q;
        if (fbErr) { console.error(`[salesService] ${field} fallback error:`, fbErr); return []; }
        const values = new Set<string>();
        (rows ?? []).forEach((r: any) => { if (r[field]) values.add(r[field]); });
        return Array.from(values).sort();
    } catch (e) {
        console.error(`[salesService] ${field} fallback exception:`, e);
        return [];
    }
}

export const fetchFamilias = (range: DateRange) => fetchDistinctField('familia', range);
export const fetchCategorias = (range: DateRange) => fetchDistinctField('categoria', range);
export const fetchTipos = (range: DateRange) => fetchDistinctField('tipo', range);
export const fetchGeneros = (range: DateRange) => fetchDistinctField('genero', range);
export const fetchProveedores = (range: DateRange) => fetchDistinctField('proveedor', range);
