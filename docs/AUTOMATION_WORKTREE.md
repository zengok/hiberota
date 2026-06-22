# Automation Worktree Architecture

HibeRota keeps the web app and automation worker in the same Git repository but runs them as separate processes.

```text
Web App
   |
Call Repository
   |
Shared Database
   |
Automation Worker
   |
Scrapers
```

## Worktree Layout

Recommended local layout:

```text
hiberota/              main branch checkout
hiberota-automation/   feature/automation-core worktree
```

Use `feature/automation-core` for automation changes. Do not commit automation work directly on `main`.

## Shared Data

When running more than one worktree, use an absolute shared data path for both the web app and worker:

```env
HIBEROTA_SHARED_DATA_DIR=/absolute/path/to/shared/hiberota-data
DATABASE_PATH=/absolute/path/to/shared/hiberota-data/database.sqlite
DATABASE_BACKUP_DIR=/absolute/path/to/shared/hiberota-data/backups
AUTOMATION_STATE_PATH=/absolute/path/to/shared/hiberota-data/automation-state.json
```

Relative paths such as `.hiberota/database.sqlite` are safe for a single checkout, but two worktrees would create two different SQLite files unless the path is made shared and absolute.

## Process Split

- `npm start` runs the web app and reads published calls from the shared repository/database.
- `npm run worker` runs scraper discovery, normalization, deduplication, health checks, and persistence.
- `POST /api/calls/refresh` queues automation refresh work; scraper execution belongs to the worker process.

The compatibility facade `server/automation.mjs` remains in place for existing imports and re-exports the modular automation entry point.

## Docker

`docker-compose.yml` defines separate `app` and `worker` services. Both mount the same `hiberota-data` volume and use `/app/.hiberota/database.sqlite`, which keeps web reads and worker writes pointed at the same SQLite database.

SQLite is acceptable for development and low-traffic single-instance deployments. For multiple high-write workers or horizontally scaled app instances, evaluate a PostgreSQL repository adapter before increasing concurrency.
