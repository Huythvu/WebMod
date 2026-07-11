<script setup>
import { computed, ref } from 'vue'
import ProfileCard from './ProfileCard.vue'

const props = defineProps({ profiles: { type: Array, required: true } })
const emit = defineEmits(['edit', 'duplicate', 'export', 'delete', 'toggle', 'create'])

const query = ref('')
const filtered = computed(() => {
  const q = query.value.trim().toLowerCase()
  if (!q) return props.profiles
  return props.profiles.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      p.matches.some((m) => (m.value || '').toLowerCase().includes(q))
  )
})
</script>

<template>
  <div class="list">
    <div class="list-head">
      <input v-model="query" class="search" type="search" placeholder="Search profiles…" />
      <button class="primary" @click="emit('create')">+ New Profile</button>
    </div>

    <p v-if="profiles.length === 0" class="empty">
      No profiles yet. Create one, or import an existing profile from the toolbar above.
    </p>
    <p v-else-if="filtered.length === 0" class="empty">No profiles match "{{ query }}".</p>

    <div class="grid">
      <ProfileCard
        v-for="p in filtered"
        :key="p.id"
        :profile="p"
        @edit="emit('edit', $event)"
        @duplicate="emit('duplicate', $event)"
        @export="emit('export', $event)"
        @delete="emit('delete', $event)"
        @toggle="emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<style scoped>
.list-head {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
}
.search {
  flex: 1;
  background: var(--wm-input);
  border: 1px solid var(--wm-border);
  border-radius: 8px;
  color: var(--wm-text);
  padding: 9px 12px;
  font-size: 14px;
}
.primary {
  background: var(--wm-accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 14px;
  cursor: pointer;
  white-space: nowrap;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}
.empty {
  color: var(--wm-muted);
  font-size: 14px;
  padding: 24px 0;
}
</style>
