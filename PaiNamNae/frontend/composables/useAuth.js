import { useState, useCookie, useNuxtApp, navigateTo } from '#app'

export function useAuth() {
  const { $api } = useNuxtApp()

  // ใช้ useState เพื่อไม่ให้ state หายตอนเปลี่ยนหน้า
  const token = useState('token', () => null)
  const user = useState('user', () => null)

  // ใช้ cookie เป็นตัวกลางให้ middleware อ่านได้
  const tokenCookie = useCookie('token')

  // โหลดค่าตอน client mount
  if (process.client && !token.value) {
    const savedToken = tokenCookie.value || localStorage.getItem('token')
    const savedUser = localStorage.getItem('user')

    if (savedToken) {
      token.value = savedToken
      tokenCookie.value = savedToken
    }

    if (savedUser) {
      user.value = JSON.parse(savedUser)
    }
  }

  const login = async (identifier, password) => {
    const payload = { password }

    if (identifier.includes('@')) {
      payload.email = identifier
    } else {
      payload.username = identifier
    }

    const res = await $api('/auth/login', {
      method: 'POST',
      body: payload,
    })

    token.value = res.token
    user.value = res.user

    // เก็บลง cookie
    tokenCookie.value = res.token

    if (process.client) {
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
    }

    return res
  }

  const logout = () => {
    token.value = null
    user.value = null
    tokenCookie.value = null

    if (process.client) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    }

    return navigateTo('/login')
  }

  return {
    token,
    user,
    login,
    logout,
  }
}
