
import {
  db,
  getSession,
  hashPin,
  responseError,
  setSession,
  validPin,
} from "@/lib/server/auth"

// ========================================
// SECURITY V2 - PIN SETUP
//
// TEST / PREVIEW:
//   setup_test_employee_pin
//
// PRODUCTION:
//   setup_employee_pin_v2
//
// No manager activation code required.
// ========================================

const TEST_SUPABASE_HOST =
  "zaqcfhzdqelucbrtebfc.supabase.co"

const PRODUCTION_SUPABASE_HOST =
  "dhhdmkpjatohqdedbmbd.supabase.co"

// ========================================
// VERIFY SUPABASE ENVIRONMENT
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

function getEnvironment():
  | "test"
  | "production"
  | null {
  const host = getDatabaseHost()
  const environment = process.env.VERCEL_ENV

  if (
    environment === "preview" &&
    host === TEST_SUPABASE_HOST &&
    process.env
      .NEXT_PUBLIC_TEST_PIN_NO_ACTIVATION ===
      "true"
  ) {
    return "test"
  }

  if (
    environment === "production" &&
    host === PRODUCTION_SUPABASE_HOST
  ) {
    return "production"
  }

  return null
}

// ========================================
// CREATE PIN API
// ========================================

export async function POST(req: Request) {
  try {
    // Step 1: Verify deployment environment.
    const environment = getEnvironment()

    if (!environment) {
      return responseError(
        "Môi trường thiết lập PIN không hợp lệ.",
        503
      )
    }

    // Step 2: Require a pending login session.
    const session = await getSession("pending")

    if (!session) {
      return responseError(
        "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
        401
      )
    }

    // Step 3: Read PIN request.
    let body: unknown

    try {
      body = await req.json()
    } catch {
      return responseError(
        "Dữ liệu không hợp lệ.",
        400
      )
    }

    if (
      !body ||
      typeof body !== "object" ||
      Array.isArray(body)
    ) {
      return responseError(
        "Dữ liệu không hợp lệ.",
        400
      )
    }

    const input = body as Record<string, unknown>
    const pin = input.pin

    // PIN must be exactly 4 digits.
    if (!validPin(pin)) {
      return responseError(
        "Mã PIN phải có đúng 4 chữ số.",
        400
      )
    }

    const database = db()
    const pinHash = hashPin(pin)

    let activated = false

    // ====================================
    // TEST / PREVIEW
    // ====================================

    if (environment === "test") {
      const { data, error } = await database.rpc(
        "setup_test_employee_pin",
        {
          p_id: session.id,
          p_pin_hash: pinHash,
        }
      )

      if (error) {
        console.error(
          "Test PIN setup error:",
          error.code,
          error.message
        )

        return responseError(
          "Không thể thiết lập PIN thử nghiệm.",
          500
        )
      }

      activated = data === true
    }

    // ====================================
    // PRODUCTION
    // ====================================

    if (environment === "production") {
      const { data, error } = await database.rpc(
        "setup_employee_pin_v2",
        {
          p_id: session.id,
          p_pin_hash: pinHash,
          p_expected_version: session.version,
        }
      )

      if (error) {
        console.error(
          "Production PIN setup error:",
          error.code,
          error.message
        )

        return responseError(
          "Không thể thiết lập mã PIN.",
          500
        )
      }

      activated = data === true
    }

    // ====================================
    // HANDLE FAILED SETUP
    // ====================================

    if (!activated) {
      return responseError(
        "Không thể tạo PIN. Tài khoản đã có PIN hoặc phiên bảo mật đã thay đổi. Vui lòng đăng nhập lại.",
        409
      )
    }

    // ====================================
    // CREATE VERIFIED SESSION
    // ====================================

    try {
      if (environment === "production") {
        // Production SQL increments
        // session_version by exactly 1.
        await setSession(
          session.id,
          "verified",
          session.version + 1
        )
      } else {
        // Preserve existing Test behavior.
        await setSession(
          session.id,
          "verified"
        )
      }
    } catch (sessionError) {
      console.error(
        "PIN session creation failed:",
        sessionError instanceof Error
          ? sessionError.message
          : "Unknown error"
      )

      return responseError(
        "PIN đã được tạo nhưng không thể mở phiên. Vui lòng đăng nhập lại bằng PIN vừa tạo.",
        409
      )
    }

    // ====================================
    // SUCCESS
    // ====================================

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
