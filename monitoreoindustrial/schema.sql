create table if not exists public.operators (
  id uuid primary key,
  full_name text not null,
  employee_number text not null unique,
  username text not null unique,
  password text not null,
  role text not null check (role in ('administrador', 'operador')),
  created_at timestamptz not null default now()
);

create table if not exists public.measurements (
  id uuid primary key,
  capture_date timestamptz not null default now(),
  operator text not null,
  operator_id uuid,
  line text not null,
  component text not null,
  year integer not null,
  week text not null,
  temperature numeric not null,
  vibration_horizontal numeric not null,
  vibration_vertical numeric not null,
  vibration_axial numeric not null,
  vibration_rod_delantero numeric not null,
  amperage_l1 numeric not null,
  amperage_l2 numeric not null,
  amperage_l3 numeric not null,
  created_at timestamptz not null default now()
);

alter table public.operators enable row level security;
alter table public.measurements enable row level security;

create policy "anon read operators" on public.operators for select using (true);
create policy "anon write operators" on public.operators for insert with check (true);
create policy "anon update operators" on public.operators for update using (true);
create policy "anon delete operators" on public.operators for delete using (true);

create policy "anon read measurements" on public.measurements for select using (true);
create policy "anon write measurements" on public.measurements for insert with check (true);
create policy "anon update measurements" on public.measurements for update using (true);
create policy "anon delete measurements" on public.measurements for delete using (true);
