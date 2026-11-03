
import {
  db,
  getSession,
  hashActivation,
  hashPin,
  responseError,
  setSession,
  validActivation,
  validPin,
} from "@/lib/server/auth"

import { createHmac, timingSafeEqual } from "node:crypto"

export async function POST(req: Request) {
  try {
    const session = await getSession("pending")

    if (!session) {
      return responseError("Phiên đăng nhập hết hạn", 401)
    }

    const { pin, activationCode } = await req.json()

    if (!validPin(pin)) {
      return responseError("PIN phải có đúng 4 số", 400)
    }

    if (!validActivation(activationCode)) {
      return responseError(
        "Cần mã kích hoạt riêng do quản lý cấp",
        403
      )
    }

    const database = db()

    // Calculate activation hash
    const codeHash = hashActivation(activationCode)

    // Read-only diagnostic for Preview
    const { data: diagnostic, error: diagnosticError } =
      await database
        .from("employees")
        .select("id,activation_code_hash")
        .eq("id", session.id)
        .maybeSingle()

    const storedHash = diagnostic?.activation_code_hash

    const hashMatches =
      typeof storedHash === "string" &&
      /^[a-f0-9]{64}$/i.test(storedHash) &&
      timingSafeEqual(
        Buffer.from(storedHash, "hex"),
        Buffer.from(codeHash, "hex")
      )

    console.log("PIN_SETUP_DIAGNOSTIC", {
      accountFound: !!diagnostic,
      hashMatches,
      queryError: !!diagnosticError,
    })

    // Fixed-message HMAC check for comparing environments
    // Never log the secret or actual activation code.
    const secret = process.env.PIN_HASH_SECRET

    if (!secret || secret.length < 32) {
      throw new Error("Missing PIN_HASH_SECRET")
    }

    const keyCheck = createHmac("sha256", secret)
      .update("salary-test-key-check-v1")
      .digest("hex")

    console.log("PIN_KEY_CHECK", keyCheck)

    // Activate PIN atomically in Supabase
    const { data, error } = await database.rpc(
      "activate_employee_pin",
      {
        p_id: session.id,
        p_code_hash: codeHash,
        p_pin_hash: hashPin(pin),
      }
    )

    if (error) {
      throw error
    }

    if (!data) {
      return responseError(
        "Mã kích hoạt sai, đã sử dụng hoặc tài khoản đã có PIN",
        403
      )
    }

    await setSession(session.id, "verified")

    return Response.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (err) {
    console.error("PIN setup error", err)

    return responseError("Không thể lưu PIN", 500)
  }
}
