<script setup lang="ts">
import { useOperationsStore } from '@/stores/operations'
import type { Channel, ServiceRequest } from '@/features/operations/types'
import { when } from '@/features/operations/types'
import { visibleMessages } from '@/features/operations/workflow'
import { prepareFiles } from '@/features/operations/files'
import Attachments from '@/features/operations/Attachments.vue'

const props = defineProps<{ request: ServiceRequest }>()
const ops = useOperationsStore()
const channel = ref<Channel>(ops.actor?.role === 'provider' ? 'provider' : 'customer')
const text = ref('')
const files = ref<File[]>([])
const messages = computed(() => ops.actor ? visibleMessages(props.request, ops.actor, channel.value) : [])

const send = async () => {
  try {
    const attachments = await prepareFiles(files.value)
    if (await ops.run({ type: 'message.send', requestId: props.request.id, channel: channel.value, text: text.value, attachments })) {
      text.value = ''
      files.value = []
    }
  }
  catch (cause) { ops.error = cause instanceof Error ? cause.message : 'Unable to read files.' }
}
</script>

<template>
  <VCard>
    <VCardText>
      <VSelect
        v-if="ops.actor?.role === 'admin'"
        v-model="channel"
        label="Conversation audience"
        :items="[{ title: 'Customer ↔ XPro', value: 'customer' }, { title: 'Provider ↔ XPro', value: 'provider' }, { title: 'Internal XPro notes', value: 'internal' }]"
      />
      <VAlert
        variant="tonal"
        color="info"
        class="mb-5"
      >
        {{ channel === 'internal' ? 'Private XPro staff notes.' : channel === 'provider' ? 'This conversation is between the assigned provider and XPro.' : 'This conversation is between the customer and XPro.' }}
      </VAlert>
      <div
        v-for="message in messages"
        :key="message.id"
        class="message mb-4 pa-4 rounded"
      >
        <div class="d-flex justify-space-between flex-wrap gap-2 mb-2">
          <strong>{{ message.author }}</strong><small class="text-medium-emphasis">{{ when(message.createdAt) }}</small>
        </div><p class="message-text mb-0">
          {{ message.text }}
        </p><Attachments :files="message.attachments" />
      </div>
      <p
        v-if="!messages.length"
        class="text-medium-emphasis py-4"
      >
        No messages in this conversation yet.
      </p>
      <VTextarea
        v-model="text"
        label="Message"
        rows="3"
      /><VFileInput
        v-model="files"
        label="Attach files"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx,.xls,.xlsx,.mp4"
      /><VBtn
        :loading="ops.busy"
        prepend-icon="tabler-send"
        @click="send"
      >
        Send message
      </VBtn>
    </VCardText>
  </VCard>
</template>

<style scoped>
.message { background: rgba(var(--v-theme-primary), 0.06); }
.message-text { white-space: pre-wrap; overflow-wrap: anywhere; }
</style>
