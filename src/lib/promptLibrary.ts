import type {
  PromptLibraryCase,
  PromptLibraryMeta,
  PromptLibraryTemplateCategory,
  PromptLibraryInsertMode,
} from '../types'
import { insertPromptSnippet, useStore } from '../store'

function getLibraryBasePath() {
  return `${import.meta.env.BASE_URL}prompt-library/`
}

async function fetchLibraryJson<T>(fileName: string): Promise<T> {
  const response = await fetch(`${getLibraryBasePath()}${fileName}`, { cache: 'no-store' })
  if (!response.ok) {
    throw new Error(`资源库文件加载失败：${fileName}`)
  }
  return response.json() as Promise<T>
}

export function getPromptLibraryAssetPath(relativePath: string) {
  const normalized = relativePath.replace(/^\/+/, '')
  return `${getLibraryBasePath()}${normalized}`
}

export function openPromptLibrary() {
  useStore.getState().setShowPromptLibrary(true)
}

export function closePromptLibrary() {
  useStore.getState().setShowPromptLibrary(false)
}

export function applyPromptLibrarySnippet(snippet: string, mode: PromptLibraryInsertMode) {
  insertPromptSnippet(snippet, mode)
}

export async function loadPromptLibraryMeta() {
  return fetchLibraryJson<PromptLibraryMeta>('meta.json')
}

export async function loadPromptLibraryCases() {
  return fetchLibraryJson<PromptLibraryCase[]>('cases.json')
}

export async function loadPromptLibraryTemplates() {
  return fetchLibraryJson<PromptLibraryTemplateCategory[]>('templates.json')
}
