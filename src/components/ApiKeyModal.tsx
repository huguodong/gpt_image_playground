import { useState } from 'react'
import { useStore } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'

export default function ApiKeyModal() {
  const showApiKeyModal = useStore((s) => s.showApiKeyModal)
  const setShowApiKeyModal = useStore((s) => s.setShowApiKeyModal)
  const settings = useStore((s) => s.settings)
  const setSettings = useStore((s) => s.setSettings)
  const setShowSettings = useStore((s) => s.setShowSettings)
  const [showApiKey, setShowApiKey] = useState(false)

  useCloseOnEscape(showApiKeyModal, () => setShowApiKeyModal(false))

  if (!showApiKeyModal) return null

  return (
    <div data-no-drag-select className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-black/25 backdrop-blur-sm animate-overlay-in"
        onClick={() => setShowApiKeyModal(false)}
      />
      <div
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/50 bg-white/95 p-5 shadow-2xl ring-1 ring-black/5 animate-modal-in dark:border-white/[0.08] dark:bg-gray-900/95 dark:ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">填写 API Key</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              模型固定为 <span className="font-mono text-gray-700 dark:text-gray-200">gpt-image-2</span>，这里只需要填 Key。
            </p>
          </div>
          <button
            onClick={() => setShowApiKeyModal(false)}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-3">
          <div className="relative">
            <input
              value={settings.apiKey}
              onChange={(event) => setSettings({ apiKey: event.target.value })}
              type={showApiKey ? 'text' : 'password'}
              placeholder="请输入你的 API Key"
              className="w-full rounded-2xl border border-gray-200/80 bg-white/80 px-4 py-3 pr-12 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
            />
            <button
              type="button"
              onClick={() => setShowApiKey((value) => !value)}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
              aria-label={showApiKey ? '隐藏 API Key' : '显示 API Key'}
            >
              {showApiKey ? (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              ) : (
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" viewBox="0 0 24 24">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
                  <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
                  <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
                  <line x1="1" y1="1" x2="23" y2="23" />
                </svg>
              )}
            </button>
          </div>

          <div className="rounded-2xl border border-gray-200/70 bg-gray-50/90 px-3 py-3 text-xs leading-6 text-gray-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-400">
            没填 Key 时，生成按钮会提醒先来这里。填写后立即生效，不需要另外保存。
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => {
              setShowApiKeyModal(false)
              setShowSettings(true)
            }}
            className="rounded-xl border border-gray-200/80 bg-white/80 px-3 py-2 text-xs font-medium text-gray-600 transition hover:bg-gray-100 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
          >
            更多设置
          </button>
          <button
            type="button"
            onClick={() => setShowApiKeyModal(false)}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm text-white transition hover:bg-blue-600"
          >
            完成
          </button>
        </div>
      </div>
    </div>
  )
}
