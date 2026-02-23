import { supabase } from './supabaseClient';
import { VentaRow, Filters, DetailFilters } from '../types';

const VIEW = 'v_ventas_consolidadas';

/** Límite de filas para el detalle de grilla */
export const PAGE_SIZE = 500;

/**
 * Trae filas de v_ventas_consolidadas con filtros globales + filtros de detalle en servidor.
 * La vista ya incluye DISTINCT ON → sólo el pago de mayor importe por comprobante.
 */
export async function fetchVentas(
    filters: Filters,
    detailFilters: DetailFilters,
    from = 0
): Promise<{ data: VentaRow[]; count: number }> {
    let query = supabase
        .from(VIEW)
        .select('*', { count: 'exact' })
        .order('fecha', { ascending: false })
        .range(from, from + PAGE_SIZE - 1);

    // ── Fecha: el rango del DetailSidebar sobreescribe el global si está definido ──
    const fechaDesde = detailFilters.fechaDesde || filters.fechaDesde;
    const fechaHasta = detailFilters.fechaHasta || filters.fechaHasta;
    if (fechaDesde) query = query.gte('fecha', `${fechaDesde}T00:00:00`);
    if (fechaHasta) query = query.lte('fecha', `${fechaHasta}T23:59:59`);

    // ── Filtros globales (sin fecha, ya aplicada arriba) ──────────────────────
    if (filters.sucursales.length > 0) query = query.in('nro_sucursal', filters.sucursales);
    if (filters.rubros.length > 0) query = query.in('rubro', filters.rubros);
    if (filters.modalidades.length > 0) query = query.in('modalidad_venta', filters.modalidades);
    // search global (descripcio sólo — para compatibilidad dashboard)
    if (filters.search.trim() && !detailFilters.search.trim()) {
        query = query.ilike('descripcio', `%${filters.search.trim()}%`);
    }

    // ── Filtros exclusivos del Detalle ────────────────────────────────────────
    // Search-as-you-type: OR entre cod_articu y descripcio
    if (detailFilters.search.trim()) {
        const term = detailFilters.search.trim();
        query = query.or(`descripcio.ilike.%${term}%,cod_articu.ilike.%${term}%`);
    }
    // Búsqueda por número de comprobante
    if (detailFilters.comprobante.trim()) {
        query = query.ilike('n_comp', `%${detailFilters.comprobante.trim()}%`);
    }
    // Sucursal extra (AND con global)
    if (detailFilters.sucursales.length > 0) query = query.in('nro_sucursal', detailFilters.sucursales);
    // Rubro extra (AND con global)
    if (detailFilters.rubros.length > 0) query = query.in('rubro', detailFilters.rubros);
    // Medio de Pago — busca el valor seleccionado en AMBAS columnas (OR simple).
    // desc_cuenta almacena bancos/cajas; desc_cond_venta almacena Cuenta Corriente,
    // Crédito por Financiera, etc. Al buscar en las dos a la vez cubrimos todos los casos.
    if (detailFilters.cuentas.length > 0) {
        // Escapar comillas simples para evitar errores de sintaxis en PostgREST
        const inList = detailFilters.cuentas
            .map(v => v.trim().replace(/'/g, "''"))
            .map(v => `"${v}"`)
            .join(',');
        query = query.or(`desc_cuenta.in.(${inList}),desc_cond_venta.in.(${inList})`);
    }

    // Cliente
    if (detailFilters.clientes.length > 0) query = query.in('razon_social', detailFilters.clientes);
    // Cuotas
    if (detailFilters.cuotas.length > 0) query = query.in('cant_cuotas', detailFilters.cuotas);

    const { data, error, count } = await query;

    if (error) {
        console.error('[salesService] fetchVentas error:', error);
        throw error;
    }

    return { data: (data ?? []) as VentaRow[], count: count ?? 0 };
}

/**
 * KPIs agregados para el Dashboard.
 * Usa select('*') para traer todos los campos incluyendo imp_prop_c_iva.
 */
export async function fetchVentasAgregadas(filters: Filters): Promise<VentaRow[]> {
    let query = supabase
        .from(VIEW)
        .select('*')                          // select(*) — diagnóstico, incluye imp_prop_c_iva
        .order('fecha', { ascending: false })
        .limit(5000);

    // Fechas en formato YYYY-MM-DD — compatible con columnas date de Postgres
    if (filters.fechaDesde) query = query.gte('fecha', filters.fechaDesde);
    if (filters.fechaHasta) query = query.lte('fecha', filters.fechaHasta);

    // nro_sucursal es string — asegurar que el array no contenga números
    if (filters.sucursales.length > 0)
        query = query.in('nro_sucursal', filters.sucursales.map(String));

    if (filters.rubros.length > 0) query = query.in('rubro', filters.rubros);
    if (filters.modalidades.length > 0) query = query.in('modalidad_venta', filters.modalidades);
    if (filters.search.trim()) query = query.ilike('descripcio', `%${filters.search.trim()}%`);

    const { data, error } = await query;
    if (error) {
        console.error('[DASHBOARD] Supabase 400 error completo:', JSON.stringify(error, null, 2));
        console.error('[DASHBOARD] Filtros aplicados:', {
            fechaDesde: filters.fechaDesde,
            fechaHasta: filters.fechaHasta,
            sucursales: filters.sucursales.map(String),
            rubros: filters.rubros,
        });
        return [];
    }
    const rows = (data ?? []) as unknown as VentaRow[];
    console.log(
        `[DASHBOARD] fetchVentasAgregadas → ${rows.length} filas OK`,
        rows.length > 0
            ? {
                fecha: rows[0].fecha,
                importe_c_iva: rows[0].importe_c_iva,
                imp_prop_c_iva: rows[0].imp_prop_c_iva,
                tipo_imp_prop: typeof rows[0].imp_prop_c_iva,
            }
            : '(sin datos — revisar rango de fechas)'
    );
    return rows;
}

/**
 * Calcula el rango del período anterior (mismo tramo N días, un mes antes)
 * y devuelve los datos agregados para la comparación en el dashboard.
 */
export async function fetchVentasAgregadasPrevio(filters: Filters): Promise<VentaRow[]> {
    if (!filters.fechaDesde || !filters.fechaHasta) return [];

    // Desplazar ambas fechas exactamente un mes hacia atrás
    const shiftMonth = (iso: string, delta: number): string => {
        const d = new Date(`${iso}T00:00:00`);
        d.setMonth(d.getMonth() + delta);
        return d.toISOString().substring(0, 10);
    };

    const prevFilters: Filters = {
        ...filters,
        fechaDesde: shiftMonth(filters.fechaDesde, -1),
        fechaHasta: shiftMonth(filters.fechaHasta, -1),
    };
    return fetchVentasAgregadas(prevFilters);
}

export interface DateRange { fechaDesde: string; fechaHasta: string; }

/**
 * Sucursales con actividad en el rango (SELECT DISTINCT, orden numérico).
 * Llama la función RPC `get_distinct_sucursales` creada en Supabase.
 */
export async function fetchSucursales(range: DateRange): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_distinct_sucursales', {
        p_fecha_desde: range.fechaDesde || null,
        p_fecha_hasta: range.fechaHasta || null,
    });
    if (error) { console.error('[salesService] fetchSucursales RPC:', error); return []; }
    return (data ?? []).map((r: any) => r.nro_sucursal as string).filter(Boolean);
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
 * Llama la función RPC `get_top_clientes` creada en Supabase.
 */
export async function fetchTopClientes(range: DateRange): Promise<string[]> {
    const { data, error } = await supabase.rpc('get_top_clientes', {
        p_fecha_desde: range.fechaDesde || null,
        p_fecha_hasta: range.fechaHasta || null,
    });
    if (error) { console.error('[salesService] fetchTopClientes RPC:', error); return []; }
    return (data ?? []).map((r: any) => r.razon_social as string).filter(Boolean);
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
