import { useState } from 'react'
import { addImageFromUrl, useStore } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'

const API_MAX_IMAGES = 16

export default function ImageUrlImportModal() {
  const showImageUrlImport = useStore((s) => s.showImageUrlImport)
  const setShowImageUrlImport = useStore((s) => s.setShowImageUrlImport)
  const inputImages = useStore((s) => s.inputImages)
  const showToast = useStore((s) => s.showToast)
  const [value, setValue] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useCloseOnEscape(showImageUrlImport, () => setShowImageUrlImport(false))

  if (!showImageUrlImport) return null

  const handleClose = () => {
    if (submitting) return
    setValue('')
    setShowImageUrlImport(false)
  }

  const handleSubmit = async () => {
    const nextValue = value.trim()
    if (!nextValue) {
      showToast('请输入图片网址', 'error')
      return
    }
    if (!/^https?:\/\//i.test(nextValue)) {
      showToast('仅支持 http 或 https 图片地址', 'error')
      return
    }
    if (inputImages.length >= API_MAX_IMAGES) {
      showToast(`参考图数量已达上限（${API_MAX_IMAGES} 张）`, 'error')
      return
    }

    setSubmitting(true)
    try {
      await addImageFromUrl(nextValue)
      showToast('网页图片已加入参考图', 'success')
      handleClose()
    } catch (error) {
      showToast(`导入失败：${error instanceof Error ? error.message : String(error)}`, 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div data-no-drag-select className="fixed inset-0 z-[85] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm animate-overlay-in" onClick={handleClose} />
      <div
        className="relative z-10 w-full max-w-md rounded-3xl border border-white/50 bg-white/95 p-5 shadow-2xl ring-1 ring-black/5 animate-modal-in dark:border-white/[0.08] dark:bg-gray-900/95 dark:ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">添加网页图片</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">输入图片直链后，将其作为参考图加入当前任务。</p>
          </div>
          <button
            onClick={handleClose}
            className="rounded-full p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
            aria-label="关闭"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          placeholder="https://example.com/image.jpg"
          className="w-full rounded-2xl border border-gray-200/80 bg-white/80 px-4 py-3 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
        />

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="flex-1 rounded-xl border border-gray-200/80 bg-white/70 px-4 py-2.5 text-sm text-gray-600 transition hover:bg-gray-100 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
          >
            取消
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 rounded-xl bg-blue-500 px-4 py-2.5 text-sm text-white transition hover:bg-blue-600 disabled:opacity-50"
          >
            {submitting ? '导入中...' : '导入'}
          </button>
        </div>
      </div>
    </div>
  )
}
