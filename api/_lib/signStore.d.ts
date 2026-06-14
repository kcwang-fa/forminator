export const MAX_IMAGE_CHARS: number
export const TTL_SECONDS: number

export function validateSession(session: unknown): string | null
export function validateImage(image: unknown): string | null

export function saveSignature(
  session: string,
  image: string,
): Promise<{ configured: boolean; result?: unknown }>

export function takeSignature(
  session: string,
): Promise<{ configured: boolean; result?: unknown }>
