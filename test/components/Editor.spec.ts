import { describe, it, expect } from 'vitest'
import { axe } from 'vitest-axe'
import { mountSuspended } from '@nuxt/test-utils/runtime'
import { renderEach } from '../component-render'
import Editor from '../../src/runtime/components/Editor.vue'

describe('Editor', () => {
  const props = {}

  renderEach(Editor, [
    // Props
    ['with as', { props: { as: 'section' } }],
    ['with placeholder', { props: { placeholder: 'Write something...' } }],
    ['with class', { props: { class: 'min-h-80' } }],
    ['with ui', { props: { ui: { base: 'sm:px-14' } } }],
    // Slots
    ['with default slot', { props, slots: { default: () => 'Default slot' } }]
  ])

  it('passes accessibility tests', async () => {
    const wrapper = await mountSuspended(Editor, {
      props,
      attrs: { 'aria-label': 'Editor' }
    })

    expect(await axe(wrapper.element)).toHaveNoViolations()

    wrapper.unmount()
  })

  it('updates editability when the editable prop changes', async () => {
    const modelValue = '<p>Hello</p>'
    const wrapper = await mountSuspended(Editor, { props: { editable: false, modelValue } })
    const editor = wrapper.vm.editor!
    const content = wrapper.get('[contenteditable]')

    expect(content.attributes('contenteditable')).toBe('false')

    await wrapper.setProps({ editable: true })
    expect(content.attributes('contenteditable')).toBe('true')

    await wrapper.setProps({ editable: false })
    expect(content.attributes('contenteditable')).toBe('false')

    await wrapper.setProps({ editable: undefined })
    expect(content.attributes('contenteditable')).toBe('true')

    expect(wrapper.vm.editor).toBe(editor)
    expect(editor.getHTML()).toBe(modelValue)
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    wrapper.unmount()
  })

  it('updates editor props and clears options that were removed', async () => {
    const handleKeyDown = () => true
    const wrapper = await mountSuspended(Editor, {
      props: { modelValue: '<p>Hello</p>', editorProps: { attributes: { 'data-custom': 'first' }, handleKeyDown } }
    })
    const editor = wrapper.vm.editor!
    const content = wrapper.get('[contenteditable]')

    expect(content.attributes('data-custom')).toBe('first')
    expect(editor.view.props.handleKeyDown).toBe(handleKeyDown)

    await wrapper.setProps({ editorProps: { attributes: { 'data-custom': 'second' } } })
    expect(content.attributes('data-custom')).toBe('second')
    expect(editor.view.props.handleKeyDown).toBeUndefined()

    await wrapper.setProps({ editorProps: undefined })
    expect(content.attributes('data-custom')).toBeUndefined()
    expect(content.attributes('autocomplete')).toBe('off')
    expect(wrapper.vm.editor).toBe(editor)
    expect(editor.getHTML()).toBe('<p>Hello</p>')
    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    wrapper.unmount()
  })

  it('updates the base classes without resetting editor attributes', async () => {
    const wrapper = await mountSuspended(Editor, {
      props: { editorProps: { attributes: { 'aria-label': 'Document' } }, ui: { base: 'editor-base-before' } }
    })
    const editor = wrapper.vm.editor!
    const handleKeyDown = () => true
    editor.setOptions({ editorProps: { ...editor.options.editorProps, handleKeyDown } })

    const content = wrapper.get('[contenteditable]')
    expect(content.classes()).toContain('editor-base-before')

    await wrapper.setProps({ ui: { base: 'editor-base-after' } })
    expect(content.classes()).toContain('editor-base-after')
    expect(content.classes()).not.toContain('editor-base-before')
    expect(content.attributes('aria-label')).toBe('Document')
    expect(editor.view.props.handleKeyDown).toBe(handleKeyDown)
    expect(editor.options.editorProps.handleKeyDown).toBe(handleKeyDown)
    expect(content.attributes('autocomplete')).toBe('off')

    wrapper.unmount()
  })

  it('does not update the model when the document is unchanged', async () => {
    const wrapper = await mountSuspended(Editor, {
      props: {
        contentType: 'markdown',
        modelValue: '# Building Modern Interfaces with Nuxt UI',
        placeholder: 'Write something...'
      }
    })
    const editor = wrapper.vm.editor!

    editor.setEditable(false)

    expect(wrapper.emitted('update:modelValue')).toBeUndefined()

    wrapper.unmount()
  })
})
