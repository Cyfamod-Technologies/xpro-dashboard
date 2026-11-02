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
const mfaSetup = ref<{ secret: string; otpauthUrl: string }>()
const mfaCode = ref("")
const mfaBusy = ref(false)
const mfaError = ref("")
const mfaNotice = ref("")
const disableDialog = ref(false)
const disablePassword = ref("")
const disableCode = ref("")
const mfaEnabled = computed(() => auth.user?.mfaRequired === true)

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

async function beginMfaSetup() {
  mfaBusy.value = true
  mfaError.value = ""
  mfaNotice.value = ""
  try {
    mfaSetup.value = (await accountApi.setupMfa()).data
    mfaCode.value = ""
  } catch (cause) {
    mfaError.value = getErrorMessage(cause, "MFA setup could not be started.")
  } finally {
    mfaBusy.value = false
  }
}

async function confirmMfaSetup() {
  if (!/^\d{6}$/.test(mfaCode.value.trim())) return
  mfaBusy.value = true
  mfaError.value = ""
  try {
    await accountApi.confirmMfa(mfaCode.value.trim())
    await auth.refreshUser()
    mfaSetup.value = undefined
    mfaCode.value = ""
    mfaNotice.value = "Two-step sign-in is enabled. You'll need an authenticator code next time you sign in."
  } catch (cause) {
    mfaError.value = getErrorMessage(cause, "The authenticator code could not be verified.")
  } finally {
    mfaBusy.value = false
  }
}

async function disableMfa() {
  if (!disablePassword.value || !/^\d{6}$/.test(disableCode.value.trim())) return
  mfaBusy.value = true
  mfaError.value = ""
  try {
    await accountApi.disableMfa(disablePassword.value, disableCode.value.trim())
    await auth.refreshUser()
    disableDialog.value = false
    disablePassword.value = ""
    disableCode.value = ""
    mfaNotice.value = "Two-step sign-in is off."
  } catch (cause) {
    mfaError.value = getErrorMessage(cause, "Two-step sign-in could not be disabled.")
  } finally {
    mfaBusy.value = false
  }
}

function closeMfaSetup() {
  mfaSetup.value = undefined
  mfaCode.value = ""
  mfaError.value = ""
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
              mfaEnabled
                ? "An authenticator app is set up and required at sign-in. You can turn it off here."
                : "Optional. Set up an authenticator app whenever you want extra protection at sign-in."
            }}
          </div>
        </div>
        <div class="d-flex align-center ga-2">
          <VChip size="small" variant="tonal" :color="mfaEnabled ? 'success' : 'secondary'">{{
            mfaEnabled ? "On" : "Off"
          }}</VChip>
          <VBtn v-if="mfaEnabled" variant="outlined" size="small" :disabled="mfaBusy" @click="disableDialog = true">
            Turn off
          </VBtn>
          <VBtn v-else variant="outlined" size="small" :loading="mfaBusy" @click="beginMfaSetup"> Set up </VBtn>
        </div>
      </div>
      <VAlert v-if="mfaError" type="error" variant="tonal" class="mb-4">{{ mfaError }}</VAlert>
      <VAlert v-if="mfaNotice" type="success" variant="tonal" class="mb-4">{{ mfaNotice }}</VAlert>
      <VCard v-if="mfaSetup" variant="outlined" class="mb-4">
        <VCardText>
          <h3 class="text-subtitle-1 mb-2">Set up an authenticator app</h3>
          <p class="text-body-2 text-medium-emphasis">
            Add this key to your authenticator app, then enter the six-digit code it generates.
          </p>
          <AppTextField :model-value="mfaSetup.secret" label="Setup key" readonly class="mb-4" />
          <AppTextField
            v-model="mfaCode"
            label="Authenticator code"
            inputmode="numeric"
            maxlength="6"
            class="mb-4"
            @keydown.enter.prevent="confirmMfaSetup"
          />
          <div class="d-flex flex-wrap ga-2">
            <VBtn :loading="mfaBusy" :disabled="!/^\d{6}$/.test(mfaCode.trim())" @click="confirmMfaSetup">
              Verify and enable
            </VBtn>
            <VBtn variant="text" :disabled="mfaBusy" @click="closeMfaSetup">Cancel</VBtn>
          </div>
        </VCardText>
      </VCard>

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

  <VDialog v-model="disableDialog" max-width="440" :persistent="mfaBusy">
    <VCard>
      <VCardTitle>Turn off two-step sign-in?</VCardTitle>
      <VCardText>
        <p class="text-body-2 text-medium-emphasis">Confirm with your password and current authenticator code.</p>
        <AppTextField v-model="disablePassword" label="Password" type="password" autocomplete="current-password" />
        <AppTextField v-model="disableCode" label="Authenticator code" inputmode="numeric" maxlength="6" class="mt-3" />
        <VAlert v-if="mfaError" type="error" variant="tonal" class="mt-3">{{ mfaError }}</VAlert>
      </VCardText>
      <VCardActions>
        <VSpacer />
        <VBtn variant="text" :disabled="mfaBusy" @click="disableDialog = false">Cancel</VBtn>
        <VBtn
          color="error"
          :loading="mfaBusy"
          :disabled="!disablePassword || !/^\d{6}$/.test(disableCode.trim())"
          @click="disableMfa"
          >Turn off</VBtn
        >
      </VCardActions>
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
