import { useState } from 'react'
import { useStore } from '../store'
import { useVersionCheck } from '../hooks/useVersionCheck'
import { API_KEY_APPLY_URL, PUBLIC_SITE_URL } from '../lib/appConfig'
import HelpModal from './HelpModal'

export default function Header() {
  const settings = useStore((s) => s.settings)
  const setShowApiKeyModal = useStore((s) => s.setShowApiKeyModal)
  const startOnboarding = useStore((s) => s.startOnboarding)
  const { hasUpdate, latestRelease, dismiss } = useVersionCheck()
  const [showHelp, setShowHelp] = useState(false)
  const hasApiKey = Boolean(settings.apiKey.trim())

  return (
    <header data-no-drag-select className="safe-area-top sticky top-0 z-40 bg-white/80 dark:bg-gray-950/80 backdrop-blur border-b border-gray-200 dark:border-white/[0.08]">
      <div className="safe-area-x safe-header-inner max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-start gap-1">
          <h1 className="text-lg font-bold tracking-tight">
            <a
              href={PUBLIC_SITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-800 dark:text-gray-100 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              摸鱼生图器
            </a>
          </h1>
          {hasUpdate && latestRelease && (
            <a
              href={latestRelease.url}
              target="_blank"
              rel="noopener noreferrer"
              onClick={dismiss}
              className="px-1.5 py-0.5 mt-0.5 rounded border border-red-500/30 text-[10px] font-bold bg-red-500 text-white hover:bg-red-600 transition-colors animate-fade-in leading-none"
              title={`新版本 ${latestRelease.tag}`}
            >
              NEW
            </a>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setShowApiKeyModal(true)}
            className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-medium transition-colors ${
              hasApiKey
                ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20'
                : 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20'
            }`}
            title={hasApiKey ? '查看或修改 API Key' : '填写 API Key'}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span>{hasApiKey ? '已填写 Key' : '填写 API Key'}</span>
          </button>
          <a
            href={API_KEY_APPLY_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-xl border border-blue-200 bg-blue-50 px-2.5 py-2 text-sm font-medium text-blue-600 transition-colors hover:bg-blue-100 dark:border-blue-500/20 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
            title="获取 API Key"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h4m0 0v4m0-4l-8 8" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h1a2 2 0 012 2v1M7 17h1a2 2 0 002-2v-1m8-4v7a2 2 0 01-2 2H9a2 2 0 01-2-2V9a2 2 0 012-2h7" />
            </svg>
            <span className="hidden sm:inline">获取 API Key</span>
            <span className="sm:hidden">获取 Key</span>
          </a>
          <button
            onClick={() => startOnboarding('apiKey')}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
            title="从头打开新手引导"
            aria-label="从头打开新手引导"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l1.6 4.9H19l-4.2 3 1.6 5.1-4.4-3.2-4.4 3.2 1.6-5.1-4.2-3h5.4L12 3z" />
            </svg>
          </button>
          <button
            onClick={() => setShowHelp(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-900 transition-colors"
            title="操作指南"
          >
            <svg
              className="w-5 h-5 text-gray-600 dark:text-gray-400"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              viewBox="0 0 24 24"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
          </button>
        </div>
      </div>
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
    </header>
  )
}
