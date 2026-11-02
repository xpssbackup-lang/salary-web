import { db, getSession, hashActivation, hashPin, responseError, setSession, validActivation, validPin } from "@/lib/server/auth"
export async function POST(req: Request) {
  try {
    const session = await getSession("pending")
    if (!session) return responseError("Phiên đăng nhập hết hạn", 401)
    const { pin, activationCode } = await req.json()
    if (!validPin(pin)) return responseError("PIN phải có đúng 4 số")
    if (!validActivation(activationCode)) return responseError("Cần mã kích hoạt riêng do quản lý cấp", 403)
    const database = db()
    const { data, error } = await database.rpc("activate_employee_pin", {
      p_id: session.id, p_code_hash: hashActivation(activationCode), p_pin_hash: hashPin(pin)
    })
    if (error) throw error
    if (!data) return responseError("Mã kích hoạt sai, đã sử dụng hoặc tài khoản đã có PIN", 403)
    await setSession(session.id, "verified")
    return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) { console.error("PIN setup error", err); return responseError("Không thể lưu PIN", 500) }
}
