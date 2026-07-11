<script setup>
// CodeMirror 6 wrapper with language switching, undo/redo, search/replace, and theme.
import { ref, onMounted, onBeforeUnmount, watch } from 'vue'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search'
import { html } from '@codemirror/lang-html'
import { css } from '@codemirror/lang-css'
import { javascript } from '@codemirror/lang-javascript'
import { oneDark } from '@codemirror/theme-one-dark'

const props = defineProps({
  modelValue: { type: String, default: '' },
  language: { type: String, default: 'javascript' }, // html | css | javascript
  dark: { type: Boolean, default: true },
})
const emit = defineEmits(['update:modelValue'])

const host = ref(null)
let view = null
const langComp = new Compartment()
const themeComp = new Compartment()

function langExt(name) {
  if (name === 'html') return html()
  if (name === 'css') return css()
  return javascript()
}

function themeExt(dark) {
  return dark ? oneDark : []
}

onMounted(() => {
  const state = EditorState.create({
    doc: props.modelValue,
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      highlightSelectionMatches(),
      keymap.of([...defaultKeymap, ...historyKeymap, ...searchKeymap, indentWithTab]),
      langComp.of(langExt(props.language)),
      themeComp.of(themeExt(props.dark)),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) emit('update:modelValue', u.state.doc.toString())
      }),
      EditorView.theme({ '&': { height: '100%' }, '.cm-scroller': { overflow: 'auto' } }),
    ],
  })
  view = new EditorView({ state, parent: host.value })
})

onBeforeUnmount(() => view?.destroy())

// Keep the editor in sync if the model changes externally (e.g. switching profiles).
watch(
  () => props.modelValue,
  (val) => {
    if (view && val !== view.state.doc.toString()) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: val } })
    }
  }
)

watch(
  () => props.language,
  (name) => view?.dispatch({ effects: langComp.reconfigure(langExt(name)) })
)

watch(
  () => props.dark,
  (dark) => view?.dispatch({ effects: themeComp.reconfigure(themeExt(dark)) })
)
</script>

<template>
  <div ref="host" class="code-editor"></div>
</template>

<style scoped>
.code-editor {
  height: 100%;
  min-height: 0;
  border: 1px solid var(--wm-border);
  border-radius: 6px;
  overflow: hidden;
  font-size: 13px;
}
</style>
