<script setup>
import { ref, computed } from 'vue'
import ProfileList from './components/ProfileList.vue'
import ProfileEditor from './components/ProfileEditor.vue'
import { useProfiles } from './composables/useProfiles.js'
import { createDefaultProfile, serializeProfile, serializeBackup, parseImport } from '../lib/profile.js'

const { profiles, paused, saveProfile, removeProfile, duplicateProfile, importProfiles, togglePaused } = useProfiles()

const editingId = ref(null)
const editingProfile = computed(() => profiles.value.find((p) => p.id === editingId.value) || null)

// Theme (dark by default), persisted in localStorage.
const dark = ref(localStorage.getItem('webmod:theme') !== 'light')
function toggleTheme() {
  dark.value = !dark.value
  localStorage.setItem('webmod:theme', dark.value ? 'dark' : 'light')
}

async function createProfile() {
  const p = createDefaultProfile()
  await saveProfile(p)
  editingId.value = p.id
}

async function onToggle(profile) {
  await saveProfile({ ...profile, enabled: !profile.enabled })
}

async function onDelete(profile) {
  if (confirm(`Delete profile "${profile.name}"? This cannot be undone.`)) {
    await removeProfile(profile.id)
  }
}

function download(filename, text) {
  const blob = new Blob([text], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function slug(s) {
  return (s || 'profile').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function onExport(profile) {
  download(`webmod-${slug(profile.name)}.json`, serializeProfile(profile))
}

function exportAll() {
  download('webmod-backup.json', serializeBackup(profiles.value))
}

const fileInput = ref(null)
function triggerImport() {
  fileInput.value?.click()
}
async function onImportFile(e) {
  const file = e.target.files?.[0]
  if (!file) return
  try {
    const text = await file.text()
    const { profiles: imported } = parseImport(text)
    await importProfiles(imported)
    alert(`Imported ${imported.length} profile(s).`)
  } catch (err) {
    alert('Import failed: ' + err.message)
  } finally {
    e.target.value = ''
  }
}
</script>

<template>
  <div class="app" :class="dark ? 'theme-dark' : 'theme-light'">
    <header class="topbar">
      <div class="brand">
        <span class="logo">🧩</span>
        <div>
          <h1>WebMod</h1>
          <p>Universal website customizer</p>
        </div>
      </div>
      <div class="toolbar">
        <label class="pause">
          <input type="checkbox" :checked="paused" @change="togglePaused" />
          <span>{{ paused ? 'All customizations paused' : 'Pause all' }}</span>
        </label>
        <button @click="triggerImport">Import</button>
        <button @click="exportAll">Backup all</button>
        <button @click="toggleTheme">{{ dark ? '☀️ Light' : '🌙 Dark' }}</button>
        <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="onImportFile" />
      </div>
    </header>

    <main class="content">
      <ProfileEditor
        v-if="editingProfile"
        :key="editingProfile.id"
        :profile="editingProfile"
        :dark="dark"
        @close="editingId = null"
      />
      <ProfileList
        v-else
        :profiles="profiles"
        @create="createProfile"
        @edit="editingId = $event"
        @duplicate="duplicateProfile"
        @export="onExport"
        @delete="onDelete"
        @toggle="onToggle"
      />
    </main>
  </div>
</template>

<style>
:root {
  --wm-accent: #4f7cff;
}
.theme-dark {
  --wm-bg: #16181d;
  --wm-panel: #1e2128;
  --wm-input: #262a33;
  --wm-border: #333844;
  --wm-text: #e6e8ee;
  --wm-muted: #9aa1ad;
}
.theme-light {
  --wm-bg: #f5f6f8;
  --wm-panel: #ffffff;
  --wm-input: #f0f1f4;
  --wm-border: #d9dce2;
  --wm-text: #1b1d22;
  --wm-muted: #6b7280;
}
html,
body,
#app {
  height: 100%;
  margin: 0;
}
body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}
.app {
  min-height: 100vh;
  background: var(--wm-bg);
  color: var(--wm-text);
  display: flex;
  flex-direction: column;
}
.topbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 22px;
  border-bottom: 1px solid var(--wm-border);
  background: var(--wm-panel);
}
.brand {
  display: flex;
  align-items: center;
  gap: 12px;
}
.logo { font-size: 26px; }
.brand h1 {
  margin: 0;
  font-size: 18px;
}
.brand p {
  margin: 0;
  font-size: 12px;
  color: var(--wm-muted);
}
.toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
}
.toolbar button {
  background: var(--wm-input);
  border: 1px solid var(--wm-border);
  color: var(--wm-text);
  border-radius: 7px;
  padding: 7px 12px;
  font-size: 13px;
  cursor: pointer;
}
.toolbar button:hover { border-color: var(--wm-accent); }
.pause {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: var(--wm-muted);
  margin-right: 6px;
}
.content {
  flex: 1;
  min-height: 0;
  padding: 22px;
  max-width: 1200px;
  width: 100%;
  margin: 0 auto;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}
</style>
