// §11 Optional Supabase cloud persistence — REST/PostgREST via fetch (no SDK dependency).
//
// Enable by setting env vars:
//   SUPABASE_URL=https://<project>.supabase.co
//   SUPABASE_SERVICE_KEY=<service_role key>   (server-only; never ship to the client)
//   SUPABASE_STATE_ID=main                    (optional row id; default "main")
//
// Create the table once (SQL editor):
//   create table if not exists game_state (
//     id text primary key,
//     data jsonb not null,
//     updated_at timestamptz default now()
//   );
//
// When configured, the Database hydrates from this row on boot and upserts on every
// debounced save (in addition to the local file). When unset, everything falls back
// to the file store — no behaviour change.

const URL = process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_KEY;
const ROW_ID = process.env.SUPABASE_STATE_ID || 'main';

export const SupabaseSync = {
  configured(): boolean {
    return !!(URL && KEY);
  },

  async loadSnapshot(): Promise<any | null> {
    if (!this.configured()) return null;
    try {
      const res = await fetch(`${URL}/rest/v1/game_state?id=eq.${encodeURIComponent(ROW_ID)}&select=data`, {
        headers: { apikey: KEY!, Authorization: `Bearer ${KEY}` },
      });
      if (!res.ok) { console.warn(`[supabase] load failed: ${res.status}`); return null; }
      const rows = (await res.json()) as Array<{ data: any }>;
      return Array.isArray(rows) && rows[0] ? rows[0].data : null;
    } catch (e) {
      console.warn('[supabase] load error', e);
      return null;
    }
  },

  async saveSnapshot(snapshot: any): Promise<void> {
    if (!this.configured()) return;
    try {
      await fetch(`${URL}/rest/v1/game_state`, {
        method: 'POST',
        headers: {
          apikey: KEY!,
          Authorization: `Bearer ${KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates', // upsert on the primary key
        },
        body: JSON.stringify({ id: ROW_ID, data: snapshot, updated_at: new Date().toISOString() }),
      });
    } catch (e) {
      console.warn('[supabase] save error', e); // best-effort; file store still holds the data
    }
  },
};
