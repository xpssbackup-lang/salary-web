import { db, getSession, hashActivation, hashPin, responseError, setSession, validActivation, validPin } from "@/lib/server/auth"
export async function POST(req: Request) {
  try {
    const session = await getSession("pending")
    if (!session) return responseError("Phiên đăng nhập hết hạn", 401)
    const { pin, activationCode } = await req.json()
    if (!validPin(pin)) return responseError("PIN phải có đúng 4 số")
    if (!validActivation(activationCode)) return responseError("Cần mã kích hoạt riêng do quản lý cấp", 403)
    const database = db()

const codeHash = hashActivation(activationCode)

const { data: diagnostic, error: diagnosticError } = await database
  .from("employees")
  .select("id,activation_code_hash")
  .eq("id", session.id)
  .maybeSingle()

console.log("PIN_SETUP_DIAGNOSTIC", {
  accountFound: !!diagnostic,
  hashMatches: diagnostic?.activation_code_hash === codeHash,
  queryError: !!diagnosticError,
})
    const { data, error } = await database.rpc("activate_employee_pin", {
      p_id: session.id, p_code_hash: codeHash, p_pin_hash: hashPin(pin)
    })
    if (error) throw error
    if (!data) return responseError("Mã kích hoạt sai, đã sử dụng hoặc tài khoản đã có PIN", 403)
    await setSession(session.id, "verified")
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) { console.error("PIN setup error", err); return responseError("Không thể lưu PIN", 500) }
}
