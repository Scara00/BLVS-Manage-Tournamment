import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const SUPABASE_DIR = path.resolve(process.cwd(), "supabase");

/**
 * The slice of a Supabase database the migrations rely on: the `extensions`
 * schema, the API roles, `auth.users` / `auth.identities` and `auth.uid()`,
 * which reads the JWT `sub` exactly like PostgREST sets it.
 */
const SUPABASE_STUB = `
  create schema extensions;
  create extension pgcrypto with schema extensions;
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  grant usage on schema extensions to anon, authenticated, service_role;
  create table auth.users (
    instance_id uuid,
    id uuid primary key,
    aud text,
    role text,
    email text,
    encrypted_password text,
    email_confirmed_at timestamptz,
    raw_app_meta_data jsonb,
    raw_user_meta_data jsonb,
    created_at timestamptz,
    updated_at timestamptz,
    confirmation_token text,
    email_change text,
    email_change_token_new text,
    recovery_token text
  );
  create table auth.identities (
    id uuid primary key,
    user_id uuid not null references auth.users (id) on delete cascade,
    provider_id text not null,
    provider text not null,
    identity_data jsonb not null,
    last_sign_in_at timestamptz,
    created_at timestamptz,
    updated_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
`;

function migrationFiles(): string[] {
  const dir = path.join(SUPABASE_DIR, "migrations");
  return readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort()
    .map((file) => path.join(dir, file));
}

/** A fresh in-memory Postgres with every migration (and optionally the seed). */
export async function createTestDatabase({ seed = false } = {}) {
  const db = new PGlite({ extensions: { citext, pgcrypto } });
  await db.exec(SUPABASE_STUB);
  await db.exec("set search_path = public, extensions");
  for (const file of migrationFiles()) {
    await db.exec(readFileSync(file, "utf8"));
  }
  if (seed)
    await db.exec(readFileSync(path.join(SUPABASE_DIR, "seed.sql"), "utf8"));
  return db;
}

export type TestDatabase = Awaited<ReturnType<typeof createTestDatabase>>;

/** Runs `fn` as an API role (like PostgREST), with an optional JWT `sub`. */
export async function asRole<T>(
  db: TestDatabase,
  role: "anon" | "authenticated",
  sub: string | null,
  fn: () => Promise<T>,
): Promise<T> {
  await db.exec(
    `set request.jwt.claim.sub = '${sub ?? ""}'; set role ${role};`,
  );
  try {
    return await fn();
  } finally {
    await db.exec("reset role; set request.jwt.claim.sub = '';");
  }
}

/** Creates an auth user; the trigger turns it into a `public.utenti` row. */
export async function createAuthUser(
  db: TestDatabase,
  {
    id = crypto.randomUUID(),
    email,
    categoria = "M",
    meta = {},
  }: {
    id?: string;
    email: string;
    categoria?: "M" | "F" | null;
    meta?: Record<string, unknown>;
  },
) {
  await db.query(
    "insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)",
    [id, email, JSON.stringify({ categoria, ...meta })],
  );
  return id;
}
