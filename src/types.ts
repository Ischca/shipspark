export type Bindings = {
  DB: D1Database;
  X_BEARER_TOKEN?: string;
  X_SEARCH_QUERY?: string;
  INTERNAL_INGEST_TOKEN?: string;
  SESSION_SECRET?: string;
};

export type HonoEnv = {
  Bindings: Bindings;
};
