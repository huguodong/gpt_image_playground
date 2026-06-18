import { readRuntimeEnv } from './runtimeEnv'

const DEFAULT_PUBLIC_SITE_URL = 'https://52moyu.net'
const DEFAULT_APP_NAMESPACE = 'ai-52moyu-net'

type AppConfigEnv = Pick<ImportMetaEnv, 'VITE_PUBLIC_SITE_URL' | 'VITE_API_KEY_APPLY_URL' | 'VITE_APP_NAMESPACE'>

export interface AppConfig {
  publicSiteUrl: string
  apiKeyApplyUrl: string
  publicSiteHostname: string
  appNamespace: string
  indexedDbName: string
  persistStorageKey: string
  exportZipPrefix: string
}

function normalizeUrl(value: string | undefined, fallback: string): string {
  const trimmed = readRuntimeEnv(value)
  if (!trimmed) return fallback

  try {
    const parsed = new URL(trimmed)
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return fallback
    return parsed.toString()
  } catch {
    return fallback
  }
}

function getHostname(url: string): string {
  try {
    return new URL(url).hostname || new URL(DEFAULT_PUBLIC_SITE_URL).hostname
  } catch {
    return new URL(DEFAULT_PUBLIC_SITE_URL).hostname
  }
}

function normalizeNamespace(value: string | undefined): string {
  return readRuntimeEnv(value) || DEFAULT_APP_NAMESPACE
}

export function resolveAppConfig(env: AppConfigEnv = import.meta.env): AppConfig {
  const publicSiteUrl = normalizeUrl(env.VITE_PUBLIC_SITE_URL, DEFAULT_PUBLIC_SITE_URL)
  const apiKeyApplyUrl = normalizeUrl(env.VITE_API_KEY_APPLY_URL, publicSiteUrl)
  const appNamespace = normalizeNamespace(env.VITE_APP_NAMESPACE)

  return {
    publicSiteUrl,
    apiKeyApplyUrl,
    publicSiteHostname: getHostname(publicSiteUrl),
    appNamespace,
    indexedDbName: appNamespace,
    persistStorageKey: appNamespace,
    exportZipPrefix: appNamespace,
  }
}

export const APP_CONFIG = resolveAppConfig()
export const PUBLIC_SITE_URL = APP_CONFIG.publicSiteUrl
export const API_KEY_APPLY_URL = APP_CONFIG.apiKeyApplyUrl
export const PUBLIC_SITE_HOSTNAME = APP_CONFIG.publicSiteHostname
export const INDEXED_DB_NAME = APP_CONFIG.indexedDbName
export const PERSIST_STORAGE_KEY = APP_CONFIG.persistStorageKey
export const EXPORT_ZIP_PREFIX = APP_CONFIG.exportZipPrefix
