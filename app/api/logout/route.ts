import { clearSession } from "@/lib/server/auth"
export async function POST(){await clearSession();return Response.json({ok:true})}
