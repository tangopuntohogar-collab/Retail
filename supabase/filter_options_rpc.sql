-- ============================================================
-- Funciones RPC para obtener valores DISTINTOS filtrados por fecha
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- 1. Sucursales con actividad en el período, ordenadas numéricamente
CREATE OR REPLACE FUNCTION get_distinct_sucursales(
  p_fecha_desde text DEFAULT NULL,
  p_fecha_hasta text DEFAULT NULL
)
RETURNS TABLE(nro_sucursal text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT n AS nro_sucursal
  FROM (
    SELECT DISTINCT v.nro_sucursal::text AS n
    FROM v_ventas_consolidadas v
    WHERE
      (p_fecha_desde IS NULL OR v.fecha >= p_fecha_desde::timestamptz)
      AND (p_fecha_hasta IS NULL OR v.fecha <= (p_fecha_hasta::date + interval '1 day' - interval '1 second')::timestamptz)
  ) sub
  ORDER BY n::bigint;
$$;

-- 2. Rubros con actividad en el período
CREATE OR REPLACE FUNCTION get_distinct_rubros(
  p_fecha_desde text DEFAULT NULL,
  p_fecha_hasta text DEFAULT NULL
)
RETURNS TABLE(rubro text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT v.rubro
  FROM v_ventas_consolidadas v
  WHERE
    v.rubro IS NOT NULL
    AND (p_fecha_desde IS NULL OR v.fecha >= p_fecha_desde::timestamptz)
    AND (p_fecha_hasta IS NULL OR v.fecha <= (p_fecha_hasta::date + interval '1 day' - interval '1 second')::timestamptz)
  ORDER BY v.rubro;
$$;

-- 3. Medios de pago unificados: desc_cuenta (cond='1') + desc_cond_venta (resto)
--    Misma lógica que la columna 'Medio de Pago' en la grilla de ventas.
CREATE OR REPLACE FUNCTION get_distinct_medios_pago(
  p_fecha_desde text DEFAULT NULL,
  p_fecha_hasta text DEFAULT NULL
)
RETURNS TABLE(medio_pago text)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT medio_pago
  FROM (
    -- Registros con pago por cuenta (cod_cond_venta = '1') → mostrar desc_cuenta
    SELECT v.desc_cuenta AS medio_pago
    FROM v_ventas_consolidadas v
    WHERE v.cod_cond_venta = '1'
      AND v.desc_cuenta IS NOT NULL
      AND (p_fecha_desde IS NULL OR v.fecha >= p_fecha_desde::date)
      AND (p_fecha_hasta IS NULL OR v.fecha <= p_fecha_hasta::date)

    UNION ALL

    -- Registros con condición comercial (cod_cond_venta <> '1') → mostrar desc_cond_venta
    SELECT v.desc_cond_venta AS medio_pago
    FROM v_ventas_consolidadas v
    WHERE v.cod_cond_venta <> '1'
      AND v.desc_cond_venta IS NOT NULL
      AND (p_fecha_desde IS NULL OR v.fecha >= p_fecha_desde::date)
      AND (p_fecha_hasta IS NULL OR v.fecha <= p_fecha_hasta::date)
  ) sub
  WHERE medio_pago IS NOT NULL AND medio_pago <> ''
  ORDER BY medio_pago;
$$;

GRANT EXECUTE ON FUNCTION get_distinct_medios_pago(text, text) TO anon;


-- 4. Top 50 clientes por volumen de compra en el período (GROUP BY en servidor)
CREATE OR REPLACE FUNCTION get_top_clientes(
  p_fecha_desde text DEFAULT NULL,
  p_fecha_hasta text DEFAULT NULL
)
RETURNS TABLE(razon_social text, total_compra numeric)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    v.razon_social,
    SUM(v.importe_c_iva) AS total_compra
  FROM v_ventas_consolidadas v
  WHERE
    v.razon_social IS NOT NULL
    AND (p_fecha_desde IS NULL OR v.fecha >= p_fecha_desde::timestamptz)
    AND (p_fecha_hasta IS NULL OR v.fecha <= (p_fecha_hasta::date + interval '1 day' - interval '1 second')::timestamptz)
  GROUP BY v.razon_social
  ORDER BY total_compra DESC
  LIMIT 50;
$$;

-- 5. Valores distintos de cant_cuotas (para checkboxes dinámicos en DetailSidebar)
CREATE OR REPLACE FUNCTION get_distinct_cuotas(
  p_fecha_desde text DEFAULT NULL,
  p_fecha_hasta text DEFAULT NULL
)
RETURNS TABLE(cant_cuotas integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT v.cant_cuotas::integer
  FROM v_ventas_consolidadas v
  WHERE
    v.cant_cuotas IS NOT NULL
    AND v.cant_cuotas > 0
    AND (p_fecha_desde IS NULL OR v.fecha >= p_fecha_desde::timestamptz)
    AND (p_fecha_hasta IS NULL OR v.fecha <= (p_fecha_hasta::date + interval '1 day' - interval '1 second')::timestamptz)
  ORDER BY v.cant_cuotas::integer;
$$;

-- Otorgar permisos al rol anon (requerido para llamarlas desde el frontend)
GRANT EXECUTE ON FUNCTION get_distinct_sucursales(text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_distinct_rubros(text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_distinct_cuentas(text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_top_clientes(text, text) TO anon;
GRANT EXECUTE ON FUNCTION get_distinct_cuotas(text, text) TO anon;


