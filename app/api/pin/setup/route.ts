import { db, getSession, hashPin, responseError, setSession, validPin } from "@/lib/server/auth"
export async function POST(req:Request){
 try {
  const s=await getSession("pending"); if(!s) return responseError("Phiên đăng nhập hết hạn",401)
  const {pin}=await req.json(); if(!validPin(pin)) return responseError("PIN phải có đúng 4 số")
  const hash=hashPin(pin)
  const {data,error}=await db().from("employees").update({security_pin_hash:hash})
    .eq("id",s.id).is("security_pin_hash",null).or("security_pin.is.null,security_pin.eq.")
    .select("id").maybeSingle()
  if(error) throw error
  if(!data) return responseError("Nhân viên đã có PIN. Không thể tạo lại.",409)
  await setSession(s.id,"verified"); return Response.json({ok:true})
 } catch(err){console.error("PIN setup error",err);return responseError("Không thể lưu PIN",500)}
}
