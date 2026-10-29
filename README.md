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
- **Database Environment:** Docker

## Project Status

🚧 **In Development**

Roomio is being built incrementally, with a focus on clean architecture, secure development practices, database integrity, and a reliable user experience.

### Implemented

- Initial PostgreSQL database setup using Docker Compose
- Drizzle ORM and Drizzle Kit configuration
- Initial database schema for users, spaces, and space memberships
- Database migrations
- Foreign key, unique constraint, and enum validation
- Database connection test from the application

### Planned Features

- Shared spaces and roommate invitations
- Automatic admin membership for the user who creates a space
- Shared expense tracking and balance calculations
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

```bash
git clone <your-repository-url>
cd roomio
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Environment Variables

Create a `.env.local` file in the project root.

Add your local PostgreSQL connection string:

```env
DATABASE_URL="postgresql://USER:PASSWORD@localhost:5440/DATABASE_NAME"
```

Replace `USER`, `PASSWORD`, and `DATABASE_NAME` with the credentials configured in your local PostgreSQL Docker container.

**Security:** Never commit `.env.local` or real production credentials to version control.

### 4. Start PostgreSQL

Make sure Docker Desktop is running, then execute:

```bash
docker compose up -d
```

Verify that the database container is running:

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

The initial schema includes:

- **Users:** Application user records
- **Spaces:** Shared living spaces created by users
- **Space Memberships:** Associates users with spaces and stores their membership roles

Database schema definitions are maintained in `src/db/schema.ts`, and database connection setup is maintained in `src/db/client.ts`.

Migration files are generated and managed using Drizzle Kit.

## Development Principles

- Build incrementally and verify each feature with tests.
- Enforce data integrity using database constraints.
- Keep secrets and environment-specific configuration out of source control.
- Use transactions when related database operations must succeed or fail together.
- Keep documentation aligned with the implemented code.

## License

No open-source license has been selected yet.
