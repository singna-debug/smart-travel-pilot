import { createServerClient } from '@supabase/ssr'
import { NextRequest, NextResponse } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run during build/static generation if env vars are missing
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      return supabaseResponse
  }

  // IMPORTANT: Avoid calling getUser() if we are on the login page or static assets
  // The matcher in middleware.ts should handle this, but being extra safe here
  const isAuthPage = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth')
  const isStaticAsset = request.nextUrl.pathname.includes('.') || request.nextUrl.pathname.startsWith('/_next')

  if (isStaticAsset) return supabaseResponse

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // 로그인하지 않은 사용자가 보호된 페이지에 접근할 때
  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
