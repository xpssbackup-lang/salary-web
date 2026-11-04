
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

// ========================================
// SECURITY V2 - LOGIN
// ========================================

const HASH_PREFIX = "scrypt-pw-v1"

const TEST_SUPABASE_HOST =
  "zaqcfhzdqelucbrtebfc.supabase.co"

const PRODUCTION_SUPABASE_HOST =
  "dhhdmkpjatohqdedbmbd.supabase.co"

const INVALID_CREDENTIALS =
  "Sai tài khoản hoặc mật khẩu"

// ========================================
// ENVIRONMENT VALIDATION
// ========================================

function getDatabaseHost(): string | null {
  const url =
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL

  if (!url) return null

  try {
    const parsed = new URL(url)

    if (
      parsed.protocol !== "https:" ||
      (parsed.pathname !== "/" &&
        parsed.pathname !== "")
    ) {
      return null
    }

    return parsed.hostname
  } catch {
    return null
  }
}

function getLoginEnvironment():
  | "test"
  | "production"
  | null {
  const host = getDatabaseHost()
  const env = process.env.VERCEL_ENV

  if (
    env === "preview" &&
    host === TEST_SUPABASE_HOST
  ) {
    return "test"
  }

  if (
    env === "production" &&
    host === PRODUCTION_SUPABASE_HOST
  ) {
    return "production"
  }

  return null
}

// ========================================
// PASSWORD HASH
// ========================================

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex")

  const hash = scryptSync(
    password,
    salt,
    64
  ).toString("hex")

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

  const calculated = scryptSync(
    password,
    parts[1],
    64
  )

  const expected = Buffer.from(
    parts[2],
    "hex"
  )

  return timingSafeEqual(
    calculated,
    expected
  )
}

// ========================================
// LEGACY PASSWORD VERIFICATION
// ========================================

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

// ========================================
// LOGIN API
// ========================================

export async function POST(req: Request) {
  try {
    // Clear previous authentication session.
    await clearSession()

    // Verify deployment/database pairing.
    const environment = getLoginEnvironment()

    if (!environment) {
      return responseError(
        "Môi trường đăng nhập không hợp lệ.",
        503
      )
    }

    // Validate request.
    let body: unknown

    try {
      body = await req.json()
    } catch {
      return responseError(
        "Thông tin đăng nhập không hợp lệ.",
        400
      )
    }

    if (
      !body ||
      typeof body !== "object"
    ) {
      return responseError(
        "Thông tin đăng nhập không hợp lệ.",
        400
      )
    }

    const input = body as Record<string, unknown>

    const employeeCode = input.employeeCode
    const password = input.password

    if (
      typeof employeeCode !== "string" ||
      typeof password !== "string" ||
      !employeeCode.trim() ||
      !password.trim() ||
      employeeCode.length > 100 ||
      password.length > 256
    ) {
      return responseError(
        "Thông tin đăng nhập không hợp lệ.",
        400
      )
    }

    const code = employeeCode.trim()
    const enteredPassword = password.trim()

    const database = db()

    // ====================================
    // LOAD EMPLOYEE
    // ====================================

    const { data, error } = await database
      .from("employees")
      .select(
        "id,employee_code,password,password_hash,security_pin,security_pin_hash,session_version"
      )
      .eq("employee_code", code)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return responseError(
        INVALID_CREDENTIALS,
        401
      )
    }

    // ====================================
    // VERIFY PASSWORD
    // ====================================

    const storedHash =
      typeof data.password_hash === "string"
        ? data.password_hash
        : null

    const legacy =
      typeof data.password === "string"
        ? data.password
        : ""

    const valid = storedHash
      ? verifyPassword(
          enteredPassword,
          storedHash
        )
      : verifyLegacyPassword(
          enteredPassword,
          legacy
        )

    // ====================================
    // RECORD FAILED ATTEMPTS / LOCKOUT
    // ====================================

    const {
      data: verificationResult,
      error: verificationError,
    } = await database.rpc(
      "record_password_verification",
      {
        p_id: data.id,
        p_valid: valid,
      }
    )

    if (verificationError) {
      throw verificationError
    }

    if (verificationResult === "locked") {
      return responseError(
        "Đăng nhập tạm khóa 15 phút. Vui lòng thử lại sau.",
        429
      )
    }

    if (verificationResult !== "ok") {
      return responseError(
        INVALID_CREDENTIALS,
        401
      )
    }

    // ====================================
    // LEGACY PASSWORD MIGRATION
    // ====================================

    let expectedVersion = data.session_version

    if (
      !Number.isSafeInteger(expectedVersion) ||
      expectedVersion < 1
    ) {
      return responseError(
        "Phiên bảo mật không hợp lệ.",
        401
      )
    }

    if (!storedHash) {
      let migrationFunction: string

      if (environment === "test") {
        if (!/^TESTPIN[0-9]{3}$/.test(code)) {
          return responseError(
            "Tài khoản thử nghiệm không hợp lệ.",
            403
          )
        }

        migrationFunction =
          "migrate_test_password"
      } else {
        migrationFunction =
          "migrate_employee_password"
      }

      const newHash = hashPassword(
        enteredPassword
      )

      const {
        data: migrated,
        error: migrationError,
      } = await database.rpc(
        migrationFunction,
        {
          p_id: data.id,
          p_old_password: legacy,
          p_new_hash: newHash,
        }
      )

      if (migrationError) {
        throw migrationError
      }

      if (migrated !== true) {
        return responseError(
          "Tài khoản vừa được cập nhật bảo mật. Vui lòng đăng nhập lại.",
          409
        )
      }

      // Migration increments session_version.
      expectedVersion += 1
    }

    // ====================================
    // CREATE PENDING SESSION
    // ====================================

    try {
      await setSession(
        data.id,
        "pending",
        expectedVersion
      )
    } catch {
      return responseError(
        "Phiên bảo mật đã thay đổi. Vui lòng đăng nhập lại.",
        409
      )
    }

    // ====================================
    // DETERMINE PIN STATUS
    // ====================================

    const hasPin = Boolean(
      data.security_pin_hash ||
      String(data.security_pin ?? "").trim()
    )

    return Response.json(
      { hasPin },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (err) {
    console.error(
      "Login error:",
      err instanceof Error
        ? err.message
        : "Unknown error"
    )

    return responseError(
      "Lỗi đăng nhập hoặc cấu hình máy chủ.",
      500
    )
  }
}
