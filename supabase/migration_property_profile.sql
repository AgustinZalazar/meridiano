-- ============================================================
-- Meridiano — Property profile fields on projects
-- ============================================================

-- Enums
CREATE TYPE property_type AS ENUM (
  'edificio', 'casa', 'local_comercial', 'oficina', 'nave_industrial', 'otro'
);

CREATE TYPE tipo_obra AS ENUM (
  'obra_nueva', 'refaccion', 'ampliacion', 'demolicion', 'otro'
);

-- New columns
ALTER TABLE projects
  ADD COLUMN property_type  property_type,
  ADD COLUMN tipo_obra      tipo_obra,
  ADD COLUMN m2_cubiertos   numeric(10,2),
  ADD COLUMN m2_totales     numeric(10,2),
  ADD COLUMN m2_terreno     numeric(10,2),
  ADD COLUMN pisos          integer,
  ADD COLUMN unidades       integer,
  ADD COLUMN dormitorios    integer,
  ADD COLUMN banos          integer,
  ADD COLUMN ambientes      integer,
  ADD COLUMN cocheras       integer,
  ADD COLUMN amenities      jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN direccion      text,
  ADD COLUMN comitente      text,
  ADD COLUMN anio_proyecto  integer;
