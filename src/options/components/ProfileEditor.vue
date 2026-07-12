<script setup>
// Full-profile editor: metadata + match rules + tabbed code editors with auto-save.
import { ref, reactive, computed, watch, toRaw } from 'vue'
import CodeEditor from './CodeEditor.vue'
import { HTML_POSITIONS, MATCH_TYPES } from '../../lib/profile.js'
import { resetProfileData } from '../../lib/storage.js'
import { useProfiles } from '../composables/useProfiles.js'

const props = defineProps({
  profile: { type: Object, required: true },
  dark: { type: Boolean, default: true },
})
const emit = defineEmits(['close'])

const { saveProfile } = useProfiles()

// Working copy — edits here are debounced back to storage.
const draft = reactive(structuredClone(toRaw(props.profile)))

const tabs = ['HTML', 'CSS', 'JavaScript', 'Settings', 'Storage']
const activeTab = ref('HTML')

// JSON tabs are edited as text and parsed on save.
const settingsText = ref(JSON.stringify(draft.settings ?? {}, null, 2))
const storageText = ref(JSON.stringify(draft.storage ?? {}, null, 2))
const settingsError = ref('')
const storageError = ref('')

const saveState = ref('saved') // 'saved' | 'saving' | 'error'
let timer = null

function scheduleSave() {
  saveState.value = 'saving'
  clearTimeout(timer)
  timer = setTimeout(commit, 500)
}

function parseJsonTabs() {
  settingsError.value = ''
  storageError.value = ''
  try {
    draft.settings = settingsText.value.trim() ? JSON.parse(settingsText.value) : {}
  } catch (e) {
    settingsError.value = 'Invalid JSON: ' + e.message
    return false
  }
  try {
    draft.storage = storageText.value.trim() ? JSON.parse(storageText.value) : {}
  } catch (e) {
    storageError.value = 'Invalid JSON: ' + e.message
    return false
  }
  return true
}

async function commit() {
  if (!parseJsonTabs()) {
    saveState.value = 'error'
    return
  }
  try {
    await saveProfile(structuredClone(toRaw(draft)))
    saveState.value = 'saved'
  } catch {
    saveState.value = 'error'
  }
}

// Auto-save on any change to the draft or the JSON text fields.
watch(() => JSON.stringify(draft), scheduleSave, { deep: false })
watch(settingsText, scheduleSave)
watch(storageText, scheduleSave)

const MATCH_HINTS = {
  domain: 'example.com — also matches www. and other subdomains',
  subdomain: 'app.example.com — this exact host only',
  url: 'https://example.com/page — exact, query string matters',
  glob: 'https://*.example.com/* — * is a wildcard',
  regex: '^https://example\\.com/.*',
}
const matchPlaceholder = (type) => MATCH_HINTS[type] || 'example.com'

function addMatch() {
  draft.matches.push({ type: 'domain', value: '' })
}
function removeMatch(i) {
  draft.matches.splice(i, 1)
  if (draft.matches.length === 0) draft.matches.push({ type: 'domain', value: '' })
}

function formatJson(which) {
  try {
    if (which === 'settings') settingsText.value = JSON.stringify(JSON.parse(settingsText.value || '{}'), null, 2)
    else storageText.value = JSON.stringify(JSON.parse(storageText.value || '{}'), null, 2)
  } catch {
    /* leave as-is; error shown on save */
  }
}

const storageReset = ref('')
async function resetLiveStorage() {
  let seed
  try {
    seed = storageText.value.trim() ? JSON.parse(storageText.value) : {}
  } catch (e) {
    storageError.value = 'Invalid JSON: ' + e.message
    return
  }
  await resetProfileData(draft.id, seed)
  storageReset.value = 'Live storage reset to these defaults.'
  setTimeout(() => (storageReset.value = ''), 2500)
}

const saveLabel = computed(() =>
  saveState.value === 'saving' ? 'Saving…' : saveState.value === 'error' ? 'Save error' : 'All changes saved'
)
</script>

<template>
  <div class="editor">
    <header class="editor-head">
      <button class="link" @click="emit('close')">← Back</button>
      <span class="save-state" :class="saveState">{{ saveLabel }}</span>
    </header>

    <div class="meta">
      <div class="row">
        <label class="field grow">
          <span>Name</span>
          <input v-model="draft.name" type="text" placeholder="Profile name" />
        </label>
        <label class="field">
          <span>Version</span>
          <input v-model="draft.version" type="text" style="width: 90px" />
        </label>
        <label class="field toggle">
          <input v-model="draft.enabled" type="checkbox" />
          <span>Enabled</span>
        </label>
      </div>
      <label class="field">
        <span>Description</span>
        <input v-model="draft.description" type="text" placeholder="What does this profile do?" />
      </label>

      <div class="matches">
        <div class="matches-head">
          <span>Match rules <small>(profile applies if ANY rule matches)</small></span>
          <button class="link" @click="addMatch">+ Add rule</button>
        </div>
        <div v-for="(m, i) in draft.matches" :key="i" class="match-row">
          <select v-model="m.type">
            <option v-for="t in MATCH_TYPES" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
          <input v-model="m.value" type="text" :placeholder="matchPlaceholder(m.type)" />
          <button class="icon" title="Remove" @click="removeMatch(i)">✕</button>
        </div>
      </div>
    </div>

    <nav class="tabs">
      <button v-for="t in tabs" :key="t" :class="{ active: activeTab === t }" @click="activeTab = t">{{ t }}</button>
    </nav>

    <div class="tab-body">
      <!-- HTML -->
      <div v-show="activeTab === 'HTML'" class="pane">
        <div class="pane-opts">
          <label class="field">
            <span>Inject position</span>
            <select v-model="draft.html.position">
              <option v-for="p in HTML_POSITIONS" :key="p.value" :value="p.value">{{ p.label }}</option>
            </select>
          </label>
          <label
            v-if="['before', 'after', 'inside'].includes(draft.html.position)"
            class="field grow"
          >
            <span>Target selector</span>
            <input v-model="draft.html.target" type="text" placeholder="CSS selector, e.g. #header" />
          </label>
        </div>
        <CodeEditor v-model="draft.html.code" language="html" :dark="dark" />
      </div>

      <!-- CSS -->
      <div v-show="activeTab === 'CSS'" class="pane">
        <CodeEditor v-model="draft.css" language="css" :dark="dark" />
      </div>

      <!-- JavaScript -->
      <div v-show="activeTab === 'JavaScript'" class="pane">
        <p class="hint">
          Runs in the page as an async function — top-level <code>await</code> is supported. The
          <code>webmod</code> helper is the first argument: DOM (<code>$</code>, <code>waitFor</code>,
          <code>create</code>, <code>injectCSS/HTML</code>), UI (<code>toast</code>, <code>modal</code>,
          <code>dialog</code>), <code>storage</code> (async get/set), <code>settings</code>, and utils
          (<code>clipboard</code>, <code>download</code>, <code>url</code>, <code>log</code>).
        </p>
        <CodeEditor v-model="draft.js" language="javascript" :dark="dark" />
      </div>

      <!-- Settings -->
      <div v-show="activeTab === 'Settings'" class="pane">
        <div class="pane-opts">
          <p class="hint">Read-only JSON exposed to the script as <code>webmod.settings</code>.</p>
          <button class="link" @click="formatJson('settings')">Format JSON</button>
        </div>
        <CodeEditor v-model="settingsText" language="javascript" :dark="dark" />
        <p v-if="settingsError" class="err">{{ settingsError }}</p>
      </div>

      <!-- Storage -->
      <div v-show="activeTab === 'Storage'" class="pane">
        <div class="pane-opts">
          <p class="hint">
            Default (seed) data for this profile's live storage. The script reads and writes it at
            runtime via <code>await webmod.storage.get/set(...)</code>; changes persist per profile.
          </p>
          <div class="opt-btns">
            <button class="link" @click="resetLiveStorage" title="Overwrite live storage with these defaults">
              Reset live storage
            </button>
            <button class="link" @click="formatJson('storage')">Format JSON</button>
          </div>
        </div>
        <CodeEditor v-model="storageText" language="javascript" :dark="dark" />
        <p v-if="storageError" class="err">{{ storageError }}</p>
        <p v-if="storageReset" class="hint">{{ storageReset }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}
.editor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.save-state {
  font-size: 12px;
  color: var(--wm-muted);
}
.save-state.saving { color: var(--wm-accent); }
.save-state.error { color: #e5534b; }
.meta {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 12px;
}
.row {
  display: flex;
  gap: 12px;
  align-items: flex-end;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--wm-muted);
}
.field.grow { flex: 1; }
.field.toggle {
  flex-direction: row;
  align-items: center;
  gap: 6px;
  padding-bottom: 8px;
}
.field input[type='text'],
.field select {
  background: var(--wm-input);
  border: 1px solid var(--wm-border);
  border-radius: 6px;
  color: var(--wm-text);
  padding: 7px 9px;
  font-size: 13px;
}
.matches {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.matches-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
  color: var(--wm-muted);
}
.match-row {
  display: flex;
  gap: 8px;
}
.match-row select { flex: 0 0 200px; }
.match-row input { flex: 1; }
.match-row select,
.match-row input {
  background: var(--wm-input);
  border: 1px solid var(--wm-border);
  border-radius: 6px;
  color: var(--wm-text);
  padding: 7px 9px;
  font-size: 13px;
}
.tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--wm-border);
}
.tabs button {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  color: var(--wm-muted);
  padding: 8px 14px;
  cursor: pointer;
  font-size: 13px;
}
.tabs button.active {
  color: var(--wm-text);
  border-bottom-color: var(--wm-accent);
}
.tab-body {
  flex: 1;
  min-height: 0;
  padding-top: 12px;
}
.pane {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
  gap: 8px;
}
.pane-opts {
  display: flex;
  gap: 16px;
  align-items: flex-end;
  justify-content: space-between;
}
.opt-btns {
  display: flex;
  gap: 14px;
  flex: 0 0 auto;
}
.hint {
  font-size: 12px;
  color: var(--wm-muted);
  margin: 0;
}
.hint code,
code {
  background: var(--wm-input);
  padding: 1px 5px;
  border-radius: 4px;
  font-size: 12px;
}
.err {
  color: #e5534b;
  font-size: 12px;
  margin: 0;
}
.link {
  background: none;
  border: none;
  color: var(--wm-accent);
  cursor: pointer;
  font-size: 13px;
  padding: 0;
}
.icon {
  background: var(--wm-input);
  border: 1px solid var(--wm-border);
  color: var(--wm-muted);
  border-radius: 6px;
  cursor: pointer;
  padding: 0 10px;
}
</style>
