"use client"

import { useEffect, useState } from "react"
import { supabase } from "../lib/supabase"

type Employee = {
  id: string
  employee_code: string
  name: string
  password: string
  department: string | null
  position: string | null
  role: string | null
  security_pin: string | null
  platform: string | null
  account_number: string | null
}

type Payroll = {
  id: string
  employee_code: string
  salary_month: string
  basic_salary: number
  allowance: number
  bonus: number
  deduction: number
  performance: number
  leave_deduction: number
  leave_bonus: number
  extra_fee: number
  extra_fee_type: "income" | "deduction" | null
  actual_salary: number
  note: string | null
}

type SalaryItem = {
  label: string
  type: "income" | "deduction"
  amount: number
}

type LanguageKey = "vi" | "en" | "zh"

const translations = {
  vi: {
    short: "VN",
    loginTitle: "Hệ thống lương",
    employeeId: "Mã nhân viên",
    password: "Mật khẩu",
    login: "Đăng nhập",
    setup: "Thiết lập",
    loading: "Đang tải...",
    forgotPassword: "🔑 Quên mật khẩu?",
    salarySlip: "PHIẾU LƯƠNG",
    employeeInfo: "THÔNG TIN NHÂN VIÊN",
    details: "Chi tiết lương",
    item: "Hạng mục",
    type: "Loại",
    amount: "Số tiền",
    income: "THU",
    deduction: "TRỪ",
    actualSalary: "Thực nhận",
    note: "Ghi chú",
    back: "← Quay lại",
    screenshot: "📸 Chụp màn hình",
    name: "HỌ TÊN",
    code: "MÃ NHÂN VIÊN",
    platform: "NỀN TẢNG",
    position: "VỊ TRÍ",
    accountType: "LOẠI TÀI KHOẢN",
    accountNumber: "SỐ TÀI KHOẢN",
    basicSalary: "LƯƠNG CƠ BẢN",
    basicSalaryRow: "Lương cơ bản",
    allowanceRow: "Phụ cấp",
    bonusRow: "Thưởng",
    deductionRow: "Khấu trừ",
    performanceRow: "Hiệu suất",
    leaveDeductionRow: "Khấu trừ ngày nghỉ",
    leaveBonusRow: "Thưởng ngày nghỉ",
    extraFeeRow: "Phí bổ sung",
    noAccount: "Chưa cập nhật",
    pleaseEnter: "Vui lòng nhập mã nhân viên và mật khẩu",
    notFound: "Không tìm thấy mã nhân viên",
    wrongPassword: "Sai mật khẩu",
    loadError: "Đăng nhập thành công nhưng tải bảng lương thất bại",
    noSalary: "Đăng nhập thành công nhưng chưa có dữ liệu lương",
    unknownError: "Đã xảy ra lỗi",
    createPin: "Tạo mã bảo mật 4 số",
    verifyPin: "Nhập mã bảo mật",
    cancel: "Hủy",
    confirm: "Xác nhận",
    pinRequired: "Vui lòng nhập mã bảo mật",
    pinMustBe4Digits: "Mã bảo mật phải gồm đúng 4 số",
    pinNotMatch: "Mã xác nhận không khớp",
    pinSaveFailed: "Lưu mã bảo mật thất bại",
    pinWrong: "Mã bảo mật không đúng",
  },
  en: {
    short: "EN",
    loginTitle: "Salary System",
    employeeId: "Employee ID",
    password: "Password",
    login: "Login",
    setup: "Setup",
    loading: "Loading...",
    forgotPassword: "🔑 Forgot password?",
    salarySlip: "SALARY SLIP",
    employeeInfo: "EMPLOYEE INFORMATION",
    details: "Salary Details",
    item: "Item",
    type: "Type",
    amount: "Amount",
    income: "INCOME",
    deduction: "DEDUCTION",
    actualSalary: "Actual Salary",
    note: "Note",
    back: "← Back",
    screenshot: "📸 Screenshot",
    name: "NAME",
    code: "EMPLOYEE ID",
    platform: "PLATFORM",
    position: "POSITION",
    accountType: "ACCOUNT TYPE",
    accountNumber: "ACCOUNT NUMBER",
    basicSalary: "BASIC SALARY",
    basicSalaryRow: "Basic Salary",
    allowanceRow: "Allowance",
    bonusRow: "Bonus",
    deductionRow: "Deduction",
    performanceRow: "Performance",
    leaveDeductionRow: "Leave Deduction",
    leaveBonusRow: "Leave Bonus",
    extraFeeRow: "Extra Fee",
    noAccount: "Not updated",
    pleaseEnter: "Please enter Employee ID and Password",
    notFound: "Employee ID not found",
    wrongPassword: "Wrong Password",
    loadError: "Login success but failed to load salary data",
    noSalary: "Login success but no salary data found",
    unknownError: "Something went wrong",
    createPin: "Create 4-digit security PIN",
    verifyPin: "Enter security PIN",
    cancel: "Cancel",
    confirm: "Confirm",
    pinRequired: "Please enter security PIN",
    pinMustBe4Digits: "PIN must be exactly 4 digits",
    pinNotMatch: "PIN confirmation does not match",
    pinSaveFailed: "Failed to save security PIN",
    pinWrong: "Incorrect security PIN",
  },
  zh: {
    short: "中文",
    loginTitle: "薪资系统",
    employeeId: "员工编号",
    password: "密码",
    login: "登录",
    setup: "设置",
    loading: "加载中...",
    forgotPassword: "🔑 忘记密码？",
    salarySlip: "工资单",
    employeeInfo: "员工信息",
    details: "薪资明细",
    item: "项目",
    type: "类型",
    amount: "金额",
    income: "收入",
    deduction: "扣除",
    actualSalary: "实发工资",
    note: "备注",
    back: "← 返回",
    screenshot: "📸 截图",
    name: "姓名",
    code: "员工编号",
    platform: "平台",
    position: "职位",
    accountType: "账户类型",
    accountNumber: "账户号码",
    basicSalary: "基本工资",
    basicSalaryRow: "基本工资",
    allowanceRow: "补贴",
    bonusRow: "奖金",
    deductionRow: "扣款",
    performanceRow: "绩效",
    leaveDeductionRow: "请假扣款",
    leaveBonusRow: "休假奖励",
    extraFeeRow: "补充费用",
    noAccount: "未更新",
    pleaseEnter: "请输入员工编号和密码",
    notFound: "未找到员工编号",
    wrongPassword: "密码错误",
    loadError: "登录成功，但加载工资数据失败",
    noSalary: "登录成功，但暂无工资数据",
    unknownError: "发生错误",
    createPin: "创建4位安全码",
    verifyPin: "输入安全码",
    cancel: "取消",
    confirm: "确认",
    pinRequired: "请输入安全码",
    pinMustBe4Digits: "安全码必须为4位数字",
    pinNotMatch: "确认安全码不一致",
    pinSaveFailed: "保存安全码失败",
    pinWrong: "安全码错误",
  },
}

export default function LoginPage() {
  const [employee, setEmployee] = useState("")
  const [password, setPassword] = useState("")
  const [employeeInfo, setEmployeeInfo] = useState<Employee | null>(null)
  const [salary, setSalary] = useState<Payroll | null>(null)
  const [pendingEmployee, setPendingEmployee] = useState<Employee | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const [language, setLanguage] = useState<LanguageKey>("vi")

  const [showCreatePinModal, setShowCreatePinModal] = useState(false)
  const [showVerifyPinModal, setShowVerifyPinModal] = useState(false)
  const [newPin, setNewPin] = useState("")
  const [confirmNewPin, setConfirmNewPin] = useState("")
  const [verifyPin, setVerifyPin] = useState("")

  useEffect(() => {
    const savedLanguage = localStorage.getItem("salary-language") as LanguageKey | null
    if (savedLanguage && ["vi", "en", "zh"].includes(savedLanguage)) {
      setLanguage(savedLanguage)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem("salary-language", language)
  }, [language])

  const t = translations[language]

  const isValidPin = (pin: string) => /^\d{4}$/.test(pin)

  const loadLatestPayroll = async (employeeCode: string, user: Employee) => {
    const { data: payroll, error: payrollError } = await supabase
      .from("payrolls")
      .select("*")
      .eq("employee_code", employeeCode)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (payrollError) {
      console.error(payrollError)
      setError(t.loadError)
      setEmployeeInfo(user)
      return
    }

    if (!payroll) {
      setEmployeeInfo(user)
      setError(t.noSalary)
      return
    }

    setEmployeeInfo(user)
    setSalary(payroll as Payroll)
  }

  const findEmployeeByLogin = async () => {
    const employeeCode = employee.trim()
    const employeePassword = password.trim()

    if (!employeeCode || !employeePassword) {
      setError(t.pleaseEnter)
      return null
    }

    const { data: user, error: userError } = await supabase
      .from("employees")
      .select("*")
      .eq("employee_code", employeeCode)
      .maybeSingle()

    if (userError) {
      console.error(userError)
      setError(t.unknownError)
      return null
    }

    if (!user) {
      setError(t.notFound)
      return null
    }

    if (String(user.password).trim() !== employeePassword) {
      setError(t.wrongPassword)
      return null
    }

    return user as Employee
  }

  const login = async () => {
    try {
      setLoading(true)
      setError("")
      setSalary(null)
      setEmployeeInfo(null)

      const user = await findEmployeeByLogin()
      if (!user) return

      setPendingEmployee(user)

      if (!user.security_pin) {
        setShowCreatePinModal(true)
        return
      }

      setShowVerifyPinModal(true)
    } catch (err) {
      console.error(err)
      setError(t.unknownError)
    } finally {
      setLoading(false)
    }
  }

  const setupPin = async () => {
    try {
      setLoading(true)
      setError("")

      const user = await findEmployeeByLogin()
      if (!user) return

      setPendingEmployee(user)
      setNewPin("")
      setConfirmNewPin("")
      setShowCreatePinModal(true)
    } catch (err) {
      console.error(err)
      setError(t.unknownError)
    } finally {
      setLoading(false)
    }
  }

  const handleCreatePin = async () => {
    if (!pendingEmployee) return

    if (!newPin || !confirmNewPin) {
      setError(t.pinRequired)
      return
    }

    if (!isValidPin(newPin) || !isValidPin(confirmNewPin)) {
      setError(t.pinMustBe4Digits)
      return
    }

    if (newPin !== confirmNewPin) {
      setError(t.pinNotMatch)
      return
    }

    const { error: updateError } = await supabase
      .from("employees")
      .update({ security_pin: newPin })
      .eq("id", pendingEmployee.id)

    if (updateError) {
      console.error(updateError)
      setError(t.pinSaveFailed)
      return
    }

    const updatedEmployee = { ...pendingEmployee, security_pin: newPin }
    setPendingEmployee(updatedEmployee)
    setShowCreatePinModal(false)
    setError("")
    await loadLatestPayroll(updatedEmployee.employee_code, updatedEmployee)
  }

  const handleVerifyPin = async () => {
    if (!pendingEmployee) return

    if (!verifyPin) {
      setError(t.pinRequired)
      return
    }

    if (String(pendingEmployee.security_pin).trim() !== verifyPin.trim()) {
      setError(t.pinWrong)
      return
    }

    setShowVerifyPinModal(false)
    setError("")
    await loadLatestPayroll(pendingEmployee.employee_code, pendingEmployee)
  }

  const logout = () => {
    setEmployee("")
    setPassword("")
    setEmployeeInfo(null)
    setSalary(null)
    setPendingEmployee(null)
    setError("")
    setShowCreatePinModal(false)
    setShowVerifyPinModal(false)
    setNewPin("")
    setConfirmNewPin("")
    setVerifyPin("")
  }

  const captureScreen = () => {
    window.print()
  }

  const salaryItems: any[] = salary
    ? [
        {
          label: t.basicSalaryRow,
          type: "income",
          amount: Number(salary.basic_salary || 0),
        },
        {
          label: t.allowanceRow,
          type: "income",
          amount: Number(salary.allowance || 0),
        },
        {
          label: t.bonusRow,
          type: "income",
          amount: Number(salary.bonus || 0),
        },
        {
          label: t.performanceRow,
          type: "income",
          amount: Number(salary.performance || 0),
        },
        {
          label: t.leaveDeductionRow,
          type: "deduction",
          amount: Number(salary.leave_deduction || 0),
        },
        {
          label: t.leaveBonusRow,
          type: "income",
          amount: Number(salary.leave_bonus || 0),
        },
        {
          label: t.extraFeeRow,
          type:
            salary.extra_fee_type === "deduction" ? "deduction" : "income",
          amount: Number(salary.extra_fee || 0),
        },
        {
          label: t.deductionRow,
          type: "deduction",
          amount: Number(salary.deduction || 0),
        },
      ].filter((item) => Number(item.amount || 0) !== 0)
    : []

  if (employeeInfo && salary) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top,#163e93_0%,#0c2259_45%,#04112b_100%)] px-4 py-8">
        <div className="mx-auto w-full max-w-5xl overflow-hidden rounded-[28px] border border-white/10 bg-[#f3f4f6] shadow-[0_20px_80px_rgba(0,0,0,0.45)]">
          <div className="flex flex-col gap-4 bg-gradient-to-r from-[#10255d] to-[#1e3f9d] px-8 py-6 text-white md:flex-row md:items-center md:justify-between">
            <h1 className="text-3xl font-extrabold tracking-wide md:text-4xl">
              {t.salarySlip}
            </h1>

            <div className="flex items-center gap-3">
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value as LanguageKey)}
                className="rounded-xl border border-white/20 bg-white px-4 py-2 text-sm font-medium text-black outline-none"
              >
                <option value="vi">🇻🇳 Tiếng Việt</option>
                <option value="en">🇺🇸 English</option>
                <option value="zh">🇨🇳 中文</option>
              </select>

              <div className="rounded-xl bg-white/10 px-4 py-2 text-sm font-semibold">
                {(employeeInfo.platform || employeeInfo.department || "VN")}-{salary.salary_month}
              </div>
            </div>
          </div>

          <div className="p-6 md:p-8">
            <h2 className="mb-5 text-2xl font-extrabold text-slate-700 md:text-3xl">
              {t.employeeInfo}
            </h2>

            <div className="grid overflow-hidden rounded-2xl border border-slate-200 bg-white md:grid-cols-2">
              <InfoCell label={t.code} value={employeeInfo.employee_code} />
              <InfoCell label={t.name} value={employeeInfo.name} />
              <InfoCell
                label={t.platform}
                value={employeeInfo.platform || employeeInfo.department || "-"}
              />
              <InfoCell label={t.position} value={employeeInfo.position || "-"} />
              <InfoCell label={t.accountType} value="TRX" />
              <InfoCell
                label={t.accountNumber}
                value={employeeInfo.account_number || t.noAccount}
              />
              <InfoCell
                label={t.basicSalary}
                value={String(salary.basic_salary ?? 0)}
                full
              />
            </div>

            <div className="mt-8">
              <h3 className="mb-4 text-2xl font-extrabold text-slate-800 md:text-3xl">
                {t.details}
              </h3>

              <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                <div className="grid grid-cols-[2fr_1fr_1fr] bg-slate-200 px-4 py-4 text-base font-bold text-slate-800 md:text-lg">
                  <div>{t.item}</div>
                  <div>{t.type}</div>
                  <div className="text-right">{t.amount}</div>
                </div>

                {salaryItems.map((item, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[2fr_1fr_1fr] border-t border-slate-200 px-4 py-4 text-base md:text-lg"
                  >
                    <div className="text-slate-800">{item.label}</div>
                    <div className="font-semibold text-slate-700">
                      {item.type === "income" ? t.income : t.deduction}
                    </div>
                    <div
                      className={`text-right font-bold ${
                        item.type === "income" ? "text-green-600" : "text-red-500"
                      }`}
                    >
                      {item.type === "income" ? "+" : "-"} {Math.abs(item.amount)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 flex items-center justify-between rounded-2xl bg-[#031333] px-6 py-6 text-white">
              <span className="text-2xl font-bold md:text-3xl">{t.actualSalary}</span>
              <span className="text-4xl font-extrabold text-yellow-400 md:text-5xl">
                {salary.actual_salary}
              </span>
            </div>

            <div className="mt-4 rounded-2xl bg-white p-4 text-sm text-slate-600">
              <span className="font-semibold">{t.note}:</span> {salary.note || "-"}
            </div>

            <div className="mt-8 flex flex-col gap-3 md:flex-row">
              <button
                onClick={logout}
                className="rounded-xl bg-slate-600 px-6 py-4 text-base font-semibold text-white md:text-lg"
              >
                {t.back}
              </button>

              <button
                onClick={captureScreen}
                className="rounded-xl bg-gradient-to-r from-sky-400 to-cyan-500 px-6 py-4 text-base font-semibold text-white md:text-lg"
              >
                {t.screenshot}
              </button>
            </div>
          </div>
        </div>
      </main>
    )
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_top,#163e93_0%,#0c2259_45%,#04112b_100%)] px-4">
      <div className="w-full max-w-md rounded-[30px] border border-white/10 bg-[rgba(18,26,54,0.82)] p-8 shadow-[0_20px_80px_rgba(0,0,0,0.55)] backdrop-blur-xl">
        <div className="mb-6 flex justify-end">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value as LanguageKey)}
            className="rounded-xl border border-white/10 bg-white/95 px-3 py-2 text-sm font-semibold text-black outline-none"
          >
            <option value="vi">🇻🇳 VN</option>
            <option value="en">🇺🇸 EN</option>
            <option value="zh">🇨🇳 中文</option>
          </select>
        </div>

        <h1 className="mb-8 text-center text-3xl font-extrabold text-white md:text-4xl">
          {t.loginTitle}
        </h1>

        <input
          className="mb-5 w-full rounded-xl border border-white/20 bg-white px-4 py-4 text-lg text-black outline-none"
          placeholder={t.employeeId}
          value={employee}
          onChange={(e) => setEmployee(e.target.value)}
        />

        <input
          className="mb-4 w-full rounded-xl border border-white/20 bg-white px-4 py-4 text-lg text-black outline-none"
          type="password"
          placeholder={t.password}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") login()
          }}
        />

        {error && <p className="mb-4 text-sm font-medium text-red-300">{error}</p>}

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={login}
            disabled={loading}
            className="rounded-xl bg-gradient-to-r from-blue-400 to-blue-600 py-4 text-lg font-bold text-white disabled:opacity-60"
          >
            {loading ? t.loading : t.login}
          </button>

          <button
            type="button"
            onClick={setupPin}
            className="rounded-xl bg-white/15 py-4 text-lg font-bold text-white"
          >
            {t.setup}
          </button>
        </div>

        <div className="mt-6 text-center">
          <button
            type="button"
            className="text-sm font-medium text-sky-300 transition hover:text-sky-200"
          >
            {t.forgotPassword}
          </button>
        </div>
      </div>

      {showCreatePinModal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[rgba(30,38,66,0.96)] p-8 shadow-2xl backdrop-blur-xl">
            <h2 className="mb-6 text-center text-3xl font-extrabold text-white">
              {t.createPin}
            </h2>

            <input
              className="mb-4 w-full rounded-xl border border-white/20 bg-white/15 px-4 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none"
              maxLength={4}
              inputMode="numeric"
              placeholder="••••"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ""))}
            />

            <input
              className="mb-6 w-full rounded-xl border border-white/20 bg-white/15 px-4 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none"
              maxLength={4}
              inputMode="numeric"
              placeholder="••••"
              value={confirmNewPin}
              onChange={(e) => setConfirmNewPin(e.target.value.replace(/\D/g, ""))}
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setShowCreatePinModal(false)
                  setPendingEmployee(null)
                  setError("")
                }}
                className="rounded-xl bg-white/15 py-4 text-lg font-bold text-white"
              >
                {t.cancel}
              </button>

              <button
                onClick={handleCreatePin}
                className="rounded-xl bg-gradient-to-r from-blue-400 to-cyan-500 py-4 text-lg font-bold text-white"
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}

      {showVerifyPinModal && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50 px-4">
          <div className="w-full max-w-md rounded-[28px] border border-white/10 bg-[rgba(30,38,66,0.96)] p-8 shadow-2xl backdrop-blur-xl">
            <h2 className="mb-6 text-center text-3xl font-extrabold text-white">
              {t.verifyPin}
            </h2>

            <input
              className="mb-6 w-full rounded-xl border border-white/20 bg-white/15 px-4 py-4 text-center text-2xl tracking-[0.5em] text-white outline-none"
              maxLength={4}
              inputMode="numeric"
              placeholder="••••"
              value={verifyPin}
              onChange={(e) => setVerifyPin(e.target.value.replace(/\D/g, ""))}
            />

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => {
                  setShowVerifyPinModal(false)
                  setPendingEmployee(null)
                  setError("")
                }}
                className="rounded-xl bg-white/15 py-4 text-lg font-bold text-white"
              >
                {t.cancel}
              </button>

              <button
                onClick={handleVerifyPin}
                className="rounded-xl bg-gradient-to-r from-blue-400 to-cyan-500 py-4 text-lg font-bold text-white"
              >
                {t.confirm}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function InfoCell({
  label,
  value,
  full = false,
}: {
  label: string
  value: string
  full?: boolean
}) {
  return (
    <div
      className={`border-slate-200 p-5 ${
        full ? "md:col-span-2" : ""
      } border-b md:border-r even:md:border-r-0`}
    >
      <div className="mb-2 text-sm font-bold tracking-[0.2em] text-slate-400">
        {label}
      </div>
      <div className="break-all text-xl font-bold text-slate-800 md:text-2xl">
        {value}
      </div>
    </div>
  )
}