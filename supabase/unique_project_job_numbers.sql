-- Enforce unique project job numbers per company.
-- Already applied to the connected Supabase project.

create unique index if not exists projects_company_job_number_unique_idx
  on public.projects (company_id, lower(trim(job_number)))
  where nullif(trim(job_number), '') is not null;
