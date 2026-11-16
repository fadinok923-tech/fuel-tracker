import { spawnSync } from 'node:child_process'
import { join } from 'node:path'

function run(binary, args, env = process.env) {
  const executable = join(
    process.cwd(),
    'node_modules',
    '.bin',
    process.platform === 'win32' ? `${binary}.cmd` : binary,
  )
  const result = spawnSync(executable, args, {
    env,
    stdio: 'inherit',
    shell: process.platform === 'win32',
  })

  if (result.error) throw result.error
  if (result.status !== 0) process.exit(result.status ?? 1)
}

run('prisma', ['generate'])

// Apply schema changes only to production. Preview deployments must not run
// migrations against the production database.
if (process.env.VERCEL_ENV === 'production') {
  const migrationUrl = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL
  if (!migrationUrl) {
    throw new Error('Set DATABASE_URL_UNPOOLED or DATABASE_URL for production migrations.')
  }

  const databaseIdentity = (connectionString) => {
    const url = new URL(connectionString)
    const hostname = url.hostname.replace(/-pooler(?=\.c-\d+\.)/, '')
    return `${hostname}${url.pathname}`
  }
  if (process.env.DATABASE_URL && databaseIdentity(process.env.DATABASE_URL) !== databaseIdentity(migrationUrl)) {
    throw new Error('DATABASE_URL and DATABASE_URL_UNPOOLED must point to the same Neon database branch.')
  }

  const migrationEnv = { ...process.env, DATABASE_URL: migrationUrl }

  // This Neon database already contains the app schema. Prisma Migrate needs
  // the initial migration recorded as applied before it can manage future changes.
  const { PrismaClient } = await import('@prisma/client')
  const prisma = new PrismaClient({ datasourceUrl: migrationUrl })
  try {
    const [{ tableCount }] = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS "tableCount"
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name <> '_prisma_migrations'
    `
    const migrationTable = await prisma.$queryRaw`
      SELECT COUNT(*)::int AS "count"
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
        AND table_name = '_prisma_migrations'
    `

    if (Number(tableCount) > 0) {
      const secureAdmin = await prisma.$queryRaw`
        SELECT "id"
        FROM public."User"
        WHERE "role" = 'ADMIN' AND "active" = TRUE AND "deletedAt" IS NULL
          AND "password" LIKE 'scrypt$%'
        LIMIT 1
      `
      if (secureAdmin.length === 0) {
        throw new Error('Set a strong password for at least one active administrator in the current app before deploying the credential security migration.')
      }
    }

    if (Number(tableCount) > 0 && Number(migrationTable[0].count) > 0) {
      const migrations = await prisma.$queryRaw`
        SELECT migration_name AS name
        FROM public._prisma_migrations
      `
      if (!migrations.some((migration) => migration.name === '20261109130000_init')) {
        if (migrations.length === 0) {
          run('prisma', ['migrate', 'resolve', '--applied', '20261109130000_init'], migrationEnv)
        } else {
          throw new Error('The database has a different migration history; stopping before schema changes.')
        }
      }
    } else if (Number(tableCount) > 0) {
      run('prisma', ['migrate', 'resolve', '--applied', '20261109130000_init'], migrationEnv)
    }
  } finally {
    await prisma.$disconnect()
  }

  run('prisma', ['migrate', 'deploy'], migrationEnv)
  // Backfill usernames and driver-account links without creating shared demo logins.
  process.env.DATABASE_URL = migrationUrl
  await import('./seed-demo-users.mjs')
}

run('next', ['build'])
