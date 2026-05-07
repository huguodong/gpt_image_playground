import { beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_PARAMS } from './types'
import { DEFAULT_SETTINGS } from './lib/apiProfiles'
import type { TaskRecord } from './types'
import { editOutputs, getOnboardingStepForState, markInterruptedOpenAIRunningTasks, ONBOARDING_VERSION, shouldStartOnboarding, submitTask, useStore } from './store'

const imageA = { id: 'image-a', dataUrl: 'data:image/png;base64,a' }

function task(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: 'task-a',
    prompt: 'prompt',
    params: { ...DEFAULT_PARAMS },
    inputImageIds: [],
    maskTargetImageId: null,
    maskImageId: null,
    outputImages: [],
    status: 'done',
    error: null,
    createdAt: 1,
    finishedAt: 2,
    elapsed: 1,
    ...overrides,
  }
}

describe('mask draft lifecycle in store actions', () => {
  beforeEach(() => {
    useStore.setState({
      settings: { ...DEFAULT_SETTINGS, apiKey: 'test-key' },
      prompt: 'prompt',
      inputImages: [],
      maskDraft: null,
      maskEditorImageId: null,
      params: { ...DEFAULT_PARAMS },
      tasks: [],
      onboardingStatus: 'pending',
      onboardingVersion: ONBOARDING_VERSION,
      showOnboarding: false,
      onboardingStep: 'apiKey',
      detailTaskId: null,
      lightboxImageId: null,
      lightboxImageList: [],
      showSettings: false,
      toast: null,
      confirmDialog: null,
      showToast: vi.fn(),
      setConfirmDialog: vi.fn(),
    })
  })

  it('preserves an existing mask when quick edit-output adds outputs as references', async () => {
    const maskDraft = {
      targetImageId: imageA.id,
      maskDataUrl: 'data:image/png;base64,mask',
      updatedAt: 1,
    }
    useStore.setState({
      inputImages: [imageA],
      maskDraft,
    })

    await editOutputs(task({ outputImages: [imageA.id] }))

    expect(useStore.getState().maskDraft).toEqual(maskDraft)
  })

  it('clears an invalid mask draft when submit cannot find the mask target image', async () => {
    useStore.setState({
      inputImages: [imageA],
      maskDraft: {
        targetImageId: 'missing-image',
        maskDataUrl: 'data:image/png;base64,mask',
        updatedAt: 1,
      },
    })

    await submitTask()

    expect(useStore.getState().maskDraft).toBeNull()
  })
})

describe('interrupted OpenAI running tasks', () => {
  it('marks legacy and OpenAI running tasks as interrupted', () => {
    const now = 10_000
    const legacyRunning = task({ id: 'legacy-running', status: 'running', createdAt: 1_000, finishedAt: null, elapsed: null })
    const openAIRunning = task({ id: 'openai-running', apiProvider: 'openai', status: 'running', createdAt: 2_000, finishedAt: null, elapsed: null })
    const doneTask = task({ id: 'done-task', apiProvider: 'openai', status: 'done' })

    const result = markInterruptedOpenAIRunningTasks([legacyRunning, openAIRunning, doneTask], now)

    expect(result.interruptedTasks.map((item) => item.id)).toEqual(['legacy-running', 'openai-running'])
    expect(result.tasks.find((item) => item.id === 'legacy-running')).toMatchObject({
      status: 'error',
      error: expect.stringContaining('请求中断'),
      finishedAt: now,
      elapsed: 9_000,
    })
    expect(result.tasks.find((item) => item.id === 'openai-running')).toMatchObject({
      status: 'error',
      error: expect.stringContaining('请求中断'),
      finishedAt: now,
      elapsed: 8_000,
    })
    expect(result.tasks.find((item) => item.id === 'done-task')).toEqual(doneTask)
  })

  it('keeps async running tasks alive across reload restoration', () => {
    const asyncRunning = task({
      id: 'async-running',
      status: 'running',
      asyncJobId: 'job-123',
      createdAt: 4_000,
      finishedAt: null,
      elapsed: null,
    })

    const result = markInterruptedOpenAIRunningTasks([asyncRunning], 10_000)

    expect(result.interruptedTasks).toEqual([])
    expect(result.tasks[0]).toEqual(asyncRunning)
  })
})

describe('onboarding trigger', () => {
  it('starts onboarding for a true first-time user', () => {
    expect(shouldStartOnboarding(
      { ...DEFAULT_SETTINGS, apiKey: '' },
      [],
      { status: 'pending', version: ONBOARDING_VERSION },
    )).toBe(true)
  })

  it('does not start onboarding when api key already exists', () => {
    expect(shouldStartOnboarding(
      { ...DEFAULT_SETTINGS, apiKey: 'test-key' },
      [],
      { status: 'pending', version: ONBOARDING_VERSION },
    )).toBe(false)
  })

  it('does not start onboarding when tasks already exist', () => {
    expect(shouldStartOnboarding(
      { ...DEFAULT_SETTINGS, apiKey: '' },
      [task()],
      { status: 'pending', version: ONBOARDING_VERSION },
    )).toBe(false)
  })

  it('does not start onboarding when current version was skipped', () => {
    expect(shouldStartOnboarding(
      { ...DEFAULT_SETTINGS, apiKey: '' },
      [],
      { status: 'skipped', version: ONBOARDING_VERSION },
    )).toBe(false)
  })

  it('does not start onboarding when current version was completed', () => {
    expect(shouldStartOnboarding(
      { ...DEFAULT_SETTINGS, apiKey: '' },
      [],
      { status: 'completed', version: ONBOARDING_VERSION },
    )).toBe(false)
  })
})

describe('onboarding completion on first task start', () => {
  it('marks onboarding completed after the first task enters the list', () => {
    useStore.setState({
      showOnboarding: true,
      onboardingStep: 'submit',
      onboardingStatus: 'pending',
      onboardingVersion: ONBOARDING_VERSION,
    })

    useStore.getState().markOnboardingTaskStarted()

    expect(useStore.getState()).toMatchObject({
      onboardingStatus: 'completed',
      onboardingVersion: ONBOARDING_VERSION,
      showOnboarding: false,
      onboardingStep: 'submit',
    })
  })
})

describe('onboarding step derivation', () => {
  it('routes users with a key but no prompt to the inspiration library step', () => {
    expect(getOnboardingStepForState({ ...DEFAULT_SETTINGS, apiKey: 'test-key' }, '')).toBe('library')
  })
})

describe('manual onboarding restart', () => {
  it('can reopen onboarding from the api key step explicitly', () => {
    useStore.setState({
      settings: { ...DEFAULT_SETTINGS, apiKey: 'test-key' },
      prompt: 'already typed',
      showOnboarding: false,
      onboardingStep: 'submit',
      onboardingStatus: 'completed',
      onboardingVersion: ONBOARDING_VERSION,
    })

    useStore.getState().startOnboarding('apiKey')

    expect(useStore.getState()).toMatchObject({
      showOnboarding: true,
      onboardingStep: 'apiKey',
      onboardingStatus: 'completed',
    })
  })
})
