-- ============================================================
-- RPC: get_dashboard_metrics
-- Agregación eficiente para el Tablero Principal
-- ============================================================

CREATE OR REPLACE FUNCTION get_dashboard_metrics(
  p_fecha_desde text DEFAULT NULL,
  p_fecha_hasta text DEFAULT NULL,
  p_sucursales text[] DEFAULT NULL,
  p_rubros text[] DEFAULT NULL,
  p_modalidades text[] DEFAULT NULL,
  p_cuentas text[] DEFAULT NULL,
  p_clientes text[] DEFAULT NULL,
  p_cuotas integer[] DEFAULT NULL,
  p_familias text[] DEFAULT NULL,
  p_categorias text[] DEFAULT NULL,
  p_tipos text[] DEFAULT NULL,
  p_generos text[] DEFAULT NULL,
  p_proveedores text[] DEFAULT NULL,
  p_comprobante text DEFAULT NULL,
  p_search text DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  v_result json;
BEGIN
  -- 1. CTE con la data filtrada y consolidada por comprobante
  WITH voucher_consolidated AS (
    SELECT 
      v.nro_sucursal,
      v.t_comp,
      v.n_comp,
      MAX(v.fecha) as fecha,
      SUM(COALESCE(v.imp_prop_c_iva, v.importe_c_iva)) as importe_total,
      SUM(COALESCE(v.margen_contribucion, 0)) as margen_total,
      MAX(v.rubro) as rubro, -- Simplificación para top artículos/rubros
      MAX(v.descripcio) as descripcio,
      MAX(v.cod_articu) as cod_articu,
      SUM(v.cantidad) as cantidad,
      AVG(v.porcentaje_rentabilidad) as avg_rentabilidad,
      MAX(v.desc_cuenta) as desc_cuenta,
      MAX(v.desc_cond_venta) as desc_cond_venta,
      MAX(v.cod_cond_venta) as cod_cond_venta,
      MAX(v.cant_cuotas) as cant_cuotas,
      -- Categorización igual a DashboardView.tsx
      CASE 
        WHEN UPPER(MAX(v.desc_cuenta)) LIKE 'CAJA%' OR UPPER(MAX(v.desc_cuenta)) LIKE 'BANCO%' THEN 'CONTADO EFECTIVO'
        WHEN UPPER(MAX(v.desc_cond_venta)) = 'CREDITOS POR FINANCIERA' THEN 'CRÉDITO FINANCIERA'
        WHEN MAX(v.cant_cuotas) > 0 THEN 'TARJETA'
        ELSE 'CUENTA CORRIENTE'
      END as categoria_negocio,
      -- Medio de pago original para breakdown
      CASE 
        WHEN MAX(v.cod_cond_venta) = '1' THEN COALESCE(MAX(v.desc_cuenta), 'Contado')
        ELSE COALESCE(MAX(v.desc_cond_venta), 'Otros')
      END as medio_pago
    FROM v_ventas_consolidadas v
    WHERE
      (p_fecha_desde IS NULL OR v.fecha >= p_fecha_desde::timestamptz)
      AND (p_fecha_hasta IS NULL OR v.fecha <= (p_fecha_hasta::date + interval '1 day' - interval '1 second')::timestamptz)
      AND (p_sucursales IS NULL OR v.nro_sucursal::text = ANY(p_sucursales))
      AND (p_rubros IS NULL OR v.rubro = ANY(p_rubros))
      AND (p_modalidades IS NULL OR v.modalidad_venta = ANY(p_modalidades))
      AND (p_cuentas IS NULL OR (v.desc_cuenta = ANY(p_cuentas) OR v.desc_cond_venta = ANY(p_cuentas)))
      AND (p_clientes IS NULL OR v.razon_social = ANY(p_clientes))
      AND (p_cuotas IS NULL OR v.cant_cuotas::integer = ANY(p_cuotas))
      AND (p_familias IS NULL OR v.familia = ANY(p_familias))
      AND (p_categorias IS NULL OR v.categoria = ANY(p_categorias))
      AND (p_tipos IS NULL OR v.tipo = ANY(p_tipos))
      AND (p_generos IS NULL OR v.genero = ANY(p_generos))
      AND (p_proveedores IS NULL OR v.proveedor = ANY(p_proveedores))
      AND (p_comprobante IS NULL OR v.n_comp ILIKE '%' || p_comprobante || '%')
      AND (p_search IS NULL OR (v.descripcio ILIKE '%' || p_search || '%' OR v.cod_articu ILIKE '%' || p_search || '%'))
    GROUP BY v.nro_sucursal, v.t_comp, v.n_comp
  ),
  -- 2. KPIs
  kpis AS (
    SELECT 
      COALESCE(SUM(importe_total), 0) as total_facturado,
      COALESCE(SUM(margen_total), 0) as margen_total_val,
      CASE WHEN SUM(importe_total) > 0 THEN (SUM(margen_total) / SUM(importe_total)) * 100 ELSE 0 END as rentabilidad,
      COUNT(*) as cant_vouchers
    FROM voucher_consolidated
  ),
  -- 3. Ventas por Sucursal, Categoría y Medio (Stacked Bar / Mix)
  sucursal_summary AS (
    SELECT 
      nro_sucursal,
      categoria_negocio,
      medio_pago,
      SUM(importe_total) as monto
    FROM voucher_consolidated
    GROUP BY nro_sucursal, categoria_negocio, medio_pago
  ),
  -- 4. Top 5 Artículos
  top_articulos AS (
    SELECT 
      cod_articu,
      descripcio,
      SUM(importe_total) as total,
      SUM(cantidad) as cant,
      AVG(avg_rentabilidad) as margen
    FROM voucher_consolidated
    WHERE cod_articu IS NOT NULL
    GROUP BY cod_articu, descripcio
    ORDER BY total DESC
    LIMIT 5
  ),
  -- 5. Dispersión por Rubro
  rubro_dispersion AS (
    SELECT 
      rubro,
      AVG(avg_rentabilidad) as avg_margen,
      SUM(cantidad) as total_cantidad
    FROM voucher_consolidated
    WHERE rubro IS NOT NULL
    GROUP BY rubro
  )
  
  -- Construcción del JSON final
  SELECT json_build_object(
    'kpis', (SELECT json_build_object(
               'totalFacturado', total_facturado,
               'margenTotal', margen_total_val,
               'rentabilidad', rentabilidad,
               'voucherCount', cant_vouchers
             ) FROM kpis),
    'stacked_data', (SELECT COALESCE(json_agg(s), '[]'::json) FROM sucursal_summary s),
    'top_articles', (SELECT COALESCE(json_agg(t), '[]'::json) FROM top_articulos t),
    'rubro_points', (SELECT COALESCE(json_agg(r), '[]'::json) FROM rubro_dispersion r)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION get_dashboard_metrics TO anon;
