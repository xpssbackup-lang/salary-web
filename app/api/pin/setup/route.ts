
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

// Official Supabase TEST project hostname.
// Must match NEXT_PUBLIC_SUPABASE_URL in Vercel Preview.
const TEST_SUPABASE_HOST =
  "zaqcfhzdqelucrbtebfc.supabase.co"

function isTestPreview(): boolean {
  const vercelEnv = process.env.VERCEL_ENV
  const testFlag =
    process.env.NEXT_PUBLIC_TEST_PIN_NO_ACTIVATION

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL

  // Never bypass activation outside Preview.
  if (vercelEnv !== "preview") {
    return false
  }

  // Explicit opt-in is required.
  if (testFlag !== "true") {
    return false
  }

  if (!supabaseUrl) {
    return false
  }

  try {
    const parsed = new URL(supabaseUrl)

    return (
      parsed.protocol === "https:" &&
      parsed.hostname === TEST_SUPABASE_HOST &&
      (parsed.pathname === "/" ||
        parsed.pathname === "")
    )
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  try {
    // Step 1: Require a valid pending session.
    const session = await getSession("pending")

    if (!session) {
      return responseError(
        "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.",
        401
      )
    }

    // Step 2: Validate the requested PIN.
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

    let activated = false

    if (testMode) {
      // PREVIEW + SUPABASE TEST ONLY
      // No manager-issued activation code.
      //
      // The SQL function independently restricts
      // operations to eligible TESTPIN accounts.
      const { data, error } = await database.rpc(
        "setup_test_employee_pin",
        {
          p_id: session.id,
          p_pin_hash: hashPin(pin),
        }
      )

      if (error) {
        console.error(
          "Test PIN setup database error:",
          error.code,
          error.message
        )

        return responseError(
          "Không thể tạo mã PIN thử nghiệm.",
          500
        )
      }

      activated = data === true
    } else {
      // PRODUCTION / NON-TEST ENVIRONMENTS
      // Keep existing activation requirement.
      if (!validActivation(activationCode)) {
        return responseError(
          "Cần mã kích hoạt riêng do quản lý cấp",
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
          "PIN activation database error:",
          error.code,
          error.message
        )

        return responseError(
          "Không thể kích hoạt mã PIN.",
          500
        )
      }

      activated = data === true
    }

    // Step 3: Refuse if already initialized
    // or if the database rejected the request.
    if (!activated) {
      return responseError(
        "Không thể tạo mã PIN. Tài khoản đã có PIN hoặc không đủ điều kiện.",
        403
      )
    }

    // Step 4: Upgrade the session.
    await setSession(session.id, "verified")

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
      error instanceof Error ? error.message : "Unknown error"
    )

    return responseError(
      "Lỗi hệ thống khi thiết lập mã PIN.",
      500
    )
  }
}
