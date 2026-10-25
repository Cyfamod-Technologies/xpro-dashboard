/** Demo behavior is opt-in in the built client. */
export const isDemoMode = import.meta.env.VITE_ENABLE_MOCKS === "true"
