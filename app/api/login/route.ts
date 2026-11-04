
import {
  db,
  clearSession,
  responseError,
  setSession,
} from "@/lib/server/auth"

import { timingSafeEqual } from "node:crypto"

export async function POST(req: Request) {
  try {
    await clearSession()

    const body = await req.json()

    const employeeCode = body?.employeeCode
    const password = body?.password

    if (
      typeof employeeCode !== "string" ||
      typeof password !== "string" ||
      employeeCode.length > 100 ||
      password.length > 256
    ) {
      return responseError("Thông tin không hợp lệ", 400)
    }

    const database = db()

    const { data, error } = await database
      .from("employees")
      .select(
        "id,password,security_pin,security_pin_hash,session_version"
      )
      .eq("employee_code", employeeCode.trim())
      .maybeSingle()

    if (error) throw error

    const actual = String(data?.password ?? "").trim()
    const entered = password.trim()

    const actualBuffer = Buffer.from(actual)
    const enteredBuffer = Buffer.from(entered)

    const passwordMatches =
      actual.length > 0 &&
      actualBuffer.length === enteredBuffer.length &&
      timingSafeEqual(actualBuffer, enteredBuffer)

    if (!data || !passwordMatches) {
      return responseError(
        "Sai tài khoản hoặc mật khẩu",
        401
      )
    }

    if (
      !Number.isSafeInteger(data.session_version) ||
      data.session_version < 1
    ) {
      return responseError(
        "Tài khoản chưa được cấu hình phiên bảo mật",
        500
      )
    }

    // setSession reads the current version
    // from Supabase and creates a signed session.
    await setSession(data.id, "pending")

    const hasPin = Boolean(
      data.security_pin_hash ||
      String(data.security_pin ?? "").trim()
    )

    return Response.json(
      { hasPin },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
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
