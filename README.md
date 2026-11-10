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

## API

### `POST /api/spaces`

Creates a space; the logged-in user becomes its admin. Requires a session cookie.

Request body: `{ "name": "Flat 4B" }` (trimmed, 1-60 characters). The creator always comes from the session; any `createdBy` in the body is ignored.

| Status | Meaning |
|---|---|
| `201` | `{ "space": { id, name, createdBy, createdAt } }` |
| `400` | Invalid JSON, or `name` missing / not a string / empty / over 60 characters |
| `401` | Not logged in |

## Development Principles

- Build incrementally and verify each feature with tests.
- Enforce data integrity using database constraints.
- Keep secrets and environment-specific configuration out of source control.
- Use transactions when related database operations must succeed or fail together.
- Keep documentation aligned with the implemented code.

## License

No open-source license has been selected yet.
