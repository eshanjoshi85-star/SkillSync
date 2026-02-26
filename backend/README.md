# SkillSync Backend

Node.js + Express + Prisma + PostgreSQL backend for the SkillSync platform.

## Setup

1. Copy `.env.example` to `.env` and fill in your `DATABASE_URL` and `JWT_SECRET`.
2. Run `npm install`
3. Run `npx prisma migrate dev --name init` to create the database tables.
4. Run `npm run dev` to start the development server.

## Environment Variables

```env
DATABASE_URL="postgresql://user:password@localhost:5432/skillsync"
JWT_SECRET="your-super-secret-jwt-key"
CLIENT_URL="http://localhost:5173"
PORT=4000
```

## Project Structure

```
src/
├── index.ts              # Express app entry point
├── lib/
│   └── prisma.ts         # Singleton Prisma client
├── middleware/
│   └── auth.middleware.ts # JWT auth guard
├── routes/
│   ├── auth.routes.ts    # Register, Login
│   ├── user.routes.ts    # Profile, Skills, Token history
│   └── session.routes.ts # Scheduling, Matching, Complete/Cancel
└── services/
    ├── token.service.ts  # Atomic token transfer (Prisma transactions)
    └── matching.service.ts # Skill matching algorithm
```

## Database Migration

```bash
npx prisma migrate dev --name init
```
