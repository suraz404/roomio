# Roomio 🏠

A shared-living app to help roommates organize expenses, chores, and everyday essentials in one place.

## About

Roomio is a full-stack web application currently under development. Its goal is to make living with roommates simpler through shared spaces, expense tracking, chore management, and collaborative shopping lists.

## Tech Stack

- **Framework:** Next.js (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Database:** PostgreSQL
- **ORM:** Drizzle ORM
- **Authentication:** better-auth (email/password, cookie sessions)
- **Database Environment:** Docker

## Project Status

🚧 **In Development**

Roomio is being built incrementally, with a focus on clean architecture, secure development practices, database integrity, and a reliable user experience.

### Implemented

- PostgreSQL development database using Docker Compose
- Drizzle ORM and Drizzle Kit configuration
- Initial database schema for users, spaces, and space memberships
- Database migrations
- Foreign key, unique constraint, check constraint, and enum validation
- User registration, login, and logout (better-auth, email/password)
- Cookie-based sessions, with an optimistic route guard in `src/proxy.ts` and real session checks in `requireSession()` / `getApiSession()`
- Space membership check for API routes (`requireSpaceMembership()`)
- Space creation (`POST /api/spaces`): space and creator's admin membership are created in one transaction
- Database schema for expenses, expense splits (amounts stored in paisa), and expense audit logs (no expense API yet)
- Automated tests (Vitest) against a separate `roomio_test` database: space creation, request validation, authentication, and space membership checks

### Planned Features

- Space listing
- Roommate invitations
- Admin-only actions
- Shared expense API and balance calculations
- Chore management
- Shared shopping lists
- A dashboard for household activities

## Getting Started

### Prerequisites

Make sure you have the following installed:

- [Node.js](https://nodejs.org/)
- npm
- [Docker Desktop](https://www.docker.com/products/docker-desktop/)

### 1. Clone the Repository

Clone the repository using your GitHub repository URL:

```bash
git clone <your-repository-url>
cd roomio
```

Replace `<your-repository-url>` with the actual repository URL.

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5440/DATABASE_NAME"
BETTER_AUTH_SECRET="a-long-random-string"
BETTER_AUTH_URL="http://localhost:3000"
```

Replace `USER`, `PASSWORD`, and `DATABASE_NAME` with the credentials configured in your Docker Compose file. Generate `BETTER_AUTH_SECRET` with `openssl rand -base64 32`.

**Security:** Never commit `.env.local` or production credentials to version control.

### 4. Start PostgreSQL

Make sure Docker Desktop is running, then execute:

```bash
docker compose up -d
```

Verify the database container:

```bash
docker ps
```

### 5. Apply Database Migrations

```bash
npx drizzle-kit migrate
```

### 6. Start the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Database

Roomio currently uses PostgreSQL with Drizzle ORM.

The schema includes:

- **Users:** Application user records
- **Spaces:** Shared living spaces created by users
- **Space Memberships:** Associates users with spaces and stores membership roles (`admin` or `member`)
- **Auth tables:** `session`, `account`, `verification` (managed by better-auth, in `src/db/auth-schema.ts`)
- **Expenses:** Shared expenses with amount in paisa, payer, and soft deletion
- **Expense Splits:** Each user's share of an expense (unique per expense and user)
- **Expense Audit Logs:** Records of create/update/delete/restore actions on expenses

The schema is defined in `src/db/schema.ts`, and database connection setup is maintained in `src/db/client.ts`.

Migration files are generated and managed using Drizzle Kit.

Space creation and the creator's admin membership run in a single database transaction (`createSpace()` in `src/lib/spaces.ts`), so both succeed or fail together.

## Testing

Tests use [Vitest](https://vitest.dev/) and run against a real PostgreSQL database, so constraints, transactions, and auth behave exactly as in development.

### Run the tests

Make sure the Docker database is running, then:

```bash
npm test            # run all tests once
npm run test:watch  # re-run on every file save
```

No extra setup is needed. Before the tests start, `tests/global-setup.ts` creates the `roomio_test` database (if it does not exist) in the same Docker container and applies all migrations from `drizzle/`.

### How it works

- **Separate database:** tests use `roomio_test`, never the development `roomio` database. The URL is set in `tests/env.ts` and can be overridden with `TEST_DATABASE_URL`.
- **Safety guard:** `assertTestDatabase()` refuses to run if the database name does not end with `_test`. It runs both before migrations and before every reset.
- **Clean state:** every test starts with empty tables (`resetDb()` in `tests/setup.ts`, run by `beforeEach`).
- **Real sessions:** API tests sign up a real user through better-auth (`signUpAndGetCookie()`) and send the session cookie with the request.
- **Sequential files:** test files run one at a time because they share one database.

### Layout

```text
tests/
  env.ts               test database URL, test env vars, safety guard
  global-setup.ts      creates and migrates roomio_test (runs once)
  setup.ts             resets the database before each test
  helpers/
    db.ts              resetDb(), createTestUser()
    auth.ts            signUpAndGetCookie()
  api/                 route handler tests (e.g. POST /api/spaces)
  lib/                 tests for src/lib functions
```

When you add a new table, also add it to the `TRUNCATE` list in `tests/helpers/db.ts`.

## API

### `POST /api/spaces`

Creates a space; the logged-in user becomes its admin. Requires a session cookie.

Request body: `{ "name": "Flat 4B" }` (trimmed, 1-60 characters). The creator always comes from the session; any `createdBy` in the body is ignored.

| Status | Meaning                                                                     |
| ------ | --------------------------------------------------------------------------- |
| `201`  | `{ "space": { id, name, createdBy, createdAt } }`                           |
| `400`  | Invalid JSON, or `name` missing / not a string / empty / over 60 characters |
| `401`  | Not logged in                                                               |

All `/api/spaces` routes require a session cookie (`401` without one). For any
route with `[spaceId]`, a user who is not a member gets `403`, and so does a
space id that does not exist or is not a valid UUID, so the response never
reveals whether a space exists.

### `GET /api/spaces`

Lists the spaces the logged-in user belongs to, newest first.

`200`: `{ "spaces": [{ id, name, role, createdAt }] }` (empty array if none)

### `GET /api/spaces/[spaceId]`

Members only.

`200`: `{ "space": { id, name, createdAt, myRole, members: [{ userId, name, role }] } }`. Members are sorted by name; emails are not included.

### `PATCH /api/spaces/[spaceId]`

Admins only. Renames the space. Body: `{ "name": "Sunshine Flat" }` (same rules as `POST`).
Access is checked before the body, so a non-admin always gets `403`.

| Status | Meaning                                                 |
| ------ | ------------------------------------------------------- |
| `200`  | `{ "space": { id, name, createdAt } }`                  |
| `400`  | Invalid JSON or invalid `name`                          |
| `403`  | Not a member, not an admin, or invalid/unknown space id |

### Access rules

| Route                         | Login | Member          | Admin |
| ----------------------------- | ----- | --------------- | ----- |
| `POST /api/spaces`            | ✅    |                 |       |
| `GET /api/spaces`             | ✅    | own spaces only |       |
| `GET /api/spaces/[spaceId]`   | ✅    | ✅              |       |
| `PATCH /api/spaces/[spaceId]` | ✅    | ✅              | ✅    |

## Development Principles

- Build incrementally and verify each feature with tests.
- Enforce data integrity using database constraints.
- Keep secrets and environment-specific configuration out of source control.
- Use transactions when related database operations must succeed or fail together.
- Keep documentation aligned with the implemented code.
- Build incrementally; a feature is done when its success and failure cases have automated tests.

## License

No open-source license has been selected yet.
