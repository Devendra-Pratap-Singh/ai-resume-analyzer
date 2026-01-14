'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function signUp(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string).toLowerCase().trim()
  const password = formData.get('password') as string
  const fullName = formData.get('fullName') as string

  // 1. Sign up user
  const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
      },
    },
  })

  if (signUpError) {
    return { error: signUpError.message }
  }

  // 2. Immediately sign in user (important fix)
  const { data: signInData, error: signInError } =
    await supabase.auth.signInWithPassword({
      email,
      password,
    })

  if (signInError) {
    return { error: signInError.message }
  }

  return { success: true }
}

export async function signIn(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string).toLowerCase().trim()
  const password = formData.get('password') as string

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: "Invalid email or password" }
  }

  return { success: true, session: data.session }
}

export async function signOut() {
  const supabase = await createClient()

  const { error } = await supabase.auth.signOut()

  if (error) {
    return { error: error.message }
  }

  redirect('/')
}

export async function resetPassword(formData: FormData) {
  const supabase = await createClient()

  const email = (formData.get('email') as string).toLowerCase().trim()
  const origin = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${origin}/reset-password`,
  })

  if (error) {
    return { error: error.message }
  }

  return { success: true, message: 'Password reset link sent to your email!' }
}
