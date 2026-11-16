import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'
import { driverRecordScope, getRequestUser, unauthorizedResponse } from '@/lib/server-auth'

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getRequestUser(req)
  if (!user) return unauthorizedResponse()

  const { id } = await ctx.params
  const entry = await db.fuelEntry.findFirst({
    where: { id, deletedAt: null, ...driverRecordScope(user) },
    select: { receiptImage: true },
  })
  if (!entry?.receiptImage) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })

  const dataUri = entry.receiptImage.match(/^data:(image\/(?:png|jpeg|webp|gif));base64,([A-Za-z0-9+/=\r\n]+)$/)
  if (dataUri) {
    return new NextResponse(new Uint8Array(Buffer.from(dataUri[2].replace(/\s/g, ''), 'base64')), {
      headers: { 'Content-Type': dataUri[1], 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' },
    })
  }

  if (/^https:\/\//i.test(entry.receiptImage)) {
    return NextResponse.redirect(entry.receiptImage, { headers: { 'Cache-Control': 'private, no-store' } })
  }
  return NextResponse.json({ error: 'Receipt format is not supported' }, { status: 415 })
}
