import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { OnboardingStep } from '../types'
import { useStore } from '../store'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'

type AnchorRect = {
  top: number
  left: number
  width: number
  height: number
  bottom: number
  right: number
}

function getVisibleAnchor(step: OnboardingStep): HTMLElement | null {
  const elements = Array.from(document.querySelectorAll<HTMLElement>(`[data-onboarding-anchor="${step}"]`))
  return elements.find((element) => {
    const rect = element.getBoundingClientRect()
    if (rect.width <= 0 || rect.height <= 0) return false
    const style = window.getComputedStyle(element)
    if (style.display === 'none' || style.visibility === 'hidden') return false
    return rect.bottom > 0 && rect.right > 0 && rect.top < window.innerHeight && rect.left < window.innerWidth
  }) ?? null
}

function toAnchorRect(element: HTMLElement): AnchorRect {
  const rect = element.getBoundingClientRect()
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
    bottom: rect.bottom,
    right: rect.right,
  }
}

export default function OnboardingCoachmark() {
  const showOnboarding = useStore((s) => s.showOnboarding)
  const onboardingStep = useStore((s) => s.onboardingStep)
  const prompt = useStore((s) => s.prompt)
  const showPromptLibrary = useStore((s) => s.showPromptLibrary)
  const skipOnboarding = useStore((s) => s.skipOnboarding)
  const advanceOnboarding = useStore((s) => s.advanceOnboarding)
  const [anchorRect, setAnchorRect] = useState<AnchorRect | null>(null)
  const libraryOpenedRef = useRef(false)

  const visible =
    showOnboarding &&
    onboardingStep !== 'apiKey' &&
    !(onboardingStep === 'library' && showPromptLibrary)
  useCloseOnEscape(visible, skipOnboarding)

  useEffect(() => {
    if (!visible) {
      setAnchorRect(null)
      return
    }

    let frameId = 0
    const updateAnchor = () => {
      const anchor = getVisibleAnchor(onboardingStep)
      if (!anchor) {
        setAnchorRect(null)
        return
      }
      anchor.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
      setAnchorRect(toAnchorRect(anchor))
    }

    const scheduleUpdate = () => {
      cancelAnimationFrame(frameId)
      frameId = window.requestAnimationFrame(updateAnchor)
    }

    scheduleUpdate()
    window.addEventListener('resize', scheduleUpdate)
    window.addEventListener('scroll', scheduleUpdate, true)

    return () => {
      cancelAnimationFrame(frameId)
      window.removeEventListener('resize', scheduleUpdate)
      window.removeEventListener('scroll', scheduleUpdate, true)
    }
  }, [visible, onboardingStep])

  useEffect(() => {
    if (!showOnboarding || onboardingStep !== 'library') {
      libraryOpenedRef.current = false
      return
    }

    if (showPromptLibrary) {
      libraryOpenedRef.current = true
      return
    }

    if (libraryOpenedRef.current) {
      libraryOpenedRef.current = false
      advanceOnboarding()
    }
  }, [advanceOnboarding, onboardingStep, showOnboarding, showPromptLibrary])

  useEffect(() => {
    if (!visible || onboardingStep !== 'prompt') return
    if (!prompt.trim()) return
    advanceOnboarding()
  }, [advanceOnboarding, onboardingStep, prompt, visible])

  const content = useMemo(() => {
    if (onboardingStep === 'library') {
      return {
        stepLabel: '第 2 步 / 4',
        title: '没想法时先看灵感库',
        description: '这里有现成模板和案例，适合不知道怎么写提示词时先找灵感。打开后先看看，关闭弹窗后再进入下一步。',
        examples: [
          '可以先挑一个案例，再把文案带回输入框',
        ],
        actionLabel: '去看看',
      }
    }

    if (onboardingStep === 'prompt') {
      return {
        stepLabel: '第 3 步 / 4',
        title: '在这里写提示词',
        description: '先用一句自然语言描述你想生成的图片，开始输入后会自动进入下一步。',
        examples: [
          '例如：一只戴墨镜的柴犬，电影海报风格',
          '例如：赛博朋克城市夜景，霓虹灯，雨夜反光',
        ],
        actionLabel: '去输入',
      }
    }

    return {
      stepLabel: '第 4 步 / 4',
      title: '点这里开始第一次生成',
      description: '准备好后点击生成按钮。任务进入列表后，本次新手引导就会自动完成。',
      examples: [] as string[],
      actionLabel: '去生成',
    }
  }, [onboardingStep])

  if (!visible) return null

  const highlight = anchorRect ? {
    left: Math.max(anchorRect.left - 8, 8),
    top: Math.max(anchorRect.top - 8, 8),
    width: anchorRect.width + 16,
    height: anchorRect.height + 16,
  } : null

  const panelWidth = Math.min(340, window.innerWidth - 32)
  const estimatedHeight = onboardingStep === 'prompt' || onboardingStep === 'library' ? 250 : 190
  const prefersAbove = anchorRect ? anchorRect.top > window.innerHeight * 0.55 : false
  const panelTop = anchorRect
    ? Math.max(
        16,
        Math.min(
          prefersAbove ? anchorRect.top - estimatedHeight - 20 : anchorRect.bottom + 18,
          window.innerHeight - estimatedHeight - 16,
        ),
      )
    : 16
  const panelLeft = anchorRect
    ? Math.max(16, Math.min(anchorRect.left, window.innerWidth - panelWidth - 16))
    : 16

  const focusAnchor = () => {
    const anchor = getVisibleAnchor(onboardingStep)
    if (!anchor) return
    anchor.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' })
    if (onboardingStep === 'library') {
      anchor.click()
      return
    }
    if ('focus' in anchor) anchor.focus({ preventScroll: true })
  }

  return createPortal(
    <div data-no-drag-select className="fixed inset-0 z-[125] pointer-events-none">
      {highlight && (
        <div
          className="absolute rounded-3xl border-2 border-blue-400/90 bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.38)] transition-all duration-200"
          style={highlight}
        />
      )}

      <div
        className="absolute w-[min(340px,calc(100vw-32px))] rounded-3xl border border-white/50 bg-white/95 p-5 text-sm shadow-2xl ring-1 ring-black/5 animate-modal-in dark:border-white/[0.08] dark:bg-gray-900/95 dark:ring-white/10 pointer-events-auto"
        style={{
          width: panelWidth,
          top: panelTop,
          left: panelLeft,
        }}
      >
        <div className="mb-3 inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-300">
          首次使用 · {content.stepLabel}
        </div>
        <h3 className="text-base font-semibold text-gray-800 dark:text-gray-100">{content.title}</h3>
        <p className="mt-2 leading-6 text-gray-500 dark:text-gray-400">{content.description}</p>

        {content.examples.length > 0 && (
          <div className="mt-3 rounded-2xl border border-gray-200/70 bg-gray-50/90 px-3 py-3 text-xs leading-6 text-gray-500 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-400">
            {content.examples.map((item) => (
              <div key={item}>{item}</div>
            ))}
          </div>
        )}

        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={skipOnboarding}
            className="rounded-xl border border-gray-200/80 bg-white/80 px-3 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-100 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-300 dark:hover:bg-white/[0.08]"
          >
            稍后再说
          </button>
          <button
            type="button"
            onClick={focusAnchor}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm text-white transition hover:bg-blue-600"
          >
            {content.actionLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
