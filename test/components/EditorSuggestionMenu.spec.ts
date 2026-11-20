import { Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import EditorSuggestionMenu from '../../src/runtime/components/EditorSuggestionMenu.vue'

function mountEditor(onTestFinished: (callback: () => void) => void) {
  const parent = document.body.appendChild(document.createElement('div'))
  const editor = new Editor({
    element: parent,
    extensions: [StarterKit],
    editorProps: { attributes: { 'aria-label': 'Document' } }
  })
  onTestFinished(() => {
    editor.destroy()
    parent.remove()
  })
  return { parent, editor }
}

async function getListbox(parent: HTMLElement) {
  return vi.waitFor(() => {
    const listbox = parent.querySelector<HTMLElement>('[role=listbox]')
    expect(listbox).not.toBeNull()
    return listbox!
  })
}

describe('Editor suggestion menus', () => {
  it('names the listbox and each section in a menu with multiple headings', async ({ onTestFinished }) => {
    const { parent, editor } = mountEditor(onTestFinished)
    const wrapper = await mountSuspended(EditorSuggestionMenu, {
      props: {
        editor,
        appendTo: parent,
        ariaLabel: 'Editor commands',
        items: [
          { type: 'label', label: 'Text' },
          { kind: 'heading', level: 1, label: 'Heading 1' },
          { type: 'separator' },
          { type: 'label', label: 'Lists' },
          { kind: 'bulletList', label: 'Bullet list' }
        ]
      }
    })
    onTestFinished(() => wrapper.unmount())

    editor.commands.insertContent('/')
    const listbox = await getListbox(parent)
    const audit = await axe(parent, { runOnly: ['aria-input-field-name', 'aria-required-children', 'scrollable-region-focusable'] })

    expect(audit.violations).toEqual([])
    expect(listbox.getAttribute('aria-label')).toBe('Editor commands')
    expect(listbox.tabIndex).toBe(0)
    const groups = Array.from(listbox.querySelectorAll('[role=group]'))
    expect(groups.map(group => document.getElementById(group.getAttribute('aria-labelledby')!)?.textContent)).toEqual(['Text', 'Lists'])
    expect(groups.map(group => group.querySelector('[role=option]')?.textContent)).toEqual(['Heading 1', 'Bullet list'])
    expect(listbox.querySelector('[role=separator]')).toBeNull()
  })
})
