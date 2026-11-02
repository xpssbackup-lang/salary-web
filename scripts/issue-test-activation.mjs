// Operator-only script, requires environment variables loaded LOCALLY (never put in Git).
// Run: node scripts/issue-test-activation.mjs TESTPIN003
import { createClient } from '@supabase/supabase-js'
import { createHmac, randomBytes } from 'node:crypto'
const [code] = process.argv.slice(2)
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const role = process.env.SUPABASE_SERVICE_ROLE_KEY
const pinSecret = process.env.PIN_HASH_SECRET
if (!code || !/^TESTPIN\d{3}$/.test(code) || !url || !role || !pinSecret || pinSecret.length<32) throw new Error('Use test account and TEST Supabase credentials only')
const token = randomBytes(24).toString('base64url').toUpperCase().replaceAll('0','2').replaceAll('1','3').replaceAll('_','-')
const hash = createHmac('sha256',pinSecret).update(`activate-v1:${token}`).digest('hex')
const db = createClient(url,role,{auth:{persistSession:false}})
const { data, error } = await db.from('employees').update({activation_code_hash:hash,activation_used_at:null}).eq('employee_code',code).is('security_pin_hash',null).is('security_pin',null).select('employee_code')
if (error || !data?.length) throw new Error(error?.message || 'No eligible test account; never reset existing PIN')
console.log(`Activation for ${code} (ONE-TIME): ${token}`)
