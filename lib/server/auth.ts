import "server-only"
import { createClient } from "@supabase/supabase-js"
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from "node:crypto"
import { cookies } from "next/headers"

const NAME = "salary_session"
const key = () => { const secret = process.env.SESSION_SECRET; if (!secret || secret.length < 32) throw new Error("Missing SESSION_SECRET (32+ characters)"); return secret }
export const db = () => {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !secret) throw new Error("Missing server Supabase configuration")
  return createClient(url, secret, { auth: { persistSession:false, autoRefreshToken:false } })
}
type Session = { id:string; stage:"pending"|"verified"; expires:number }
function sign(body:string) { return createHmac("sha256", key()).update(body).digest("hex") }
export async function setSession(id:string, stage:Session["stage"]) {
  const expires=Date.now() + (stage === "pending" ? 5*60_000 : 30*60_000)
  const body=Buffer.from(JSON.stringify({id,stage,expires} satisfies Session)).toString("base64url")
  ;(await cookies()).set(NAME, `${body}.${sign(body)}`, {httpOnly:true, secure:process.env.NODE_ENV === "production", sameSite:"strict", path:"/", maxAge:stage === "pending" ? 300 : 1800})
}
export async function getSession(stage:Session["stage"]) {
  const v=(await cookies()).get(NAME)?.value
  if (!v) return null
  const [body,mac,...extra]=v.split(".")
  if (!body || !mac || extra.length || !/^[a-f0-9]{64}$/.test(mac)) return null
  if (!timingSafeEqual(Buffer.from(sign(body)),Buffer.from(mac))) return null
  try {const s=JSON.parse(Buffer.from(body,"base64url").toString()) as Session
    if (s.stage !== stage || s.expires < Date.now() || typeof s.id !== "string") return null
    return s
  } catch {return null}
}
export async function clearSession(){ (await cookies()).delete(NAME) }
export const hashPin = (pin:string) => {const salt=randomBytes(16).toString("hex");return `scrypt:${salt}:${scryptSync(pin + key(),salt,64).toString("hex")}`}
export const matchesPin = (pin:string,hash:string) => {
  const parts=hash.split(":")
  if(parts.length !== 3 || parts[0]!=="scrypt" || !/^[a-f0-9]{32}$/.test(parts[1]) || !/^[a-f0-9]{128}$/.test(parts[2])) return false
  return timingSafeEqual(scryptSync(pin+key(),parts[1],64),Buffer.from(parts[2],"hex"))
}
export function responseError(message="Invalid request", status=400) {return Response.json({error:message},{status,headers:{"Cache-Control":"no-store"}})}
export const validPin = (v:unknown):v is string => typeof v==="string" && /^\d{4}$/.test(v)
