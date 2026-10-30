<script setup lang="ts">
import { accountApi } from "@/services/account-api"
import type { SessionView, SignInEvent } from "@/services/account-api"
import { when } from "@/features/operations/types"
import { useAuthStore } from "@/stores/auth"
import { getErrorMessage } from "@/utils/errors"

const auth = useAuthStore()
const router = useRouter()

const sessions = ref<SessionView[]>([])
const signIns = ref<SignInEvent[]>([])
const loading = ref(true)
const error = ref("")
const revoking = ref("")
const others = computed(() => sessions.value.filter(session => !session.current))
const recentSignIns = computed(() => signIns.value.slice(0, 5))

async function load() {
  loading.value = true
  error.value = ""
  try {
    const [sessionList, history] = await Promise.all([accountApi.sessions(), accountApi.signIns()])

    sessions.value = sessionList.data
    signIns.value = history.data
  } catch (cause) {
    error.value = getErrorMessage(cause, "Your sessions could not be loaded.")
  } finally {
    loading.value = false
  }
}

async function signOutOthers() {
  revoking.value = "all"
  error.value = ""
  try {
    for (const session of others.value) await accountApi.revokeSession(session.sessionId)
    await load()
  } catch (cause) {
    error.value = getErrorMessage(cause, "Other devices could not be signed out.")
  } finally {
    revoking.value = ""
  }
}

async function signOut(session: SessionView) {
  revoking.value = session.sessionId
  error.value = ""
  try {
    await accountApi.revokeSession(session.sessionId)
    await load()
  } catch (cause) {
    error.value = getErrorMessage(cause, "That device could not be signed out.")
  } finally {
    revoking.value = ""
  }
}

const dialog = ref(false)
const current = ref("")
const next = ref("")
const confirm = ref("")
const saving = ref(false)
const formError = ref("")
const done = ref(false)
const newPasswordError = computed(() =>
  !next.value
    ? ""
    : next.value.length < 8
      ? "Use at least 8 characters."
      : next.value === current.value
        ? "Choose a password you haven't used here before."
        : "",
)
const confirmError = computed(() => (confirm.value && confirm.value !== next.value ? "The passwords don't match." : ""))
const canSave = computed(
  () => Boolean(current.value) && next.value.length >= 8 && !newPasswordError.value && next.value === confirm.value,
)

function openDialog() {
  current.value = ""
  next.value = ""
  confirm.value = ""
  formError.value = ""
  done.value = false
  dialog.value = true
}

async function changePassword() {
  if (!canSave.value) return
  saving.value = true
  formError.value = ""
  try {
    await accountApi.changePassword(current.value, next.value)
    done.value = true
    // The server ends every session, so this one is already invalid; send them to sign in again.
    setTimeout(() => {
      auth.logout()
      router.push("/login")
    }, 2000)
  } catch (cause) {
    formError.value = getErrorMessage(cause, "Your password could not be changed.")
  } finally {
    saving.value = false
  }
}

onMounted(load)
</script>

<template>
  <VCard>
    <VCardText>
      <h2 class="text-h5 mb-1">Security</h2>
      <p class="text-body-2 text-medium-emphasis mb-4">Protect your staff account.</p>
      <VAlert v-if="error" type="error" variant="tonal" class="mb-4">{{ error }}</VAlert>

      <div class="security-row">
        <div>
          <div class="text-body-1">Password</div>
          <div class="text-body-2 text-medium-emphasis">Changing it signs you out on every device.</div>
        </div>
        <VBtn variant="outlined" size="small" @click="openDialog">Change password</VBtn>
      </div>

      <div class="security-row">
        <div>
          <div class="text-body-1">Two-step sign-in</div>
          <div class="text-body-2 text-medium-emphasis">
            {{
              auth.user?.mfaRequired
                ? "An authenticator app is set up. To reset it, ask another super admin."
                : "No authenticator app yet. You'll be asked to set one up when you next sign in."
            }}
          </div>
        </div>
        <VChip size="small" variant="tonal" :color="auth.user?.mfaRequired ? 'success' : 'warning'">{{
          auth.user?.mfaRequired ? "On" : "Not set up"
        }}</VChip>
      </div>

      <div class="security-row security-row--stack">
        <div class="d-flex align-center justify-space-between flex-wrap ga-2">
          <div>
            <div class="text-body-1">Devices and sessions</div>
            <div class="text-body-2 text-medium-emphasis">Where you're signed in right now.</div>
          </div>
          <VBtn
            v-if="others.length"
            variant="outlined"
            size="small"
            :loading="revoking === 'all'"
            :disabled="!!revoking"
            @click="signOutOthers"
            >Sign out other devices</VBtn
          >
        </div>
        <VProgressLinear v-if="loading" indeterminate class="mt-3" />
        <div v-else class="d-flex flex-column ga-2 mt-3">
          <div v-for="session in sessions" :key="session.sessionId" class="session-item">
            <div>
              <span class="text-body-2">Signed in {{ when(session.createdAt) }}</span>
              <VChip v-if="session.current" size="x-small" color="primary" variant="tonal" class="ms-2"
                >This device</VChip
              >
            </div>
            <VBtn
              v-if="!session.current"
              variant="text"
              size="small"
              :loading="revoking === session.sessionId"
              :disabled="!!revoking"
              @click="signOut(session)"
              >Sign out</VBtn
            >
          </div>
          <p v-if="!sessions.length" class="text-body-2 text-medium-emphasis mb-0">No active sessions found.</p>
        </div>
      </div>

      <div class="security-row security-row--stack">
        <div>
          <div class="text-body-1">Recent sign-ins</div>
          <div class="text-body-2 text-medium-emphasis">Your most recent sign-ins.</div>
        </div>
        <div class="d-flex flex-column ga-1 mt-3">
          <div v-for="(event, index) in recentSignIns" :key="index" class="text-body-2">
            {{ when(event.createdAt) }}
            <span v-if="event.ipAddress" class="text-medium-emphasis">· {{ event.ipAddress }}</span>
          </div>
          <p v-if="!loading && !recentSignIns.length" class="text-body-2 text-medium-emphasis mb-0">
            No sign-ins recorded yet.
          </p>
        </div>
      </div>
    </VCardText>
  </VCard>

  <VDialog v-model="dialog" max-width="440" :persistent="saving || done">
    <VCard>
      <VCardTitle>Change password</VCardTitle>
      <VCardText>
        <VAlert v-if="done" type="success" variant="tonal"
          >Password changed. Sign in again with your new password.</VAlert
        >
        <VForm v-else @submit.prevent="changePassword">
          <VAlert v-if="formError" type="error" variant="tonal" class="mb-4">{{ formError }}</VAlert>
          <AppTextField
            v-model="current"
            label="Current password"
            type="password"
            autocomplete="current-password"
            class="mb-3"
          />
          <AppTextField
            v-model="next"
            label="New password"
            type="password"
            autocomplete="new-password"
            :error-messages="newPasswordError"
            class="mb-3"
          />
          <AppTextField
            v-model="confirm"
            label="Confirm new password"
            type="password"
            autocomplete="new-password"
            :error-messages="confirmError"
            class="mb-4"
          />
          <p class="text-body-2 text-medium-emphasis">You'll be signed out on every device after changing it.</p>
          <div class="d-flex justify-end ga-2">
            <VBtn variant="text" :disabled="saving" @click="dialog = false">Cancel</VBtn>
            <VBtn type="submit" :loading="saving" :disabled="!canSave">Change password</VBtn>
          </div>
        </VForm>
      </VCardText>
    </VCard>
  </VDialog>
</template>

<style scoped>
.security-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-top: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.security-row--stack {
  display: block;
}

.session-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
</style>
