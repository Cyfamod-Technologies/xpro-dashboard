<script setup lang="ts">
import AccountPhoneVerification from "@/features/phone/AccountPhoneVerification.vue"
import AccountWorkspaces from "@/features/account/AccountWorkspaces.vue"
import ProviderProfile from "@/features/operations/ProviderProfile.vue"
import PayoutDetails from "@/features/operations/PayoutDetails.vue"

type SettingsTab = "account" | "profile" | "payout"

const route = useRoute()
const router = useRouter()
const tabFromQuery = (value: unknown): SettingsTab => (value === "profile" || value === "payout" ? value : "account")
const activeTab = ref<SettingsTab>(tabFromQuery(route.query.tab))

watch(activeTab, value => {
  const query = { ...route.query }
  if (value === "account") delete query.tab
  else query.tab = value
  router.replace({ query })
})

watch(
  () => route.query.tab,
  value => {
    activeTab.value = tabFromQuery(value)
  },
)
</script>

<template>
  <div>
    <VTabs v-model="activeTab" class="mb-5" aria-label="Provider settings">
      <VTab value="account">Account</VTab>
      <VTab value="profile">Profile &amp; verification</VTab>
      <VTab value="payout">Payout details</VTab>
    </VTabs>
    <VWindow v-model="activeTab">
      <VWindowItem value="account">
        <div class="d-flex flex-column ga-6">
          <AccountPhoneVerification />
          <AccountWorkspaces />
        </div>
      </VWindowItem>
      <VWindowItem value="profile">
        <ProviderProfile v1-mode />
      </VWindowItem>
      <VWindowItem value="payout">
        <PayoutDetails />
      </VWindowItem>
    </VWindow>
  </div>
</template>
