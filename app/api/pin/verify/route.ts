import { db, getSession, hashPin, matchesPin, responseError, setSession, validPin } from "@/lib/server/auth"
export async function POST(req:Request){
 try {
  const s=await getSession("pending");if(!s)return responseError("Phiên đăng nhập hết hạn",401)
  const {pin}=await req.json();if(!validPin(pin))return responseError("PIN phải có đúng 4 số")
  const {data,error}=await db().from("employees").select("security_pin,security_pin_hash").eq("id",s.id).single()
  if(error || !data)return responseError("Không tìm thấy tài khoản",401)
  const old=String(data.security_pin??"").trim()
  const valid=data.security_pin_hash ? matchesPin(pin,data.security_pin_hash) : old.length===4 && old===pin
  if(!valid)return responseError("Mã PIN không đúng",401)
  if(!data.security_pin_hash){
    // Migrate the legacy PIN without erasing the old field; no PIN changes permitted.
    await db().from("employees").update({security_pin_hash:hashPin(pin)}).eq("id",s.id).is("security_pin_hash",null)
  }
  await setSession(s.id,"verified");return Response.json({ok:true})
 }catch(err){console.error("PIN verify error",err);return responseError("Không thể xác minh PIN",500)}
}
