# Supabase: Faberland Port

* `migrations/20261105000000_vitruvian_avatar_packages.sql`: table, RLS, latest-avatar view, purge function
* `functions/vitruvian-port/index.ts`: Edge Function (claim codes, owned uploads, delete)

Copy both into the Faberland Supabase project (`supabase/migrations`, `supabase/functions`), then:

```bash
supabase db push
```

```bash
supabase functions deploy vitruvian-port
```

Full guide: [`docs/PORT.md`](../../docs/PORT.md).
