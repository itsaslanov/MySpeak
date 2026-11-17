# Simple Demo — Next.js + Prisma + PostgreSQL

Minimal fullstack app to understand the structure.

## Structure

```
simple-demo/
├── .env                  # DATABASE_URL
├── next.config.ts
├── package.json
├── tsconfig.json
├── next-env.d.ts
├── .gitignore
├── README.md
├── prisma/
│   └── schema.prisma     # DB schema + models
├── lib/
│   └── prisma.ts         # PrismaClient singleton
└── app/
    ├── layout.tsx        # Root layout
    ├── page.tsx          # Server component → initial data via Prisma
    ├── item-list.tsx     # Client component → fetch API routes
    ├── globals.css
    └── api/
        ├── items/
        │   └── route.ts  # GET, POST
        └── [id]/
            └── route.ts  # PATCH, DELETE
```

## Data flow

```
Client (item-list.tsx) → fetch("/api/items") → API route → Prisma → PostgreSQL
Server component (page.tsx) → prisma.item.findMany() → renders client
```

## Where things go (the pattern to reuse)

1. **DB schema** → `prisma/schema.prisma` → run `npx prisma db push` / `npx prisma migrate dev --name init`
2. **Prisma client** → `lib/prisma.ts` → import `{ prisma }` wherever you need DB access
3. **Server-side data access** → in `app/` (server components, server actions, or API routes)
4. **Frontend** → client components in `app/` that fetch your own API routes

## Run it

```bash
npm install
npx prisma db push        # create tables from schema
npm run dev                # start Next.js
```

Open http://localhost:3000
