<script setup lang="ts">
import type { ChatAudience } from "@/features/chat/chat-types"
import { initials } from "@/features/messages/messages-helpers"

export interface FocusOption {
  value: ChatAudience | null
  title: string
}

const props = defineProps<{
  requestId: string
  title: string
  subtitle: string
  customerName: string
  focus: ChatAudience | null
  focusOptions: FocusOption[]
  canClaim: boolean
  claiming: boolean
  /** Phone: show the back arrow. */
  showBack: boolean
  /** Phone and tablet: tapping the title opens the info screen or drawer. */
  opensInfo: boolean
  openTo: { path: string; query: Record<string, string> }
}>()
const emit = defineEmits<{ back: []; openInfo: []; claim: []; "update:focus": [value: ChatAudience | null] }>()

const { copy, copied } = useClipboard({ copiedDuring: 1800, legacy: true })
const focusTitle = computed(() => props.focusOptions.find(item => item.value === props.focus)?.title ?? "")
</script>

<template>
  <div class="conv-head-wrap">
    <div class="conv-head">
    <VBtn v-if="showBack" icon="tabler-arrow-left" variant="text" aria-label="Back to conversations" @click="emit('back')" />

    <component
      :is="opensInfo ? 'button' : 'div'"
      class="conv-head__identity"
      :class="{ 'conv-head__identity--button': opensInfo }"
      v-bind="opensInfo ? { type: 'button', 'aria-label': `${title}. Open request info` } : {}"
      @click="opensInfo && emit('openInfo')"
    >
      <VAvatar color="primary" variant="tonal" size="40" aria-hidden="true">
        <span class="text-body-1 font-weight-medium">{{ initials(customerName) }}</span>
      </VAvatar>
      <span class="conv-head__text">
        <span class="conv-head__title">{{ title }}</span>
        <span class="conv-head__subtitle">{{ subtitle }}</span>
      </span>
    </component>

    <VBtn v-if="canClaim" size="small" color="primary" variant="tonal" :loading="claiming" @click="emit('claim')">
      Claim
    </VBtn>

    <VMenu>
      <template #activator="{ props: menu }">
        <VBtn v-bind="menu" icon="tabler-dots-vertical" variant="text" aria-label="Conversation options" />
      </template>
      <VList density="compact" min-width="240">
        <VListItem :to="openTo" prepend-icon="tabler-external-link" title="Open request" />
        <VListItem
          prepend-icon="tabler-copy"
          :title="copied ? 'Copied' : 'Copy request id'"
          @click="copy(requestId)"
        />
        <VDivider class="my-1" />
        <VListSubheader>Show</VListSubheader>
        <VListItem
          v-for="option in focusOptions"
          :key="option.value ?? 'all'"
          :title="option.title"
          :active="option.value === focus"
          :aria-current="option.value === focus ? 'true' : undefined"
          @click="emit('update:focus', option.value)"
        >
          <template v-if="option.value === focus" #append>
            <VIcon icon="tabler-check" size="18" />
          </template>
        </VListItem>
      </VList>
    </VMenu>

    <span class="conv-head__sr" role="status" aria-live="polite">{{ copied ? "Request id copied" : "" }}</span>
    </div>
    <div v-if="focus" class="conv-head__focus">
      <VChip
        size="small"
        color="primary"
        variant="tonal"
        closable
        close-label="Show all messages"
        @click:close="emit('update:focus', null)"
      >
        {{ focusTitle }}
      </VChip>
    </div>
  </div>
</template>

<style scoped lang="scss">
.conv-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-inline-size: 0;
}

.conv-head__identity {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 12px;
  min-inline-size: 0;
  margin: 0;
  padding: 4px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: inherit;
  font: inherit;
  text-align: start;

  &--button {
    cursor: pointer;

    &:hover {
      background: rgba(var(--v-theme-on-surface), 0.05);
    }

    &:focus-visible {
      outline: 2px solid rgb(var(--v-theme-primary));
      outline-offset: 1px;
    }
  }
}

.conv-head__text {
  display: flex;
  flex-direction: column;
  min-inline-size: 0;
}

.conv-head__title {
  overflow: hidden;
  font-size: 1rem;
  font-weight: 600;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-head__subtitle {
  overflow: hidden;
  color: rgba(var(--v-theme-on-surface), var(--v-medium-emphasis-opacity));
  font-size: 0.8125rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.conv-head__focus {
  padding-block-start: 8px;
}

.conv-head__sr {
  position: absolute;
  overflow: hidden;
  clip: rect(0 0 0 0);
  block-size: 1px;
  inline-size: 1px;
  white-space: nowrap;
}
</style>
