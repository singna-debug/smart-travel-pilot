'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  let { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    // Email not confirmed 에러 발생 시 SUPABASE_SERVICE_ROLE_KEY로 강제 자동 승인 후 재로그인 시도
    if (error.message.includes('Email not confirmed')) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    if (serviceKey && supabaseUrl) {
      const { createClient: createAdminClient } = await import('@supabase/supabase-js')
      const adminSupabase = createAdminClient(supabaseUrl, serviceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })

      const { data: usersData } = await adminSupabase.auth.admin.listUsers()
      const targetUser = usersData?.users.find(u => u.email === email)
      if (targetUser) {
        await adminSupabase.auth.admin.updateUserById(targetUser.id, {
          email_confirm: true,
          user_metadata: { ...targetUser.user_metadata, status: 'approved' }
        })

        // 재로그인 시도
        const retry = await supabase.auth.signInWithPassword({ email, password })
        if (!retry.error) {
          revalidatePath('/', 'layout')
          redirect('/')
        }
      }
    }
    return redirect('/login?error=' + encodeURIComponent('이메일 인증이 필요합니다. 관리자 자동 승인이 진행되었으니 1초 후 다시 로그인 버튼을 눌러주세요.'))
  }

  // 일반 로그인 에러 (비밀번호 불일치 등) 발생 시 에러 메시지와 함께 리다이렉트
  return redirect('/login?error=' + encodeURIComponent(error.message))
}

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const companyName = (formData.get('companyName') as string) || '신규 여행사'
  const managerName = (formData.get('managerName') as string) || '담당자'

  // Service role key가 있는 경우 즉시 자동 승인 처리
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL

  if (serviceKey && supabaseUrl) {
    const { createClient: createAdminClient } = await import('@supabase/supabase-js')
    const adminSupabase = createAdminClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    })

    const { data: newUser, error: adminErr } = await adminSupabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // 100% 자동 이메일 승인
      user_metadata: {
        company_name: companyName,
        manager_name: managerName,
        status: 'approved' // 100% 자동 승인 상태
      }
    })

    if (adminErr) {
      return redirect('/login?error=' + encodeURIComponent(adminErr.message))
    }

    // 신규 가입자 전용 테넌트 초기화
    if (newUser.user?.id) {
      const { initializeNewTenant } = await import('@/lib/tenant')
      await initializeNewTenant(newUser.user.id, companyName, managerName)
    }

    return redirect('/login?message=' + encodeURIComponent('🎉 회원가입 및 승인이 완료되었습니다! 생성하신 계정으로 지금 바로 로그인해주세요.'))
  }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        company_name: companyName,
        manager_name: managerName,
        status: 'approved'
      }
    }
  })

  if (error) {
    return redirect('/login?error=' + encodeURIComponent(error.message))
  }

  return redirect('/login?message=' + encodeURIComponent('🎉 회원가입이 완료되었습니다! 로그인해 주세요.'))
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
