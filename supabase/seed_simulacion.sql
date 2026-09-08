-- ============================================================
-- Seed: datos de prueba para la feature de simulación
-- Pegar en Supabase Dashboard → SQL Editor → Run
-- ============================================================

-- 1. Agregar columna tipo a rubros (si no existe)
ALTER TABLE rubros ADD COLUMN IF NOT EXISTS tipo text;

-- 2. Seed data
DO $$
DECLARE
  v_user_id   uuid;
  v_studio_id uuid;

  v_p1 uuid := gen_random_uuid();
  v_p2 uuid := gen_random_uuid();
  v_p3 uuid := gen_random_uuid();
  v_p4 uuid := gen_random_uuid();

  -- rubros proyecto 1 (Casa Palermo)
  v_r1_est  uuid := gen_random_uuid();
  v_r1_elec uuid := gen_random_uuid();
  v_r1_plo  uuid := gen_random_uuid();

  -- rubros proyecto 2 (Reforma Belgrano)
  v_r2_mam uuid := gen_random_uuid();
  v_r2_ter uuid := gen_random_uuid();
  v_r2_pin uuid := gen_random_uuid();

  -- rubros proyecto 3 (Local Comercial Sur)
  v_r3_elec uuid := gen_random_uuid();
  v_r3_car  uuid := gen_random_uuid();
  v_r3_pin  uuid := gen_random_uuid();

  -- rubros proyecto 4 (Edificio Caballito)
  v_r4_est  uuid := gen_random_uuid();
  v_r4_mam  uuid := gen_random_uuid();
  v_r4_ter  uuid := gen_random_uuid();
  v_r4_elec uuid := gen_random_uuid();

BEGIN
  -- Obtener usuario y estudio
  SELECT u.id INTO v_user_id
  FROM auth.users u
  WHERE lower(u.email) = 'agusstiin.az@gmail.com'
  LIMIT 1;

  SELECT id INTO v_studio_id
  FROM studios
  WHERE created_by = v_user_id
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuario no encontrado. Verificá que estés logueado.';
  END IF;

  -- ── Proyectos ────────────────────────────────────────────────

  INSERT INTO projects (id, name, created_by, studio_id, start_date, end_date) VALUES
    (v_p1, 'Casa Palermo',           v_user_id, v_studio_id, '2024-02-01', '2024-07-30'),
    (v_p2, 'Reforma Belgrano',       v_user_id, v_studio_id, '2024-03-15', '2024-08-20'),
    (v_p3, 'Local Comercial Sur',    v_user_id, v_studio_id, '2024-05-01', '2024-08-15'),
    (v_p4, 'Edificio Caballito',     v_user_id, v_studio_id, '2023-08-01', '2024-05-31');

  -- ── Rubros ───────────────────────────────────────────────────
  -- Cobertura por tipo:
  --   Estructura   → 2 rubros (promedio ~105 días)
  --   Electricidad → 3 rubros (promedio ~42 días)
  --   Mampostería  → 2 rubros (promedio ~68 días)
  --   Terminaciones→ 2 rubros (promedio ~55 días)
  --   Pintura      → 2 rubros (promedio ~27 días)
  --   Plomería     → 1 rubro  (badge "pocos datos")
  --   Carpintería  → 1 rubro  (badge "pocos datos")

  INSERT INTO rubros (id, project_id, name, tipo, code, status, start_date, end_date) VALUES
    -- Casa Palermo
    (v_r1_est,  v_p1, 'Estructura principal',           'Estructura',    'RB-001', 'completada', '2024-02-01', '2024-05-01'),
    (v_r1_elec, v_p1, 'Instalaciones eléctricas',       'Electricidad',  'RB-002', 'completada', '2024-04-15', '2024-06-15'),
    (v_r1_plo,  v_p1, 'Plomería y desagüe',             'Plomería',      'RB-003', 'completada', '2024-04-01', '2024-05-10'),
    -- Reforma Belgrano
    (v_r2_mam,  v_p2, 'Mampostería y tabiques',         'Mampostería',   'RB-004', 'completada', '2024-03-15', '2024-05-20'),
    (v_r2_ter,  v_p2, 'Terminaciones generales',        'Terminaciones', 'RB-005', 'completada', '2024-05-20', '2024-07-10'),
    (v_r2_pin,  v_p2, 'Pintura interior',               'Pintura',       'RB-006', 'completada', '2024-07-10', '2024-08-01'),
    -- Local Sur
    (v_r3_elec, v_p3, 'Eléctrico comercial',            'Electricidad',  'RB-007', 'completada', '2024-05-01', '2024-06-10'),
    (v_r3_car,  v_p3, 'Carpintería y muebles',          'Carpintería',   'RB-008', 'completada', '2024-06-01', '2024-07-15'),
    (v_r3_pin,  v_p3, 'Pintura y revestimientos',       'Pintura',       'RB-009', 'completada', '2024-07-01', '2024-08-05'),
    -- Edificio Caballito
    (v_r4_est,  v_p4, 'Estructura de hormigón',         'Estructura',    'RB-010', 'completada', '2023-08-01', '2024-01-15'),
    (v_r4_mam,  v_p4, 'Cerramientos y mampostería',     'Mampostería',   'RB-011', 'completada', '2023-11-01', '2024-02-20'),
    (v_r4_ter,  v_p4, 'Terminaciones y revestimientos', 'Terminaciones', 'RB-012', 'completada', '2024-02-01', '2024-04-10'),
    (v_r4_elec, v_p4, 'Sistema eléctrico completo',     'Electricidad',  'RB-013', 'completada', '2023-12-01', '2024-02-20');

  -- ── Materiales ───────────────────────────────────────────────

  INSERT INTO materials (project_id, rubro_id, name, unit, unit_cost, estimated_quantity) VALUES

    -- ESTRUCTURA — Casa Palermo
    (v_p1, v_r1_est, 'Cemento Portland',   'kg',    320,  2400),
    (v_p1, v_r1_est, 'Arena gruesa',       'm³',   8500,    18),
    (v_p1, v_r1_est, 'Hierro Ø 12mm',     'kg',    680,   950),
    (v_p1, v_r1_est, 'Hierro Ø 8mm',      'kg',    650,   420),
    (v_p1, v_r1_est, 'Tabla encofrado',   'un.',   420,    80),
    (v_p1, v_r1_est, 'Piedra partida',    'm³',   7200,    12),

    -- ELECTRICIDAD — Casa Palermo
    (v_p1, v_r1_elec, 'Cable 1.5mm IRAM',    'm',     85,  480),
    (v_p1, v_r1_elec, 'Cable 2.5mm IRAM',    'm',    110,  320),
    (v_p1, v_r1_elec, 'Cañería corrugada',   'm',     45,  350),
    (v_p1, v_r1_elec, 'Tablero modular 24p', 'un.', 9800,    1),
    (v_p1, v_r1_elec, 'Llave térmica 16A',   'un.',  620,    8),
    (v_p1, v_r1_elec, 'Tomacorriente doble', 'un.',  380,   14),

    -- PLOMERÍA — Casa Palermo
    (v_p1, v_r1_plo, 'Caño PPR Ø 20mm',   'm',    180,  120),
    (v_p1, v_r1_plo, 'Caño PPR Ø 25mm',   'm',    230,   80),
    (v_p1, v_r1_plo, 'Llave de paso 1/2"', 'un.',  850,    6),
    (v_p1, v_r1_plo, 'Sifón de piso',     'un.',  420,    3),

    -- MAMPOSTERÍA — Belgrano
    (v_p2, v_r2_mam, 'Ladrillo hueco 18', 'un.',   38, 3200),
    (v_p2, v_r2_mam, 'Cemento Portland',  'kg',   320,  800),
    (v_p2, v_r2_mam, 'Arena fina',        'm³',  7200,    8),
    (v_p2, v_r2_mam, 'Cal hidráulica',    'kg',   280,  400),
    (v_p2, v_r2_mam, 'Dintel pretensado', 'un.',  950,    8),

    -- TERMINACIONES — Belgrano
    (v_p2, v_r2_ter, 'Porcelanato 60x60', 'm²',  3400,  120),
    (v_p2, v_r2_ter, 'Adhesivo cerámico', 'kg',   180, 1200),
    (v_p2, v_r2_ter, 'Pastina',           'kg',    95,  180),
    (v_p2, v_r2_ter, 'Zócalo de madera',  'm',    420,   80),
    (v_p2, v_r2_ter, 'Masilla plástica',  'kg',   210,   60),

    -- PINTURA — Belgrano
    (v_p2, v_r2_pin, 'Pintura látex int.', 'l',   680,  80),
    (v_p2, v_r2_pin, 'Sellador al agua',   'l',   420,  20),
    (v_p2, v_r2_pin, 'Rodillo lana 22cm', 'un.',  320,   6),
    (v_p2, v_r2_pin, 'Pincel angular 2"', 'un.',  180,   4),

    -- ELECTRICIDAD — Local Sur
    (v_p3, v_r3_elec, 'Cable 2.5mm IRAM',    'm',    110,  520),
    (v_p3, v_r3_elec, 'Cable 4mm IRAM',      'm',    160,  200),
    (v_p3, v_r3_elec, 'Cañería corrugada',   'm',     45,  480),
    (v_p3, v_r3_elec, 'Tablero modular 18p', 'un.', 7800,    1),
    (v_p3, v_r3_elec, 'Llave térmica 20A',   'un.',  720,    6),
    (v_p3, v_r3_elec, 'Tomacorriente doble', 'un.',  380,   10),

    -- CARPINTERÍA — Local Sur
    (v_p3, v_r3_car, 'Tablero MDF 18mm',    'un.', 4200,  12),
    (v_p3, v_r3_car, 'Bisagra soft-close',  'un.',  280,  24),
    (v_p3, v_r3_car, 'Manija aluminio',     'un.',  380,  16),
    (v_p3, v_r3_car, 'Corredera full ext.', 'un.',  650,   8),
    (v_p3, v_r3_car, 'Cantonera aluminio',  'm',    280,  24),

    -- PINTURA — Local Sur
    (v_p3, v_r3_pin, 'Pintura látex int.', 'l',   680,  55),
    (v_p3, v_r3_pin, 'Pintura esmalte',    'l',   920,  15),
    (v_p3, v_r3_pin, 'Sellador al agua',   'l',   420,  15),
    (v_p3, v_r3_pin, 'Rodillo lana 22cm', 'un.',  320,   4),

    -- ESTRUCTURA — Caballito
    (v_p4, v_r4_est, 'Cemento Portland',   'kg',    320, 8500),
    (v_p4, v_r4_est, 'Arena gruesa',       'm³',   8500,   55),
    (v_p4, v_r4_est, 'Hierro Ø 12mm',     'kg',    680, 3200),
    (v_p4, v_r4_est, 'Hierro Ø 16mm',     'kg',    720, 1800),
    (v_p4, v_r4_est, 'Hierro Ø 8mm',      'kg',    650,  900),
    (v_p4, v_r4_est, 'Tabla encofrado',   'un.',   420,  240),
    (v_p4, v_r4_est, 'Piedra partida',    'm³',   7200,   38),

    -- MAMPOSTERÍA — Caballito
    (v_p4, v_r4_mam, 'Ladrillo hueco 18', 'un.',   38, 9500),
    (v_p4, v_r4_mam, 'Cemento Portland',  'kg',   320, 2400),
    (v_p4, v_r4_mam, 'Arena fina',        'm³',  7200,   22),
    (v_p4, v_r4_mam, 'Cal hidráulica',    'kg',   280,  950),
    (v_p4, v_r4_mam, 'Dintel pretensado', 'un.',  950,   22),

    -- TERMINACIONES — Caballito
    (v_p4, v_r4_ter, 'Porcelanato 60x60', 'm²',  3400,  380),
    (v_p4, v_r4_ter, 'Adhesivo cerámico', 'kg',   180, 3800),
    (v_p4, v_r4_ter, 'Pastina',           'kg',    95,  560),
    (v_p4, v_r4_ter, 'Zócalo de madera',  'm',    420,  240),
    (v_p4, v_r4_ter, 'Masilla plástica',  'kg',   210,  180),

    -- ELECTRICIDAD — Caballito
    (v_p4, v_r4_elec, 'Cable 1.5mm IRAM',    'm',     85, 1200),
    (v_p4, v_r4_elec, 'Cable 2.5mm IRAM',    'm',    110,  950),
    (v_p4, v_r4_elec, 'Cañería corrugada',   'm',     45,  900),
    (v_p4, v_r4_elec, 'Tablero modular 24p', 'un.', 9800,    2),
    (v_p4, v_r4_elec, 'Llave térmica 16A',   'un.',  620,   18),
    (v_p4, v_r4_elec, 'Tomacorriente doble', 'un.',  380,   32);

END $$;
