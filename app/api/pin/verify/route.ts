import { db, getSession, hashPin, matchesPin, responseError, setSession, validPin } from "@/lib/server/auth"
export async function POST(req: Request) {
  try {
    const session = await getSession("pending")
    if (!session) return responseError("Phiên đăng nhập hết hạn", 401)
    const { pin } = await req.json()
    if (!validPin(pin)) return responseError("PIN phải có đúng 4 số")
    const database = db()
    const { data, error } = await database.from("employees")
      .select("security_pin,security_pin_hash").eq("id", session.id).single()
    if (error || !data) return responseError("Không tìm thấy tài khoản", 401)
    const old = String(data.security_pin ?? "").trim()
    const valid = data.security_pin_hash ? matchesPin(pin, data.security_pin_hash) : old.length === 4 && old === pin
    // Atomic check-and-increment in Postgres; resistant to parallel requests and re-login.
    const { data: result, error: rateError } = await database.rpc("record_pin_verification", { p_id: session.id, p_valid: valid })
    if (rateError) throw rateError
    if (result === "locked") return responseError("PIN đã bị khóa 15 phút sau 5 lần sai", 429)
    if (result !== "ok") return responseError("Mã PIN không đúng", 401)
    if (data.security_pin_hash?.startsWith("scrypt:") || !data.security_pin_hash) {
      const newHash = hashPin(pin)
      let query = database.from("employees").update({ security_pin_hash: newHash }).eq("id", session.id)
      query = data.security_pin_hash ? query.eq("security_pin_hash", data.security_pin_hash) : query.is("security_pin_hash", null)
      const { error: migrateError } = await query
      if (migrateError) throw migrateError
    }
    await setSession(session.id, "verified")
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) { console.error("PIN verify error", err); return responseError("Không thể xác minh PIN", 500) }
}
