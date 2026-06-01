
-- Create products table
create table if not exists products (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  description text,
  price text,
  url text,
  keywords text[],
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS (Row Level Security)
alter table products enable row level security;

-- Create policy to allow public read access
create policy "Public products are viewable by everyone."
  on products for select
  using ( true );

-- Create policy to allow authenticated insert/update/delete (or public for now since we have no auth)
create policy "Anyone can insert products."
  on products for insert
  with check ( true );

create policy "Anyone can update products."
  on products for update
  using ( true );

create policy "Anyone can delete products."
  on products for delete
  using ( true );
