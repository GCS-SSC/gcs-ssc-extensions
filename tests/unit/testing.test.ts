import { describe, expect, it } from 'vitest'
import { h } from 'vue'
import { createExtensionTestUiRuntime } from '../../src/testing'

describe('extension SDK testing runtime', () => {
  it('provides interactive host component doubles for extension tests', () => {
    const runtime = createExtensionTestUiRuntime()

    expect(runtime.components.UInput).toBeTruthy()
    expect(runtime.components.UInputTags).toBeTruthy()
    expect(runtime.components.CommonSaveButton).toBeTruthy()
    expect(runtime.components.CommonAssessmentSchemaAccordionSection).toBeTruthy()
    expect(h(runtime.components.UTable)).toBeTruthy()
  })
})
