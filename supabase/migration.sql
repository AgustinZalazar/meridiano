-- ============================================================
-- Meridiano — Migration
-- Pegar completo en Supabase Dashboard → SQL Editor → Run
-- ============================================================


-- ── Enums ────────────────────────────────────────────────────

create type member_role     as enum ('owner', 'admin', 'member', 'viewer');
create type obra_status     as enum ('sin_iniciar', 'en_curso', 'completada');
create type report_type     as enum ('contratistas', 'oficina');
create type report_mode     as enum ('video', 'foto');
create type report_status   as enum ('processing', 'completed', 'failed');
create type pending_status  as enum ('pendiente', 'en_revision', 'resuelto');
create type pending_source  as enum ('ai', 'manual');


-- ── Tablas ───────────────────────────────────────────────────

create table profiles (
  id          uuid primary key references auth.users on delete cascade,
  full_name   text not null default '',
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  image_url   text,
  created_by  uuid not null references profiles on delete restrict,
  created_at  timestamptz not null default now()
);

create table project_members (
  project_id  uuid not null references projects on delete cascade,
  user_id     uuid not null references profiles on delete cascade,
  role        member_role not null default 'member',
  joined_at   timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table obras (
  id          uuid primary key default gen_random_uuid(),
  project_id  uuid not null references projects on delete cascade,
  code        text not null,
  name        text not null,
  contractor  text,
  status      obra_status not null default 'sin_iniciar',
  start_date  date,
  end_date    date,
  created_at  timestamptz not null default now()
);

create table reports (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects on delete cascade,
  obra_id        uuid not null references obras on delete cascade,
  created_by     uuid not null references profiles on delete restrict,
  type           report_type not null,
  mode           report_mode not null,
  note           text,
  status         report_status not null default 'processing',
  transcription  text,
  ai_summary     text,
  created_at     timestamptz not null default now()
);

create table report_frames (
  id                  uuid primary key default gen_random_uuid(),
  report_id           uuid not null references reports on delete cascade,
  storage_path        text not null,
  timestamp_sec       integer not null default 0,
  visual_description  text,
  order_index         integer not null default 0
);

create table pending_items (
  id           uuid primary key default gen_random_uuid(),
  report_id    uuid references reports on delete set null,
  frame_id     uuid references report_frames on delete set null,
  project_id   uuid not null references projects on delete cascade,
  obra_id      uuid not null references obras on delete cascade,
  description  text not null,
  trade        text,
  status       pending_status not null default 'pendiente',
  source       pending_source not null default 'manual',
  resolved_by  uuid references profiles on delete set null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create table planos (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects on delete cascade,
  name          text not null,
  type          text not null,
  storage_path  text not null,
  uploaded_by   uuid not null references profiles on delete restrict,
  created_at    timestamptz not null default now()
);


-- ── Índices ──────────────────────────────────────────────────

create index on obras         (project_id);
create index on reports       (project_id, obra_id);
create index on reports       (created_by);
create index on report_frames (report_id);
create index on pending_items (project_id, status);
create index on pending_items (obra_id);
create index on pending_items (report_id);
create index on planos        (project_id);


-- ── Trigger: crear profile al registrarse ────────────────────

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    new.raw_user_meta_data->>'avatar_url'
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();


-- ── Trigger: al crear proyecto, insertar como owner ──────────

create or replace function handle_new_project()
returns trigger as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.created_by, 'owner');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_project_created
  after insert on projects
  for each row execute procedure handle_new_project();


-- ── Helper RLS ───────────────────────────────────────────────
-- Función reutilizable en todas las políticas

create or replace function is_project_member(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from project_members
    where project_id = p_project_id
    and   user_id    = auth.uid()
  );
$$ language sql security definer stable;

create or replace function is_project_admin(p_project_id uuid)
returns boolean as $$
  select exists (
    select 1 from project_members
    where project_id = p_project_id
    and   user_id    = auth.uid()
    and   role in ('owner', 'admin')
  );
$$ language sql security definer stable;


-- ── RLS ──────────────────────────────────────────────────────

alter table profiles       enable row level security;
alter table projects       enable row level security;
alter table project_members enable row level security;
alter table obras          enable row level security;
alter table reports        enable row level security;
alter table report_frames  enable row level security;
alter table pending_items  enable row level security;
alter table planos         enable row level security;


-- profiles
create policy "Usuarios ven todos los perfiles"
  on profiles for select
  to authenticated
  using (true);

create policy "Usuarios editan su propio perfil"
  on profiles for update
  to authenticated
  using (id = auth.uid());


-- projects
create policy "Miembros ven sus proyectos"
  on projects for select
  to authenticated
  using (is_project_member(id));

create policy "Cualquier usuario autenticado crea proyectos"
  on projects for insert
  to authenticated
  with check (created_by = auth.uid());

create policy "Admins editan el proyecto"
  on projects for update
  to authenticated
  using (is_project_admin(id));

create policy "Solo owner elimina el proyecto"
  on projects for delete
  to authenticated
  using (
    exists (
      select 1 from project_members
      where project_id = projects.id
      and   user_id    = auth.uid()
      and   role       = 'owner'
    )
  );


-- project_members
create policy "Miembros ven los miembros del proyecto"
  on project_members for select
  to authenticated
  using (is_project_member(project_id));

create policy "Admins agregan miembros"
  on project_members for insert
  to authenticated
  with check (is_project_admin(project_id));

create policy "Admins eliminan miembros"
  on project_members for delete
  to authenticated
  using (is_project_admin(project_id));

create policy "Admins cambian roles"
  on project_members for update
  to authenticated
  using (is_project_admin(project_id));


-- obras
create policy "Miembros ven obras"
  on obras for select
  to authenticated
  using (is_project_member(project_id));

create policy "Miembros crean obras"
  on obras for insert
  to authenticated
  with check (is_project_member(project_id));

create policy "Admins editan obras"
  on obras for update
  to authenticated
  using (is_project_admin(project_id));

create policy "Admins eliminan obras"
  on obras for delete
  to authenticated
  using (is_project_admin(project_id));


-- reports
create policy "Miembros ven informes"
  on reports for select
  to authenticated
  using (is_project_member(project_id));

create policy "Miembros crean informes"
  on reports for insert
  to authenticated
  with check (is_project_member(project_id) and created_by = auth.uid());

create policy "Creador o admin edita el informe"
  on reports for update
  to authenticated
  using (created_by = auth.uid() or is_project_admin(project_id));

create policy "Admins eliminan informes"
  on reports for delete
  to authenticated
  using (is_project_admin(project_id));


-- report_frames
create policy "Miembros ven frames"
  on report_frames for select
  to authenticated
  using (
    exists (
      select 1 from reports
      where reports.id = report_frames.report_id
      and   is_project_member(reports.project_id)
    )
  );

create policy "Miembros insertan frames"
  on report_frames for insert
  to authenticated
  with check (
    exists (
      select 1 from reports
      where reports.id = report_frames.report_id
      and   is_project_member(reports.project_id)
    )
  );


-- pending_items
create policy "Miembros ven pendientes"
  on pending_items for select
  to authenticated
  using (is_project_member(project_id));

create policy "Miembros crean pendientes"
  on pending_items for insert
  to authenticated
  with check (is_project_member(project_id));

create policy "Miembros actualizan pendientes"
  on pending_items for update
  to authenticated
  using (is_project_member(project_id));

create policy "Admins eliminan pendientes"
  on pending_items for delete
  to authenticated
  using (is_project_admin(project_id));


-- planos
create policy "Miembros ven planos"
  on planos for select
  to authenticated
  using (is_project_member(project_id));

create policy "Miembros suben planos"
  on planos for insert
  to authenticated
  with check (is_project_member(project_id) and uploaded_by = auth.uid());

create policy "Admins eliminan planos"
  on planos for delete
  to authenticated
  using (is_project_admin(project_id));


-- ── Storage buckets ──────────────────────────────────────────
-- Crear manualmente en Dashboard → Storage → New bucket

-- report-frames  (private)
-- processing     (private, archivos temporales de video/audio)
-- planos         (private)
