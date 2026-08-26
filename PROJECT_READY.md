# BuildCore Construction PM - Ready Package

## Main Files

- `START_LOCAL_APP.cmd` - starts the development version.
- `BUILD_PROJECT.cmd` - creates the production build in `dist`.
- `START_PRODUCTION_APP.cmd` - starts the built production preview.
- `supabase/schema.sql` - database, roles, RLS, storage buckets, search.
- `.env` - Supabase URL and publishable key for this local project.

## Current Status

- Production build created successfully.
- Supabase configuration file is present.
- Search architecture supports projects, people, equipment, visits, PDF and Excel indexed text.
- Photo viewer and annotation module are included.
- Main design follows the provided BuildCore schedule reference.

## Run

Double-click:

```text
START_LOCAL_APP.cmd
```

Then open:

```text
http://127.0.0.1:5174
```

## Production Preview

Double-click:

```text
START_PRODUCTION_APP.cmd
```

Then open:

```text
http://127.0.0.1:4174
```
