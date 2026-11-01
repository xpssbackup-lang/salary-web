import { db, getSession, responseError } from "@/lib/server/auth"
export async function POST(){
 try {
  const session=await getSession("verified");if(!session)return responseError("Hãy đăng nhập và xác minh PIN",401)
  const database=db()
  const {data:employee,error:e}=await database.from("employees").select("id,employee_code,name,department,position,role,platform,account_number").eq("id",session.id).single()
  if(e || !employee)return responseError("Tài khoản không tồn tại",401)
  const {data:payroll,error:p}=await database.from("payrolls").select("*").eq("employee_code",employee.employee_code).order("created_at",{ascending:false}).limit(1).maybeSingle()
  if(p)throw p
  return Response.json({employee,payroll},{headers:{"Cache-Control":"no-store"}})
 }catch(err){console.error("Salary error",err);return responseError("Không thể tải bảng lương",500)}
}
