-- Enable the pg_net extension to allow making HTTP requests from Supabase
create extension if not exists pg_net;

-- Create a function that calls the Next.js revalidation API
create or replace function public.revalidate_nextjs_cache()
returns trigger as $$
declare
  -- CHANGE THIS to your deployed Next.js app URL
  app_url text := 'https://your-app-domain.com'; 
  -- CHANGE THIS to your secret
  secret_token text := 'super-secret-revalidation-token';
  tag text;
begin
  -- Determine which tag to revalidate based on the table
  if TG_TABLE_NAME = 'visits' then
    tag := 'visits';
    -- Also revalidate dashboard if visits change
    perform net.http_post(
      url := app_url || '/api/revalidate',
      body := json_build_object('tag', 'dashboard', 'secret', secret_token)::jsonb
    );
  elsif TG_TABLE_NAME = 'badges' then
    tag := 'badges';
  elsif TG_TABLE_NAME = 'visit_purposes' then
    tag := 'purposes';
  else
    tag := 'dashboard'; -- Fallback
  end if;

  -- Call the revalidate API
  perform net.http_post(
    url := app_url || '/api/revalidate',
    body := json_build_object('tag', tag, 'secret', secret_token)::jsonb
  );

  return new;
end;
$$ language plpgsql security definer;

-- Create triggers for relevant tables
-- Visits
drop trigger if exists revalidate_visits_trigger on visits;
create trigger revalidate_visits_trigger
after insert or update or delete on visits
for each row execute function public.revalidate_nextjs_cache();

-- Badges
drop trigger if exists revalidate_badges_trigger on badges;
create trigger revalidate_badges_trigger
after insert or update or delete on badges
for each row execute function public.revalidate_nextjs_cache();

-- Visit Purposes
drop trigger if exists revalidate_purposes_trigger on visit_purposes;
create trigger revalidate_purposes_trigger
after insert or update or delete on visit_purposes
for each row execute function public.revalidate_nextjs_cache();
