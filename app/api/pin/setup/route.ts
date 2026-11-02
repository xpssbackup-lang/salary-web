import { db, clearSession, responseError, setSession } from "@/lib/server/auth"
import { timingSafeEqual } from "node:crypto"
export async function POST(req:Request){
 try {
  await clearSession()
  const {employeeCode,password}=await req.json()
  if(typeof employeeCode!=="string" || typeof password!=="string" || employeeCode.length>100 || password.length>256) return responseError()
  const {data,error}=await db().from("employees").select("id,password,security_pin,security_pin_hash").eq("employee_code",employeeCode.trim()).maybeSingle()
  if(error) throw error
  const actual=String(data?.password ?? "").trim(); const entered=password.trim()
  const a=Buffer.from(actual);const b=Buffer.from(entered)
  if(!data || !actual || a.length!==b.length || !timingSafeEqual(a,b)) return responseError("Sai tài khoản hoặc mật khẩu",401)
  await setSession(data.id,"pending")
  return Response.json({hasPin:!!(data.security_pin_hash || String(data.security_pin??"").trim())},{headers:{"Cache-Control":"no-store"}})
 } catch(err){ console.error("Login error",err); return responseError("Lỗi đăng nhập hoặc cấu hình máy chủ",500) }
}
