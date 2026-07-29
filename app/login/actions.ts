'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return redirect('/login?error=' + encodeURIComponent(error.message))
  }

  // Supabase 대시보드 승인 여부 체크 (raw_user_meta_data.status === 'approved' 또는 email_confirmed_at)
  const user = data.user
  const isApproved = user?.user_metadata?.status === 'approved' || !!user?.email_confirmed_at

  if (!isApproved && user?.user_metadata?.status === 'pending') {
    await supabase.auth.signOut()
    return redirect('/login?error=' + encodeURIComponent('아직 관리자의 승인이 완료되지 않은 계정입니다. Supabase 대시보드에서 승인 후 로그인해주세요.'))
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function signup(formData: FormData) {
  const supabase = await createClient()

  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const companyName = (formData.get('companyName') as string) || '신규 여행사'
  const managerName = (formData.get('managerName') as string) || '담당자'

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        company_name: companyName,
        manager_name: managerName,
        status: 'pending' // 사장님 승인 대기 상태
      }
    }
  })

  if (error) {
    return redirect('/login?error=' + encodeURIComponent(error.message))
  }

  // 승인 대기 안내 메시지
  return redirect('/login?message=' + encodeURIComponent('가입 신청이 완료되었습니다. 관리자(대표)의 승인 완료 후 로그인 가능합니다.'))
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}
