
import "server-only"

import { createClient } from "@supabase/supabase-js"
import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto"
import { cookies } from "next/headers"

const NAME = "salary_session"

type SessionStage = "pending" | "verified"

type Session = {
  id: string
  stage: SessionStage
  expires: number
  version: number
}

const sessionKey = () => {
  const secret = process.env.SESSION_SECRET

  if (!secret || secret.length < 32) {
    throw new Error("Missing SESSION_SECRET")
  }

  return secret
}

const pinKey = () => {
  const secret = process.env.PIN_HASH_SECRET

  if (!secret || secret.length < 32) {
    throw new Error("Missing PIN_HASH_SECRET")
  }

  return secret
}

export const db = () => {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL

  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!url || !secret) {
    throw new Error("Missing server Supabase configuration")
  }

  return createClient(url, secret, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

function sign(body: string): string {
  return createHmac("sha256", sessionKey())
    .update(body)
    .digest("hex")
}

async function getSessionVersion(
  employeeId: string
): Promise<number | null> {
  const { data, error } = await db()
    .from("employees")
    .select("session_version")
    .eq("id", employeeId)
    .maybeSingle()

  if (error) {
    throw error
  }

  if (
    !data ||
    !Number.isSafeInteger(data.session_version) ||
    data.session_version < 1
  ) {
    return null
  }

  return data.session_version
}

export async function setSession(
  id: string,
  stage: SessionStage
) {
  const version = await getSessionVersion(id)

  if (version === null) {
    throw new Error("Employee session version unavailable")
  }

  const duration =
    stage === "pending" ? 5 * 60_000 : 30 * 60_000

  const expires = Date.now() + duration

  const payload: Session = {
    id,
    stage,
    expires,
    version,
  }

  const body = Buffer.from(
    JSON.stringify(payload)
  ).toString("base64url")

  const token = `${body}.${sign(body)}`

  ;(await cookies()).set(NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(duration / 1000),
  })
}

export async function getSession(
  stage: SessionStage
): Promise<Session | null> {
  const value = (await cookies()).get(NAME)?.value

  if (!value) return null

  const [body, mac, ...extra] = value.split(".")

  if (
    !body ||
    !mac ||
    extra.length > 0 ||
    !/^[A-Za-z0-9_-]+$/.test(body) ||
    !/^[a-f0-9]{64}$/.test(mac)
  ) {
    return null
  }

  const expected = Buffer.from(sign(body), "hex")
  const provided = Buffer.from(mac, "hex")

  if (!timingSafeEqual(expected, provided)) {
    return null
  }

  let session: Session

  try {
    session = JSON.parse(
      Buffer.from(body, "base64url").toString("utf8")
    ) as Session
  } catch {
    return null
  }

  if (
    !session ||
    session.stage !== stage ||
    typeof session.id !== "string" ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(session.id) ||
    !Number.isSafeInteger(session.expires) ||
    session.expires <= Date.now() ||
    !Number.isSafeInteger(session.version) ||
    session.version < 1
  ) {
    return null
  }

  // Check that the employee still has
  // the same session version in Supabase.
  const currentVersion =
    await getSessionVersion(session.id)

  if (
    currentVersion === null ||
    currentVersion !== session.version
  ) {
    return null
  }

  return session
}

export async function clearSession() {
  ;(await cookies()).delete(NAME)
}

const derive = (
  secret: string,
  salt: string,
  value: string
) => scryptSync(value + secret, salt, 64)

export const hashPin = (pin: string) => {
  const salt = randomBytes(16).toString("hex")

  return `scrypt2:${salt}:${derive(
    pinKey(),
    salt,
    pin
  ).toString("hex")}`
}

export const matchesPin = (
  pin: string,
  hash: string
): boolean => {
  const parts = hash.split(":")

  if (
    parts.length !== 3 ||
    !["scrypt", "scrypt2"].includes(parts[0]) ||
    !/^[a-f0-9]{32}$/.test(parts[1]) ||
    !/^[a-f0-9]{128}$/.test(parts[2])
  ) {
    return false
  }

  const secret =
    parts[0] === "scrypt"
      ? sessionKey()
      : pinKey()

  return timingSafeEqual(
    derive(secret, parts[1], pin),
    Buffer.from(parts[2], "hex")
  )
}

export const hashActivation = (
  code: string
): string =>
  createHmac("sha256", pinKey())
    .update(`activate-v1:${code}`)
    .digest("hex")

export const validActivation = (
  value: unknown
): value is string =>
  typeof value === "string" &&
  /^[A-Z2-9-]{16,80}$/.test(value)

export const validPin = (
  value: unknown
): value is string =>
  typeof value === "string" &&
  /^\d{4}$/.test(value)

export function responseError(
  message = "Invalid request",
  status = 400
) {
  return Response.json(
    { error: message },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  )
}
