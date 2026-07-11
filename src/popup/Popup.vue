<script setup>
import { ref, onMounted } from 'vue'
import { getAllProfiles, isPaused, setPaused, saveProfile } from '../lib/storage.js'
import { profileMatchesUrl } from '../lib/matcher.js'
import { MSG, sendToBackground } from '../lib/messaging.js'

const url = ref('')
const matching = ref([]) // profiles whose rules match the current tab
const paused = ref(false)
const loading = ref(true)

async function load() {
  loading.value = true
  const [profiles, p] = await Promise.all([getAllProfiles(), isPaused()])
  paused.value = p
  const tab = await new Promise((res) => chrome.tabs.query({ active: true, currentWindow: true }, (t) => res(t[0])))
  url.value = tab?.url || ''
  matching.value = url.value ? profiles.filter((pr) => profileMatchesUrl(pr, url.value)) : []
  loading.value = false
}

async function toggle(profile) {
  // saveProfile returns a plain (de-proxied) profile — safe to send across contexts.
  const saved = await saveProfile({ ...profile, enabled: !profile.enabled })
  // Live-apply to the current tab.
  sendToBackground({ type: MSG.PROFILE_SAVED, profile: saved })
  await load()
}

async function togglePause() {
  await setPaused(!paused.value)
  await load()
}

function openDashboard() {
  chrome.runtime.openOptionsPage()
}

onMounted(load)
</script>

<template>
  <div class="popup">
    <header>
      <span class="logo">🧩</span>
      <strong>WebMod</strong>
      <button class="open" @click="openDashboard">Dashboard →</button>
    </header>

    <label class="pause">
      <input type="checkbox" :checked="paused" @change="togglePause" />
      <span>{{ paused ? 'All customizations paused' : 'Pause all customizations' }}</span>
    </label>

    <div class="body">
      <p v-if="loading" class="muted">Loading…</p>
      <template v-else>
        <p class="section">Profiles matching this page</p>
        <p v-if="matching.length === 0" class="muted">No profiles match this page.</p>
        <ul v-else>
          <li v-for="p in matching" :key="p.id">
            <span class="dot" :class="{ on: p.enabled && !paused }"></span>
            <span class="name" :title="p.name">{{ p.name }}</span>
            <button @click="toggle(p)">{{ p.enabled ? 'Disable' : 'Enable' }}</button>
          </li>
        </ul>
      </template>
    </div>
  </div>
</template>

<style>
body { margin: 0; }
.popup {
  width: 320px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #1e2128;
  color: #e6e8ee;
  padding: 12px 14px;
}
header {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}
header .logo { font-size: 18px; }
header .open {
  margin-left: auto;
  background: none;
  border: none;
  color: #4f7cff;
  cursor: pointer;
  font-size: 12px;
}
.pause {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  padding: 8px 10px;
  background: #262a33;
  border-radius: 8px;
  cursor: pointer;
}
.body { margin-top: 12px; }
.section {
  font-size: 12px;
  color: #9aa1ad;
  margin: 0 0 8px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.muted { color: #9aa1ad; font-size: 13px; }
ul { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 6px; }
li {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #262a33;
  border-radius: 7px;
  padding: 7px 10px;
}
.name { flex: 1; font-size: 13px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dot { width: 8px; height: 8px; border-radius: 50%; background: #6b7280; flex: 0 0 auto; }
.dot.on { background: #37c05b; }
li button {
  background: #333844;
  border: none;
  color: #e6e8ee;
  border-radius: 6px;
  padding: 4px 10px;
  font-size: 12px;
  cursor: pointer;
}
</style>
