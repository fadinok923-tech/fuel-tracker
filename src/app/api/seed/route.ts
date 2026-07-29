import { NextRequest, NextResponse } from 'next/server'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

// POST /api/seed - re-run seed
export async function POST() {
  try {
    const { stdout, stderr } = await execAsync('cd /home/z/my-project && bun run scripts/seed.ts 2>&1 | tail -5')
    return NextResponse.json({ ok: true, output: stdout, error: stderr })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e.message }, { status: 500 })
  }
}
