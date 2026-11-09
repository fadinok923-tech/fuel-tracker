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
  run('prisma', ['migrate', 'deploy'], {
    ...process.env,
    DATABASE_URL: migrationUrl,
  })
}

run('next', ['build'])

