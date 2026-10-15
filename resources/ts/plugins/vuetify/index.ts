import type { App } from "vue"
import { createVuetify } from "vuetify"
import { VBtn } from "vuetify/components/VBtn"
import { VVideo } from "vuetify/labs/VVideo"
import defaults from "./defaults"
import { icons } from "./icons"
import { themes } from "./theme"

// Styles
import "@core-scss/template/libs/vuetify/index.scss"
import "vuetify/styles"

export default function (app: App) {
  const optionTheme = {
    // Do not allow an old theme cookie or the device preference to produce a
    // dark-mode or legacy template-colour flash while light mode is the only
    // supported UI theme.
    defaultTheme: "light",
    themes,
  }

  const vuetify = createVuetify({
    aliases: {
      IconBtn: VBtn,
    },
    components: {
      VVideo,
    },
    defaults,
    icons,
    theme: optionTheme,
  })

  app.use(vuetify)
}
