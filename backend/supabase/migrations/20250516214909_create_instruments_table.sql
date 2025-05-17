-- Create the table
create table if not exists instruments (
  id bigint primary key generated always as identity,
  name text not null
);
alter table instruments enable row level security;
create policy "public can read instruments"
on public.instruments
for select to anon
using (true);