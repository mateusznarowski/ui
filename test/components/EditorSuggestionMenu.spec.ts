import { Editor } from '@tiptap/vue-3'
import StarterKit from '@tiptap/starter-kit'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { describe, expect, it, vi } from 'vitest'
import { axe } from 'vitest-axe'
import EditorSuggestionMenu from '../../src/runtime/components/EditorSuggestionMenu.vue'
import EditorMentionMenu from '../../src/runtime/components/EditorMentionMenu.vue'
import EditorEmojiMenu from '../../src/runtime/components/EditorEmojiMenu.vue'

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

  it('exposes the active option and keeps keyboard navigation in the editor', async ({ onTestFinished }) => {
    const { parent, editor } = mountEditor(onTestFinished)
    const wrapper = await mountSuspended(EditorSuggestionMenu, {
      props: {
        editor,
        appendTo: parent,
        items: [
          { kind: 'paragraph', label: 'Paragraph' },
          { kind: 'heading', level: 1, label: 'Heading 1' },
          { kind: 'heading', level: 2, label: 'Heading 2' }
        ]
      }
    })
    onTestFinished(() => wrapper.unmount())

    const editable = editor.view.dom
    const status = wrapper.get('[role=status]')
    expect(status.text()).toBe('')
    editable.focus()
    editor.commands.insertContent('/')
    const listbox = await getListbox(parent)
    const [first, second, third] = listbox.querySelectorAll('[role=option]')
    expect(first!.id).toBeTruthy()
    expect(editable.getAttribute('aria-controls')).toBe(listbox.id)
    expect(editable.getAttribute('aria-activedescendant')).toBe(first!.id)
    expect(status.text()).toBe('Paragraph')

    Object.defineProperties(listbox, {
      clientHeight: { value: 40 },
      scrollHeight: { value: 120 }
    })
    editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageDown', bubbles: true, cancelable: true }))
    expect(listbox.scrollTop).toBe(40)
    editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'PageUp', bubbles: true, cancelable: true }))
    expect(listbox.scrollTop).toBe(0)

    vi.useFakeTimers()
    onTestFinished(() => {
      vi.useRealTimers()
    })

    editor.commands.insertContent('h')
    await vi.advanceTimersByTimeAsync(0)
    expect(editable.getAttribute('aria-activedescendant')).toBe(second!.id)
    expect(document.getElementById(second!.id)?.textContent).toBe('Heading 1')
    expect(status.text()).toBe('Paragraph')

    await vi.advanceTimersByTimeAsync(150)
    editor.commands.insertContent('ea')
    await vi.advanceTimersByTimeAsync(150)
    expect(document.getElementById(first!.id)).toBeNull()
    expect(status.text()).toBe('Paragraph')

    editor.commands.insertContent('d')
    await vi.advanceTimersByTimeAsync(250)
    expect(status.text()).toBe('Heading 1')

    editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(editable.getAttribute('aria-activedescendant')).toBe(third!.id))
    expect(document.activeElement).toBe(editable)
    expect(status.text()).toBe('')

    editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(parent.querySelector('[role=listbox]')).toBeNull())
    expect(editor.state.doc.firstChild?.type.name).toBe('heading')
    expect(editor.state.doc.firstChild?.attrs.level).toBe(2)
    expect(editor.getText()).not.toContain('/')
    expect(editable.hasAttribute('aria-controls')).toBe(false)
    expect(editable.hasAttribute('aria-activedescendant')).toBe(false)
    expect(editable.getAttribute('role')).toBe('textbox')
    expect(editable.getAttribute('aria-label')).toBe('Document')
  })

  it('adds a fresh announcement when reopening with the same highlighted option', async ({ onTestFinished }) => {
    const { parent, editor } = mountEditor(onTestFinished)
    const wrapper = await mountSuspended(EditorSuggestionMenu, {
      props: {
        editor,
        appendTo: parent,
        items: [{ kind: 'paragraph', label: 'Paragraph' }]
      }
    })
    onTestFinished(() => wrapper.unmount())

    const status = wrapper.get('[role=status]')
    const editable = editor.view.dom
    editable.focus()

    editor.commands.insertContent('/')
    await getListbox(parent)
    expect(status.text()).toBe('Paragraph')

    editable.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(status.text()).toBe(''))
    editor.commands.deleteRange({ from: 1, to: 2 })
    editor.commands.insertContent('/')

    await getListbox(parent)
    expect(status.text()).toBe('Paragraph')
    expect(document.activeElement).toBe(editable)
  })

  it.for([
    {
      kind: 'mention',
      trigger: '@',
      label: 'Ada',
      mount: (editor: Editor, appendTo: HTMLElement) => mountSuspended(EditorMentionMenu, {
        props: { editor, appendTo, items: [{ label: 'Ada' }, { label: 'Grace' }] }
      })
    },
    {
      kind: 'emoji',
      trigger: ':',
      label: 'smile',
      mount: (editor: Editor, appendTo: HTMLElement) => mountSuspended(EditorEmojiMenu, {
        props: {
          editor,
          appendTo,
          items: [
            { name: 'smile', emoji: '🙂', shortcodes: ['smile'], tags: [] },
            { name: 'wave', emoji: '👋', shortcodes: ['wave'], tags: [] }
          ]
        }
      })
    }
  ])('keeps the $kind list open when focus enters it and restores focus on Escape', async ({ mount, trigger, label }, { onTestFinished }) => {
    const { parent, editor } = mountEditor(onTestFinished)
    const wrapper = await mount(editor, parent)
    onTestFinished(() => wrapper.unmount())

    const editable = editor.view.dom
    editable.focus()
    editor.commands.insertContent(trigger)
    const listbox = await getListbox(parent)
    expect(listbox.getAttribute('aria-label')).toBe('Suggestions')
    expect(listbox.querySelector('[role=option]')?.textContent).toContain(label)

    listbox.focus()
    expect(document.activeElement).toBe(listbox)
    const options = listbox.querySelectorAll('[role=option]')
    listbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(listbox.getAttribute('aria-activedescendant')).toBe(options[1]!.id))
    listbox.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    await vi.waitFor(() => expect(parent.querySelector('[role=listbox]')).toBeNull())
    expect(document.activeElement).toBe(editable)
    expect(editable.hasAttribute('aria-activedescendant')).toBe(false)
  })
})
