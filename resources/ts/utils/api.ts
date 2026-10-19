import { ofetch } from "ofetch"

export const $api = ofetch.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
  async onRequest({ options }) {
    const accessToken = useCookie("accessToken").value
    options.headers.set("X-XPro-Client", "web")
    if (accessToken && !options.headers.has("Authorization"))
      options.headers.set("Authorization", `Bearer ${accessToken}`)
  },
})
