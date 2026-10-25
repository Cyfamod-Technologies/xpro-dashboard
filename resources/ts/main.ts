import App from "@/App.vue"
import { registerPlugins } from "@core/utils/plugins"

// Styles
import "@core-scss/template/index.scss"
import "@styles/styles.scss"
import { isDemoMode } from "@/utils/demo-mode"

async function bootstrap() {
  if (isDemoMode) {
    const { worker } = await import("@/mocks/browser")

    await worker.start({ onUnhandledRequest: "bypass" })
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
