-- Create system_logs table if not exists
create table if not exists system_logs (
  id uuid default gen_random_uuid() primary key,
  level text not null,
  message text not null,
  data_json text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table system_logs enable row level security;

-- Policies
create policy "Anyone can insert logs."
  on system_logs for insert
  with check ( true );

create policy "Only authenticated users can select logs."
  on system_logs for select
  to authenticated
  using ( true );

create policy "Only authenticated users can update logs."
  on system_logs for update
  to authenticated
  using ( true );

create policy "Only authenticated users can delete logs."
  on system_logs for delete
  to authenticated
  using ( true );
