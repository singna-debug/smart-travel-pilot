
-- Create mobile_confirmations table
create table if not exists mobile_confirmations (
  id text primary key,
  data jsonb not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table mobile_confirmations enable row level security;

-- Policies
create policy "Public confirmations are viewable by everyone."
  on mobile_confirmations for select
  using ( true );

create policy "Anyone can insert confirmations."
  on mobile_confirmations for insert
  with check ( true );

create policy "Anyone can update confirmations."
  on mobile_confirmations for update
  using ( true );

create policy "Anyone can delete confirmations."
  on mobile_confirmations for delete
  using ( true );
