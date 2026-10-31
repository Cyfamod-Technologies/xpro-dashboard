<script setup lang="ts">
import type { PublicServiceNode } from "@/features/catalog/types"
import { leafIdsOf } from "@/features/catalog/types"

/**
 * The sub-service tree under one top-level service, as the admin built it, with no questions. A leaf is a checkbox;
 * a node with children is a group whose checkbox selects or clears every leaf below it (indeterminate when partly
 * selected) and whose chevron expands it. Nesting is recursive, so any depth works.
 */
const props = defineProps<{
  nodes: PublicServiceNode[]
  selected: string[]

  /** Ids to show while searching (matches, their ancestors and their descendants); null shows everything. */
  visible: Set<string> | null
}>()
const emit = defineEmits<{ toggle: [leafIds: string[], on: boolean] }>()

const chosen = computed(() => new Set(props.selected))
const shown = computed(() => props.nodes.filter(node => !props.visible || props.visible.has(node.id)))

// Groups that already hold a selected leaf start open; searching opens everything that is still visible.
const open = ref<string[]>(
  props.nodes.filter(node => leafIdsOf(node).some(id => chosen.value.has(id))).map(node => node.id),
)
const isOpen = (node: PublicServiceNode) => Boolean(props.visible) || open.value.includes(node.id)
const toggleOpen = (node: PublicServiceNode) => {
  open.value = open.value.includes(node.id) ? open.value.filter(id => id !== node.id) : [...open.value, node.id]
}

const stateOf = (node: PublicServiceNode): "all" | "some" | "none" => {
  const leaves = leafIdsOf(node)
  const count = leaves.filter(id => chosen.value.has(id)).length

  return count === 0 ? "none" : count === leaves.length ? "all" : "some"
}
const countOf = (node: PublicServiceNode) => leafIdsOf(node).filter(id => chosen.value.has(id)).length
const panelId = (node: PublicServiceNode) => `catalog-group-${node.id}`
</script>

<template>
  <div class="skill-tree">
    <template v-for="node in shown" :key="node.id">
      <VCheckbox
        v-if="!node.children.length"
        :model-value="chosen.has(node.id)"
        :label="node.name"
        density="compact"
        hide-details
        @update:model-value="emit('toggle', [node.id], Boolean($event))"
      />
      <div v-else class="skill-tree__group">
        <div class="skill-tree__header">
          <VCheckbox
            :model-value="stateOf(node) === 'all'"
            :indeterminate="stateOf(node) === 'some'"
            :label="node.name"
            density="compact"
            hide-details
            @update:model-value="emit('toggle', leafIdsOf(node), stateOf(node) !== 'all')"
          />
          <span v-if="countOf(node)" class="text-caption text-medium-emphasis">{{ countOf(node) }} selected</span>
          <VBtn
            :icon="isOpen(node) ? 'tabler-chevron-up' : 'tabler-chevron-down'"
            :aria-label="`${isOpen(node) ? 'Collapse' : 'Expand'} ${node.name}`"
            :aria-expanded="isOpen(node)"
            :aria-controls="panelId(node)"
            variant="text"
            size="small"
            density="comfortable"
            @click="toggleOpen(node)"
          />
        </div>
        <div v-if="isOpen(node)" :id="panelId(node)" role="group" :aria-label="node.name" class="skill-tree__children">
          <CatalogSkillTree
            :nodes="node.children"
            :selected="selected"
            :visible="visible"
            @toggle="(leafIds, on) => emit('toggle', leafIds, on)"
          />
        </div>
      </div>
    </template>
  </div>
</template>

<style lang="scss" scoped>
.skill-tree {
  display: grid;
  gap: 0.125rem;
}

.skill-tree__header {
  align-items: center;
  display: flex;
  gap: 0.5rem;

  :deep(.v-checkbox) {
    flex: 1;
  }
}

.skill-tree__children {
  padding-inline-start: 1.75rem;
}
</style>
