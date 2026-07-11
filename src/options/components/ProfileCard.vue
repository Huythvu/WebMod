<script setup>
import { computed } from 'vue'

const props = defineProps({ profile: { type: Object, required: true } })
const emit = defineEmits(['edit', 'duplicate', 'export', 'delete', 'toggle'])

const matchSummary = computed(() =>
  props.profile.matches.map((m) => m.value).filter(Boolean).join(', ') || 'no rules'
)
const modified = computed(() => {
  const d = props.profile.updatedAt ? new Date(props.profile.updatedAt) : null
  return d ? d.toLocaleString() : '—'
})
</script>

<template>
  <div class="card" :class="{ disabled: !profile.enabled }">
    <div class="card-main">
      <div class="title-row">
        <span class="status-dot" :class="{ on: profile.enabled }" :title="profile.enabled ? 'Enabled' : 'Disabled'"></span>
        <h3>{{ profile.name }}</h3>
        <span class="version">v{{ profile.version }}</span>
      </div>
      <p v-if="profile.description" class="desc">{{ profile.description }}</p>
      <p class="match" :title="matchSummary">🎯 {{ matchSummary }}</p>
      <p class="modified">Last modified: {{ modified }}</p>
    </div>
    <div class="card-actions">
      <button @click="emit('edit', profile.id)">Edit</button>
      <button @click="emit('toggle', profile)">{{ profile.enabled ? 'Disable' : 'Enable' }}</button>
      <button @click="emit('duplicate', profile.id)">Duplicate</button>
      <button @click="emit('export', profile)">Export</button>
      <button class="danger" @click="emit('delete', profile)">Delete</button>
    </div>
  </div>
</template>

<style scoped>
.card {
  border: 1px solid var(--wm-border);
  border-radius: 10px;
  padding: 14px 16px;
  background: var(--wm-panel);
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.card.disabled { opacity: 0.6; }
.title-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.title-row h3 {
  margin: 0;
  font-size: 15px;
  flex: 1;
}
.version {
  font-size: 11px;
  color: var(--wm-muted);
}
.status-dot {
  width: 9px;
  height: 9px;
  border-radius: 50%;
  background: #6b7280;
  flex: 0 0 auto;
}
.status-dot.on { background: #37c05b; }
.desc {
  margin: 0;
  font-size: 13px;
  color: var(--wm-text);
}
.match,
.modified {
  margin: 0;
  font-size: 12px;
  color: var(--wm-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.card-actions button {
  background: var(--wm-input);
  border: 1px solid var(--wm-border);
  color: var(--wm-text);
  border-radius: 6px;
  padding: 5px 10px;
  font-size: 12px;
  cursor: pointer;
}
.card-actions button:hover { border-color: var(--wm-accent); }
.card-actions button.danger:hover { border-color: #e5534b; color: #e5534b; }
</style>
