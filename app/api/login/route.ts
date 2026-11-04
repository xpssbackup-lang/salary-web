
import {
  db,
  clearSession,
  responseError,
  setSession,
} from "@/lib/server/auth"

import {
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto"

const HASH_PREFIX = "scrypt-pw-v1"

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")
  const hash = scryptSync(password, salt, 64).toString("hex")
  return `${HASH_PREFIX}:${salt}:${hash}`
}

function verifyPassword(
  password: string,
  storedHash: string
): boolean {
  const parts = storedHash.split(":")

  if (
    parts.length !== 3 ||
    parts[0] !== HASH_PREFIX ||
    !/^[a-f0-9]{32}$/.test(parts[1]) ||
    !/^[a-f0-9]{128}$/.test(parts[2])
  ) {
    return false
  }

  const calculated = scryptSync(password, parts[1], 64)
  const expected = Buffer.from(parts[2], "hex")

  return timingSafeEqual(calculated, expected)
}

function verifyLegacyPassword(
  entered: string,
  stored: string
): boolean {
  const actual = Buffer.from(stored.trim())
  const input = Buffer.from(entered.trim())

  return (
    actual.length > 0 &&
    actual.length === input.length &&
    timingSafeEqual(actual, input)
  )
}

export async function POST(req: Request) {
  try {
    await clearSession()

    const body = await req.json()
    const employeeCode = body?.employeeCode
    const password = body?.password

    if (
      typeof employeeCode !== "string" ||
      typeof password !== "string" ||
      !employeeCode.trim() ||
      !password.trim() ||
      employeeCode.length > 100 ||
      password.length > 256
    ) {
      return responseError("Thông tin đăng nhập không hợp lệ", 400)
    }

    const code = employeeCode.trim()
    const enteredPassword = password.trim()
    const database = db()

    const { data, error } = await database
      .from("employees")
      .select(
        "id,password,password_hash,security_pin,security_pin_hash,session_version"
      )
      .eq("employee_code", code)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return responseError("Sai tài khoản hoặc mật khẩu", 401)
    }

    const storedHash = data.password_hash
    const legacy = String(data.password ?? "")

    const valid = storedHash
      ? verifyPassword(enteredPassword, storedHash)
      : verifyLegacyPassword(enteredPassword, legacy)

    // Atomic password attempt counter and lock check.
    const { data: result, error: rateError } =
      await database.rpc("record_password_verification", {
        p_id: data.id,
        p_valid: valid,
      })

    if (rateError) throw rateError

    if (result === "locked") {
      return responseError(
        "Đăng nhập tạm khóa 15 phút. Vui lòng thử lại sau.",
        429
      )
    }

    if (result !== "ok") {
      return responseError(
        "Sai tài khoản hoặc mật khẩu",
        401
      )
    }

    // Migrate legacy TESTPIN passwords only.
    if (!storedHash && /^TESTPIN[0-9]{3}$/.test(code)) {
      const newHash = hashPassword(enteredPassword)

      const { data: migrated, error: migrationError } =
        await database.rpc("migrate_test_password", {
          p_id: data.id,
          p_old_password: legacy,
          p_new_hash: newHash,
        })

      if (migrationError) throw migrationError

      if (migrated !== true) {
        return responseError(
          "Tài khoản vừa thay đổi bảo mật. Vui lòng đăng nhập lại.",
          409
        )
      }

      // Migration increments session_version.
      await setSession(data.id, "pending")
    } else {
      // Reject a session if its version changed
      // after the initial account lookup.
      await setSession(
        data.id,
        "pending",
        data.session_version
      )
    }

    const hasPin = Boolean(
      data.security_pin_hash ||
      String(data.security_pin ?? "").trim()
    )

    return Response.json(
      { hasPin },
      { headers: { "Cache-Control": "no-store" } }
    )
  } catch (err) {
    console.error(
      "Login error",
      err instanceof Error ? err.message : "Unknown error"
    )

    return responseError(
      "Lỗi đăng nhập hoặc cấu hình máy chủ",
      500
    )
  }
}
