'use client'

import { Button } from '@/components/ui/button'

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div role="alert" className="p-8 text-center">
      <p className="text-sm text-destructive">{message}</p>
      <Button className="mt-3" variant="outline" onClick={onRetry}>Try again</Button>
    </div>
  )
}
