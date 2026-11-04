
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

// ========================================
// SECURITY V2 - PIN ACTIVATION
// Production: activation code required
// Test Preview: optional bypass
// ========================================

const TEST_SUPABASE_HOST =
  "zaqcfhzdqelucbrtebfc.supabase.co"

const PRODUCTION_SUPABASE_HOST =
  "dhhdmkpjatohqdedbmbd.supabase.co"

// ========================================
// CHECK DATABASE HOSTNAME
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

// ========================================
// TEST PREVIEW ONLY
// ========================================

function isTestPreview(): boolean {
  return (
    process.env.VERCEL_ENV === "preview" &&
    process.env.NEXT_PUBLIC_TEST_PIN_NO_ACTIVATION ===
      "true" &&
    getDatabaseHost() === TEST_SUPABASE_HOST
  )
}

// ========================================
// PIN SETUP API
// ========================================

export async function POST(req: Request) {
  try {
    // 1. Validate pending session.
    const session = await getSession("pending")

    if (!session) {
      return responseError(
        "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
        401
      )
    }

    // 2. Validate PIN.
    const body = await req.json()

    const pin = body?.pin
    const activationCode = body?.activationCode

    if (!validPin(pin)) {
      return responseError(
        "Mã PIN phải có đúng 4 chữ số.",
        400
      )
    }

    const database = db()
    const testMode = isTestPreview()
    const databaseHost = getDatabaseHost()

    let activated = false

    if (testMode) {
      // ==================================
      // SUPABASE TEST + VERCEL PREVIEW
      // ==================================

      const { data, error } = await database.rpc(
        "setup_test_employee_pin",
        {
          p_id: session.id,
          p_pin_hash: hashPin(pin),
        }
      )

      if (error) {
        console.error(
          "Test PIN setup error:",
          error.code
        )

        return responseError(
          "Không thể tạo mã PIN thử nghiệm.",
          500
        )
      }

      activated = data === true

      if (!activated) {
        return responseError(
          "Tài khoản đã có PIN hoặc không đủ điều kiện.",
          403
        )
      }

      // Preserve the existing Test flow.
      await setSession(session.id, "verified")
    } else {
      // ==================================
      // PRODUCTION - ACTIVATION REQUIRED
      // ==================================

      if (
        process.env.VERCEL_ENV !== "production" ||
        databaseHost !== PRODUCTION_SUPABASE_HOST
      ) {
        return responseError(
          "Môi trường kích hoạt không hợp lệ.",
          503
        )
      }

      if (!validActivation(activationCode)) {
        return responseError(
          "Cần mã kích hoạt riêng do quản lý cấp.",
          403
        )
      }

      const { data, error } = await database.rpc(
        "activate_employee_pin",
        {
          p_id: session.id,
          p_code_hash: hashActivation(activationCode),
          p_pin_hash: hashPin(pin),
        }
      )

      if (error) {
        console.error(
          "Production PIN activation error:",
          error.code
        )

        return responseError(
          "Không thể kích hoạt mã PIN.",
          500
        )
      }

      activated = data === true

      if (!activated) {
        return responseError(
          "Mã kích hoạt không hợp lệ, đã sử dụng hoặc tài khoản đã có PIN.",
          403
        )
      }

      // Production SQL increases session_version
      // by exactly 1 after activation.
      //
      // Reject a session if another reset or
      // security change occurs before issuance.
      await setSession(
        session.id,
        "verified",
        session.version + 1
      )
    }

    // ==================================
    // SUCCESS
    // ==================================

    return Response.json(
      { ok: true },
      {
        status: 200,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    )
  } catch (error) {
    console.error(
      "PIN setup unexpected error:",
      error instanceof Error
        ? error.message
        : "Unknown error"
    )

    return responseError(
      "Lỗi hệ thống khi thiết lập mã PIN.",
      500
    )
  }
}
