
import {
  db,
  getSession,
  hashPin,
  matchesPin,
  responseError,
  setSession,
  validPin,
} from "@/lib/server/auth"

export async function POST(req: Request) {
  try {
    const session = await getSession("pending")

    if (!session) {
      return responseError(
        "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
        401
      )
    }

    const body = await req.json()
    const pin = body?.pin

    if (!validPin(pin)) {
      return responseError(
        "PIN phải có đúng 4 số",
        400
      )
    }

    const database = db()

    const { data, error } = await database
      .from("employees")
      .select(
        "security_pin,security_pin_hash,session_version"
      )
      .eq("id", session.id)
      .single()

    if (error || !data) {
      return responseError(
        "Không tìm thấy tài khoản",
        401
      )
    }

    if (data.session_version !== session.version) {
      return responseError(
        "Phiên bảo mật đã thay đổi. Vui lòng đăng nhập lại.",
        401
      )
    }

    const oldPin = data.security_pin ?? null
    const storedHash = data.security_pin_hash ?? null

    const legacyPin = String(oldPin ?? "").trim()

    const valid = storedHash
      ? matchesPin(pin, storedHash)
      : legacyPin.length === 4 &&
        legacyPin === pin

    const { data: result, error: rpcError } =
      await database.rpc(
        "record_pin_verification_v2",
        {
          p_id: session.id,
          p_valid: valid,
          p_expected_version: session.version,
          p_expected_hash: storedHash,
          p_expected_old_pin: oldPin,
        }
      )

    if (rpcError) {
      throw rpcError
    }

    if (result === "locked") {
      return responseError(
        "PIN đã bị khóa 15 phút sau 5 lần sai",
        429
      )
    }

    if (result === "stale") {
      return responseError(
        "PIN hoặc phiên đăng nhập đã thay đổi. Vui lòng đăng nhập lại.",
        401
      )
    }

    if (result !== "ok") {
      return responseError(
        "Mã PIN không đúng",
        401
      )
    }

    // Upgrade legacy PIN hashes only after
    // successful verification.
    if (
      storedHash?.startsWith("scrypt:") ||
      !storedHash
    ) {
      const newHash = hashPin(pin)

      let query = database
        .from("employees")
        .update({
          security_pin_hash: newHash,
          security_pin: null,
        })
        .eq("id", session.id)
        .eq("session_version", session.version)

      query = storedHash
        ? query.eq("security_pin_hash", storedHash)
        : query.is("security_pin_hash", null)

      query = oldPin === null
        ? query.is("security_pin", null)
        : query.eq("security_pin", oldPin)

      const { data: updated, error: migrateError } =
        await query.select("id")

      if (migrateError) {
        throw migrateError
      }

      if (!updated || updated.length !== 1) {
        return responseError(
          "PIN đã thay đổi. Vui lòng đăng nhập lại.",
          401
        )
      }
    }

    // Important: use the version that was verified.
    await setSession(
      session.id,
      "verified",
      session.version
    )

    return Response.json(
      { ok: true },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (err) {
    console.error(
      "PIN verify error",
      err instanceof Error ? err.message : "Unknown error"
    )

    return responseError(
      "Không thể xác minh PIN",
      500
    )
  }
}
