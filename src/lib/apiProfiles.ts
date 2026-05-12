import type { ApiProfile, AppSettings } from '../types'
import { readRuntimeEnv } from './runtimeEnv'
import { normalizeBaseUrl } from './devProxy'

export const ASYNC_RESPONSES_SERVICE_BASE_URL = '/api-async/v1'
export const DEFAULT_RESPONSES_MODEL = 'gpt-image-2'
export const DEFAULT_OPENAI_PROFILE_ID = 'default-openai'
export const DEFAULT_API_TIMEOUT = 600

export function resolveManagedApiBaseUrl(): string {
  const fallback = readRuntimeEnv(import.meta.env.VITE_DEFAULT_API_URL) || 'http://127.0.0.1:8333'
  return normalizeBaseUrl(fallback)
}

const DEFAULT_BASE_URL = resolveManagedApiBaseUrl()

export function createDefaultOpenAIProfile(overrides: Partial<ApiProfile> = {}): ApiProfile {
  return {
    id: DEFAULT_OPENAI_PROFILE_ID,
    name: '默认',
    provider: 'openai',
    baseUrl: DEFAULT_BASE_URL,
    apiKey: '',
    model: DEFAULT_RESPONSES_MODEL,
    timeout: DEFAULT_API_TIMEOUT,
    apiMode: 'responses',
    codexCli: false,
    apiProxy: true,
    ...overrides,
  }
}

export function normalizeApiProfile(input: unknown, fallback?: Partial<ApiProfile>): ApiProfile {
  const record = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const defaults = createDefaultOpenAIProfile(fallback)

  return {
    ...defaults,
    id: typeof record.id === 'string' && record.id.trim() ? record.id : defaults.id,
    name: typeof record.name === 'string' && record.name.trim() ? record.name : defaults.name,
    provider: 'openai',
    baseUrl: defaults.baseUrl,
    apiKey: typeof record.apiKey === 'string' ? record.apiKey : defaults.apiKey,
    model: typeof record.model === 'string' && record.model.trim() ? record.model : defaults.model,
    timeout: typeof record.timeout === 'number' && Number.isFinite(record.timeout) ? record.timeout : defaults.timeout,
    apiMode: 'responses',
    codexCli: false,
    apiProxy: true,
  }
}

export function normalizeSettings(input: Partial<AppSettings> | unknown): AppSettings {
  const record = input && typeof input === 'object' ? input as Record<string, unknown> : {}
  const legacyProfile = createDefaultOpenAIProfile({
    model: typeof record.model === 'string' && record.model.trim() ? record.model : DEFAULT_RESPONSES_MODEL,
    timeout: typeof record.timeout === 'number' && Number.isFinite(record.timeout) ? record.timeout : DEFAULT_API_TIMEOUT,
  })
  const profiles = Array.isArray(record.profiles) && record.profiles.length
    ? record.profiles.map((profile) => normalizeApiProfile(profile))
    : [legacyProfile]
  const activeProfileId = typeof record.activeProfileId === 'string' && profiles.some((profile) => profile.id === record.activeProfileId)
    ? record.activeProfileId
    : profiles[0].id
  const active = profiles.find((profile) => profile.id === activeProfileId) ?? profiles[0]

  return {
    baseUrl: active.baseUrl,
    apiKey: active.apiKey,
    model: active.model,
    timeout: active.timeout,
    apiMode: 'responses',
    codexCli: false,
    apiProxy: true,
    clearInputAfterSubmit: typeof record.clearInputAfterSubmit === 'boolean' ? record.clearInputAfterSubmit : false,
    profiles,
    activeProfileId,
  }
}

export function getActiveApiProfile(settings: Partial<AppSettings> | unknown): ApiProfile {
  const record = settings && typeof settings === 'object' ? settings as Record<string, unknown> : {}
  const normalized = normalizeSettings(settings)
  const profile = normalized.profiles.find((item) => item.id === normalized.activeProfileId) ?? normalized.profiles[0] ?? createDefaultOpenAIProfile()
  return {
    ...profile,
    provider: 'openai',
    baseUrl: profile.baseUrl || DEFAULT_BASE_URL,
    apiKey: typeof record.apiKey === 'string' ? record.apiKey : (typeof profile.apiKey === 'string' ? profile.apiKey : ''),
    model: typeof record.model === 'string' && record.model.trim() ? record.model : (profile.model.trim() || DEFAULT_RESPONSES_MODEL),
    timeout: typeof record.timeout === 'number' && Number.isFinite(record.timeout) ? record.timeout : (Number(profile.timeout) || DEFAULT_API_TIMEOUT),
    apiMode: 'responses',
    codexCli: false,
    apiProxy: true,
  }
}

export function validateApiProfile(profile: ApiProfile): string | null {
  if (!profile.apiKey.trim()) return '缺少 API Key'
  return null
}

function isDefaultOpenAIProfile(profile: ApiProfile): boolean {
  return profile.id === DEFAULT_OPENAI_PROFILE_ID &&
    profile.name === '默认' &&
    profile.provider === 'openai' &&
    profile.apiKey === '' &&
    profile.model === DEFAULT_RESPONSES_MODEL &&
    profile.timeout === DEFAULT_API_TIMEOUT
}

function hasOnlyDefaultProfiles(settings: AppSettings): boolean {
  return settings.profiles.length === 1 &&
    settings.activeProfileId === DEFAULT_OPENAI_PROFILE_ID &&
    isDefaultOpenAIProfile(settings.profiles[0])
}

function createImportedProfileId(usedIds: Set<string>): string {
  let id = `openai-imported-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  while (usedIds.has(id)) {
    id = `openai-imported-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`
  }
  usedIds.add(id)
  return id
}

function getApiProfileDedupKey(profile: ApiProfile): string {
  return JSON.stringify([
    profile.apiKey.trim(),
    profile.model.trim(),
    profile.timeout,
  ])
}

function dedupeApiProfiles(profiles: ApiProfile[]): ApiProfile[] {
  const seen = new Set<string>()
  return profiles.filter((profile) => {
    const key = getApiProfileDedupKey(profile)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function mergeImportedSettings(currentSettings: Partial<AppSettings> | unknown, importedSettings: Partial<AppSettings> | unknown): AppSettings {
  const current = normalizeSettings(currentSettings)
  const normalizedImported = normalizeSettings(importedSettings)
  const imported = normalizeSettings({
    ...normalizedImported,
    profiles: dedupeApiProfiles(normalizedImported.profiles),
  })

  if (hasOnlyDefaultProfiles(current)) {
    return imported
  }

  const usedIds = new Set(current.profiles.map((profile) => profile.id))
  const existingKeys = new Set(current.profiles.map(getApiProfileDedupKey))
  const importedProfiles = imported.profiles
    .filter((profile) => !existingKeys.has(getApiProfileDedupKey(profile)))
    .map((profile) => ({
      ...profile,
      id: createImportedProfileId(usedIds),
    }))
  const profiles = [...current.profiles, ...importedProfiles]

  return normalizeSettings({
    ...current,
    profiles,
    activeProfileId: current.activeProfileId,
  })
}

export const DEFAULT_SETTINGS: AppSettings = normalizeSettings({
  baseUrl: DEFAULT_BASE_URL,
  apiKey: '',
  model: DEFAULT_RESPONSES_MODEL,
  timeout: DEFAULT_API_TIMEOUT,
  apiMode: 'responses',
  codexCli: false,
  apiProxy: true,
  clearInputAfterSubmit: false,
})
