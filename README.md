# Task Manager API

Backend API for the Task Management application. It uses Node.js, Express 5, Prisma 7, and PostgreSQL.

## Requirements

- Node.js 24 or newer
- PostgreSQL

## Local setup

1. Install dependencies:

   ```sh
   npm ci
   ```

2. Create a PostgreSQL database and copy `.env.example` to `.env`. Set `DATABASE_URL` and replace both JWT secrets with independent random values. Do not commit `.env`.
3. Generate Prisma Client and apply migrations:

   ```sh
   npm run db:generate
   npm run db:migrate
   ```

4. Start the API:

   ```sh
   npm run dev
   ```

The API listens on `http://localhost:3000` by default. Interactive REST documentation is available at `/api-docs` (also `/api/docs`). Set `API_URL` when the documented server URL differs.

The frontend is in the sibling `task-manager-client` project. Copy its `.env.example` to `.env` and set `VITE_API_URL` and `VITE_SOCKET_URL` if the backend is not running on the local defaults.

## Tests

```sh
npm test
```

Tests create and delete fixed test records. Run them only against a dedicated test database, never a development or production database. The CI workflow provisions an isolated PostgreSQL database and applies migrations before running tests.

Projects created before `ownerId` was introduced may not have an owner. An administrator should review these legacy records and add the intended members through the project API before regular users rely on them.

## Database changes

Prisma models are defined in `prisma/schema.prisma`; committed SQL migrations are under `prisma/migrations`. Review a migration before applying it to any database. `npm run db:migrate` applies pending migrations and should not be run against production without a backup and deployment plan.

The historical file-metadata migration changes the shape of the `File` table, and earlier migrations add required timestamp columns. If those migrations are still pending on a database with existing records, review their data impact and take a backup before applying them.

## Current deployment status

No hosting environment or production deployment is configured or verified in this repository. Local uploads use the filesystem; production deployment requires persistent object storage or a persistent volume.
