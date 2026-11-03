
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

const TEST_SUPABASE_HOST =
  "zaqcfhzdqelucrtebfc.supabase.co"

function isTestPreview() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (
    process.env.VERCEL_ENV !== "preview" ||
    process.env.NEXT_PUBLIC_TEST_PIN_NO_ACTIVATION !== "true" ||
    !url
  ) {
    return false
  }

  try {
    return new URL(url).hostname === TEST_SUPABASE_HOST
  } catch {
    return false
  }
}

export async function POST(req: Request) {
  try {
    const session = await getSession("pending")

    if (!session) {
      return responseError("Phiên đăng nhập hết hạn", 401)
    }

    const body = await req.json()
    const { pin, activationCode } = body

    if (!validPin(pin)) {
      return responseError("PIN phải có đúng 4 số", 400)
    }

    const database = db()
    const testMode = isTestPreview()

    let data: boolean | null

    if (testMode) {
      // TEST ONLY: No activation code required.
      const result = await database.rpc(
        "setup_test_employee_pin",
        {
          p_id: session.id,
          p_pin_hash: hashPin(pin),
        }
      )

      if (result.error) throw result.error
      data = result.data
    } else {
      // Original activation process for non-test environments.
      if (!validActivation(activationCode)) {
        return responseError(
          "Cần mã kích hoạt riêng do quản lý cấp",
          403
        )
      }

      const result = await database.rpc(
        "activate_employee_pin",
        {
          p_id: session.id,
          p_code_hash: hashActivation(activationCode),
          p_pin_hash: hashPin(pin),
        }
      )

      if (result.error) throw result.error
      data = result.data
    }

    if (!data) {
      return responseError(
        "Không thể tạo PIN. Tài khoản có thể đã có PIN.",
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

    return responseError(
      "Không thể lưu PIN",
      500
    )
  }
}
