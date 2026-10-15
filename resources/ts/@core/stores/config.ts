import { storeToRefs } from "pinia"
import { useTheme } from "vuetify"
import { cookieRef, useLayoutConfigStore } from "@layouts/stores/config"
import { themeConfig } from "@themeConfig"

// SECTION Store
export const useConfigStore = defineStore("config", () => {
  // 👉 Theme
  // Light is the only user-facing theme for the first release. Keeping this as
  // config state means dark mode can be restored later without deleting its tokens.
  const theme = cookieRef("theme", "light")

  theme.value = "light"

  // 👉 isVerticalNavSemiDark
  const isVerticalNavSemiDark = cookieRef("isVerticalNavSemiDark", themeConfig.verticalNav.isVerticalNavSemiDark)

  // 👉 isVerticalNavSemiDark
  const skin = cookieRef("skin", themeConfig.app.skin)

  // ℹ️ We need to use `storeToRefs` to forward the state
  const {
    isLessThanOverlayNavBreakpoint,
    appContentWidth,
    navbarType,
    isNavbarBlurEnabled,
    appContentLayoutNav,
    isVerticalNavCollapsed,
    footerType,
    isAppRTL,
  } = storeToRefs(useLayoutConfigStore())

  return {
    theme,
    isVerticalNavSemiDark,
    skin,

    // @layouts exports
    isLessThanOverlayNavBreakpoint,
    appContentWidth,
    navbarType,
    isNavbarBlurEnabled,
    appContentLayoutNav,
    isVerticalNavCollapsed,
    footerType,
    isAppRTL,
  }
})
// !SECTION

// SECTION Init
export const initConfigStore = () => {
  const vuetifyTheme = useTheme()

  vuetifyTheme.change("light")
}
// !SECTION
