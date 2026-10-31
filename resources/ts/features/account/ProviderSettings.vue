<script setup lang="ts">
import AccountPhoneVerification from "@/features/phone/AccountPhoneVerification.vue"
import AccountWorkspaces from "@/features/account/AccountWorkspaces.vue"
import ProviderProfile from "@/features/operations/ProviderProfile.vue"

type SettingsTab = "account" | "profile"

const route = useRoute()
const router = useRouter()
const activeTab = ref<SettingsTab>(route.query.tab === "profile" ? "profile" : "account")

watch(activeTab, value => {
  const query = { ...route.query }
  if (value === "profile") query.tab = value
  else delete query.tab
  router.replace({ query })
})

watch(
  () => route.query.tab,
  value => {
    activeTab.value = value === "profile" ? "profile" : "account"
  },
)
</script>

<template>
  <div>
    <VTabs v-model="activeTab" class="mb-5" aria-label="Provider settings">
      <VTab value="account">Account</VTab>
      <VTab value="profile">Profile &amp; verification</VTab>
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
    </VWindow>
  </div>
</template>
