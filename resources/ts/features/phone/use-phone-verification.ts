import { type Ref, computed, onMounted, ref } from "vue"
import { type PhoneVerificationChallenge, authApi } from "@/services/xpro-api"
import { useAuthStore } from "@/stores/auth"
import { toApiError } from "@/utils/api"
import { normalizePhone } from "@/features/phone/phone"

export function usePhoneVerification(phone: Ref<string>) {
  const auth = useAuthStore()
  const loading = ref(true)
  const loadError = ref("")
  const sending = ref(false)
  const confirming = ref(false)
  const error = ref("")
  const codeError = ref("")
  const challenge = ref<PhoneVerificationChallenge | null>(null)
  const verified = computed(() =>
    Boolean(
      !loading.value &&
      !loadError.value &&
      auth.user?.phoneVerified &&
      auth.user.phoneVerifiedAt &&
      normalizePhone(phone.value) === auth.user.phone,
    ),
  )

  async function refresh() {
    loading.value = true
    loadError.value = ""
    try {
      await auth.refreshUser()
      if (!phone.value.trim()) phone.value = auth.user?.phone ?? ""
    } catch (cause) {
      loadError.value = toApiError(cause).message
    } finally {
      loading.value = false
    }
  }

  async function send() {
    if (sending.value || confirming.value) return
    sending.value = true
    error.value = ""
    codeError.value = ""
    try {
      const response = await authApi.startPhoneVerification(phone.value)

      challenge.value = response.data
      if (auth.user)
        Object.assign(auth.user, { phone: normalizePhone(phone.value), phoneVerified: false, phoneVerifiedAt: null })
    } catch (cause) {
      const failure = toApiError(cause)
      const details = failure.details as { resendAfter?: string } | undefined

      if (details?.resendAfter && challenge.value)
        challenge.value = { ...challenge.value, resendAfter: details.resendAfter }
      error.value = failure.message
      // A failed enqueue may still have changed the account's phone; re-read its status.
      try {
        await auth.refreshUser()
      } catch {
        loadError.value = "Unable to refresh phone verification. Try again."
      }
    } finally {
      sending.value = false
    }
  }

  async function confirm(code: string) {
    if (!challenge.value || sending.value || confirming.value) return
    confirming.value = true
    error.value = ""
    codeError.value = ""
    try {
      const response = await authApi.confirmPhoneVerification(challenge.value.verificationId, code)

      if (auth.user) Object.assign(auth.user, response.data)
      phone.value = response.data.phone
      challenge.value = null
    } catch (cause) {
      const failure = toApiError(cause)

      if (failure.status === 422) codeError.value = failure.message
      else error.value = failure.message
    } finally {
      confirming.value = false
    }
  }

  function close() {
    if (sending.value || confirming.value) return
    challenge.value = null
    error.value = ""
    codeError.value = ""
  }

  onMounted(refresh)

  return {
    loading,
    loadError,
    sending,
    confirming,
    error,
    codeError,
    challenge,
    verified,
    refresh,
    send,
    confirm,
    close,
  }
}
