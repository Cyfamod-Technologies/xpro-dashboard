import App from "@/App.vue"
import { registerPlugins } from "@core/utils/plugins"

// Styles
import "@core-scss/template/index.scss"
import "@styles/styles.scss"

async function bootstrap() {
  if (import.meta.env.VITE_ENABLE_MOCKS !== "false") {
    const { worker } = await import("@/mocks/browser")

    await worker.start({ onUnhandledRequest: "bypass" })
  }

  const app = createApp(App)

  registerPlugins(app)
  app.mount("#app")
}

bootstrap()
