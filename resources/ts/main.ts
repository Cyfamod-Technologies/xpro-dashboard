import App from "@/App.vue"
import { registerPlugins } from "@core/utils/plugins"

// Styles
import "@core-scss/template/index.scss"
import "@styles/styles.scss"
import { isDemoMode } from "@/utils/demo-mode"
import { mockApiBase } from "@/mocks/api-base"

const apiBase = new URL(mockApiBase)
const apiBasePath = apiBase.pathname.replace(/\/+$/, "")
const rootApiPath =
  /^\/(?:auth|admin|requests|request|providers|me|services|locations|featured-providers|uploads|catalog|staff|notifications|payments|quotes)(?:\/|$)/

const isApiRequest = (request: Request) => {
  const url = new URL(request.url)

  if (url.origin !== apiBase.origin) return false
  if (apiBasePath) return url.pathname === apiBasePath || url.pathname.startsWith(`${apiBasePath}/`)

  // When the API URL is omitted, Vite and MSW share an origin. Let app pages,
  // module files and static assets reach Vite, while keeping API calls strict.
  return url.origin !== location.origin || rootApiPath.test(url.pathname)
}

async function bootstrap() {
  if (isDemoMode) {
    const { worker } = await import("@/mocks/browser")

    await worker.start({
      onUnhandledRequest(request, print) {
        if (isApiRequest(request)) print.error()
      },
    })
  } else if ("serviceWorker" in navigator) {
    try {
      const registrations = await navigator.serviceWorker.getRegistrations()
      const mockRegistrations = registrations.filter(registration =>
        [registration.active, registration.waiting, registration.installing].some(worker =>
          worker?.scriptURL.endsWith("/mockServiceWorker.js"),
        ),
      )
      if (mockRegistrations.length) {
        await Promise.all(mockRegistrations.map(registration => registration.unregister()))
        if (navigator.serviceWorker.controller?.scriptURL.endsWith("/mockServiceWorker.js")) {
          window.location.reload()

          return
        }
      }
    } catch {
      // Service worker cleanup must not prevent the live application from loading.
    }
  }

  const app = createApp(App)

  registerPlugins(app)
  app.mount("#app")
}

bootstrap()
