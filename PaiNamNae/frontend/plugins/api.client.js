export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const api = $fetch.create({
    baseURL: config.public.apiBase,
    credentials: 'include',

    async onRequest({ options }) {
      if (process.client) {
        const token = localStorage.getItem('token')

        if (token) {
          options.headers = {
            ...options.headers,
            Authorization: `Bearer ${token}`,
          }
        }
      }
    },

    onResponse({ response }) {
      if (
        response._data &&
        typeof response._data === 'object' &&
        Object.prototype.hasOwnProperty.call(response._data, 'data')
      ) {
        response._data = response._data.data
      }
    },

    onResponseError({ response }) {
      let body = response?._data

      if (typeof body === 'string') {
        try {
          body = JSON.parse(body)
        } catch {}
      }

      const msg =
        body?.message ||
        body?.error?.message ||
        body?.error ||
        response?.statusText ||
        'Request failed'

      throw createError({
        statusCode: response?.status || 500,
        statusMessage: msg,
        data: body,
      })
    },
  })

  return {
    provide: { api },
  }
})
