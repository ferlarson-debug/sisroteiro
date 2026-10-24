-- Execute no SQL Editor do Supabase antes de publicar a aplicação.
-- A aplicação acessa PostgreSQL pelo servidor; nenhuma tabela é pública via Data API.
BEGIN;
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  org TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  password TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS public.sessions (
  token TEXT PRIMARY KEY,
  "user" TEXT NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  expires BIGINT NOT NULL
);
CREATE TABLE IF NOT EXISTS public.clients (
  id TEXT PRIMARY KEY,
  org TEXT NOT NULL,
  name TEXT NOT NULL,
  segment TEXT,
  audience TEXT,
  description TEXT
);
CREATE TABLE IF NOT EXISTS public.projects (
  id TEXT PRIMARY KEY,
  org TEXT NOT NULL,
  client TEXT NOT NULL REFERENCES public.clients(id),
  name TEXT NOT NULL,
  objective TEXT,
  duration INTEGER NOT NULL CHECK(duration BETWEEN 5 AND 3600),
  status TEXT NOT NULL,
  scenes TEXT NOT NULL DEFAULT '[]',
  version INTEGER NOT NULL DEFAULT 1 CHECK(version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.versions (
  project TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  scenes TEXT NOT NULL,
  created TEXT NOT NULL,
  PRIMARY KEY(project, version)
);
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key TEXT PRIMARY KEY,
  count INTEGER NOT NULL,
  expires BIGINT NOT NULL
);
CREATE INDEX IF NOT EXISTS clients_org ON public.clients(org);
CREATE INDEX IF NOT EXISTS projects_org ON public.projects(org);
CREATE INDEX IF NOT EXISTS sessions_expires ON public.sessions(expires);
CREATE INDEX IF NOT EXISTS rate_limits_expires ON public.rate_limits(expires);
-- Defesa adicional contra exposição acidental pelas APIs públicas do Supabase.
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.users, public.sessions, public.clients, public.projects, public.versions, public.rate_limits FROM anon, authenticated;
COMMIT;
