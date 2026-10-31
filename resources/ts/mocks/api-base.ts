// MSW routes must be scoped to the API origin. An origin wildcard also catches Vite's
// `/resources/ts/...` module requests when the app runs in development.
const configuredApiBase = import.meta.env?.VITE_API_BASE_URL?.trim()
const fallbackOrigin = typeof location === "undefined" ? "http://localhost" : location.origin

export const mockApiBase = (configuredApiBase || fallbackOrigin).replace(/\/$/, "")
