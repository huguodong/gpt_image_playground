import { useEffect, useMemo, useState } from 'react'
import type {
  PromptLibraryCase,
  PromptLibraryMeta,
  PromptLibraryTemplateCategory,
  PromptLibraryInsertMode,
} from '../types'
import { useStore } from '../store'
import {
  applyPromptLibrarySnippet,
  closePromptLibrary,
  getPromptLibraryAssetPath,
  loadPromptLibraryCases,
  loadPromptLibraryMeta,
  loadPromptLibraryTemplates,
} from '../lib/promptLibrary'
import { useCloseOnEscape } from '../hooks/useCloseOnEscape'
import { copyTextToClipboard, getClipboardFailureMessage } from '../lib/clipboard'
import Select from './Select'

type PromptLibraryTab = 'cases' | 'templates'

const libraryLabelMap: Record<string, string> = {
  'Architecture & Spaces': '建筑与空间',
  'Brand & Logos': '品牌与标志',
  'Characters & People': '人物与角色',
  'Charts & Infographics': '图表与信息可视化',
  'Documents & Publishing': '文档与出版物',
  'History & Classical Themes': '历史与古风题材',
  'Illustration & Art': '插画与艺术',
  'Other Use Cases': '其他应用场景',
  'Photography & Realism': '摄影与写实',
  'Posters & Typography': '海报与排版',
  'Products & E-commerce': '商品与电商',
  'Scenes & Storytelling': '场景与叙事',
  'UI & Interfaces': 'UI 与界面',
  '3D': '3D',
  Architecture: '建筑',
  Brand: '品牌',
  Character: '角色',
  Characters: '人物',
  Charts: '图表',
  Classical: '古典',
  Commerce: '商业',
  Creative: '创意',
  Documents: '文档',
  Education: '教育',
  Fashion: '时尚',
  Food: '美食',
  History: '历史',
  Illustration: '插画',
  Infographic: '信息图',
  Photography: '摄影',
  Poster: '海报',
  Product: '商品',
  Products: '商品',
  Realistic: '写实',
  Scenes: '场景',
  Social: '社媒',
  Story: '叙事',
  Tech: '科技',
  Travel: '旅行',
  UI: '界面',
}

function Tag({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] text-gray-500 dark:bg-white/[0.06] dark:text-gray-400">
      {children}
    </span>
  )
}

function filterText(value: string) {
  return value.trim().toLowerCase()
}

function getBilingualLabel(value: string) {
  const localized = libraryLabelMap[value]
  return localized ? `${localized} / ${value}` : value
}

export default function PromptLibraryModal() {
  const showPromptLibrary = useStore((s) => s.showPromptLibrary)
  const showToast = useStore((s) => s.showToast)

  const [meta, setMeta] = useState<PromptLibraryMeta | null>(null)
  const [cases, setCases] = useState<PromptLibraryCase[]>([])
  const [templates, setTemplates] = useState<PromptLibraryTemplateCategory[]>([])
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [activeTab, setActiveTab] = useState<PromptLibraryTab>('cases')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [style, setStyle] = useState('all')
  const [scene, setScene] = useState('all')
  const [templateCategoryId, setTemplateCategoryId] = useState('')

  useCloseOnEscape(showPromptLibrary, closePromptLibrary)

  useEffect(() => {
    if (!showPromptLibrary || (meta && cases.length > 0 && templates.length > 0)) return

    let cancelled = false
    setLoading(true)
    setLoadError('')

    Promise.all([
      loadPromptLibraryMeta(),
      loadPromptLibraryCases(),
      loadPromptLibraryTemplates(),
    ])
      .then(([nextMeta, nextCases, nextTemplates]) => {
        if (cancelled) return
        setMeta(nextMeta)
        setCases(nextCases)
        setTemplates(nextTemplates)
        setTemplateCategoryId((current) => current || nextTemplates[0]?.id || '')
      })
      .catch((error) => {
        if (cancelled) return
        setLoadError(error instanceof Error ? error.message : String(error))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [showPromptLibrary, meta, cases.length, templates.length])

  const categoryOptions = useMemo(
    () => [
      { label: '全部分类', value: 'all' },
      ...Array.from(new Set(cases.map((item) => item.category))).sort().map((item) => ({
        label: getBilingualLabel(item),
        value: item,
      })),
    ],
    [cases],
  )

  const styleOptions = useMemo(
    () => [
      { label: '全部风格', value: 'all' },
      ...Array.from(new Set(cases.flatMap((item) => item.styles))).sort().map((item) => ({
        label: getBilingualLabel(item),
        value: item,
      })),
    ],
    [cases],
  )

  const sceneOptions = useMemo(
    () => [
      { label: '全部场景', value: 'all' },
      ...Array.from(new Set(cases.flatMap((item) => item.scenes))).sort().map((item) => ({
        label: getBilingualLabel(item),
        value: item,
      })),
    ],
    [cases],
  )

  const normalizedQuery = useMemo(() => filterText(query), [query])

  const filteredCases = useMemo(() => {
    return cases.filter((item) => {
      const matchCategory = category === 'all' || item.category === category
      const matchStyle = style === 'all' || item.styles.includes(style)
      const matchScene = scene === 'all' || item.scenes.includes(scene)
      const haystack = filterText(
        [
          item.title,
          item.category,
          getBilingualLabel(item.category),
          item.sourceLabel,
          item.prompt,
          item.promptPreview,
          item.styles.join(' '),
          item.scenes.join(' '),
          item.styles.map(getBilingualLabel).join(' '),
          item.scenes.map(getBilingualLabel).join(' '),
        ].join(' '),
      )
      const matchQuery = !normalizedQuery || haystack.includes(normalizedQuery)
      return matchCategory && matchStyle && matchScene && matchQuery
    })
  }, [cases, category, style, scene, normalizedQuery])

  const selectedTemplateCategory = useMemo(
    () => templates.find((item) => item.id === templateCategoryId) ?? templates[0] ?? null,
    [templates, templateCategoryId],
  )

  const filteredTemplateEntries = useMemo(() => {
    if (!selectedTemplateCategory) return []
    return selectedTemplateCategory.entries.filter((entry) => {
      const haystack = filterText(`${entry.title} ${entry.content}`)
      return !normalizedQuery || haystack.includes(normalizedQuery)
    })
  }, [selectedTemplateCategory, normalizedQuery])

  async function handleCopy(text: string, successMessage: string) {
    try {
      await copyTextToClipboard(text)
      showToast(successMessage, 'success')
    } catch (error) {
      showToast(getClipboardFailureMessage('复制失败', error), 'error')
    }
  }

  function handleInsert(text: string, mode: PromptLibraryInsertMode, label: string) {
    applyPromptLibrarySnippet(text, mode)
    closePromptLibrary()
    showToast(mode === 'replace' ? `已用${label}覆盖输入框` : `已将${label}追加到输入框`, 'success')
  }

  if (!showPromptLibrary) return null

  return (
    <div data-no-drag-select className="fixed inset-0 z-[90] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm animate-overlay-in" onClick={closePromptLibrary} />
      <div
        className="relative z-10 flex h-[88vh] w-full max-w-7xl flex-col overflow-hidden rounded-[28px] border border-white/50 bg-white/95 shadow-2xl ring-1 ring-black/5 animate-modal-in dark:border-white/[0.08] dark:bg-gray-950/95 dark:ring-white/10"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="border-b border-gray-200/80 px-4 py-4 dark:border-white/[0.08] sm:px-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-blue-500">Prompt Library</div>
              <h2 className="mt-1 text-xl font-semibold text-gray-800 dark:text-gray-100">灵感库 / 模板库</h2>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                按分类搜索案例，或直接套用工业模板，不再盲写提示词。
              </p>
            </div>
            <button
              onClick={closePromptLibrary}
              className="rounded-full p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-white/[0.06] dark:hover:text-gray-200"
              aria-label="关闭"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="inline-flex rounded-2xl bg-gray-100/80 p-1 dark:bg-white/[0.05]">
              <button
                onClick={() => setActiveTab('cases')}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeTab === 'cases'
                    ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                案例库
              </button>
              <button
                onClick={() => setActiveTab('templates')}
                className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
                  activeTab === 'templates'
                    ? 'bg-white text-gray-800 shadow-sm dark:bg-gray-900 dark:text-gray-100'
                    : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                }`}
              >
                模板库
              </button>
            </div>

            <div className="relative w-full lg:max-w-md">
              <svg
                className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={activeTab === 'cases' ? '搜索标题、Prompt、来源...' : '搜索模板标题、内容、避坑指南...'}
                className="w-full rounded-2xl border border-gray-200/80 bg-white/80 py-2.5 pl-10 pr-4 text-sm text-gray-700 outline-none transition focus:border-blue-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:text-gray-200 dark:focus:border-blue-500/50"
              />
            </div>
          </div>

          {meta && (
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-gray-400 dark:text-gray-500">
              <span>案例 {meta.totalCases}</span>
              <span>模板分类 {meta.totalTemplateCategories}</span>
              <span>许可 {meta.license}</span>
              <span>同步时间 {new Date(meta.syncedAt).toLocaleString('zh-CN')}</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center text-sm text-gray-500 dark:text-gray-400">正在加载本地资源库...</div>
        ) : loadError ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
            <p className="text-sm text-red-500">{loadError}</p>
            <button
              onClick={() => {
                setMeta(null)
                setCases([])
                setTemplates([])
              }}
              className="rounded-xl bg-blue-500 px-4 py-2 text-sm text-white transition hover:bg-blue-600"
            >
              重新加载
            </button>
          </div>
        ) : activeTab === 'cases' ? (
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="border-b border-gray-200/70 px-4 py-3 dark:border-white/[0.08] sm:px-5">
              <div className="grid gap-2 md:grid-cols-3">
                <Select value={category} onChange={setCategory} options={categoryOptions} className="rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-sm dark:border-white/[0.08] dark:bg-white/[0.03]" />
                <Select value={style} onChange={setStyle} options={styleOptions} className="rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-sm dark:border-white/[0.08] dark:bg-white/[0.03]" />
                <Select value={scene} onChange={setScene} options={sceneOptions} className="rounded-xl border border-gray-200/80 bg-white px-3 py-2 text-sm dark:border-white/[0.08] dark:bg-white/[0.03]" />
              </div>
              <div className="mt-2 text-xs text-gray-400 dark:text-gray-500">匹配 {filteredCases.length} 条案例</div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {filteredCases.map((item) => (
                  <article key={item.id} className="overflow-hidden rounded-3xl border border-gray-200/80 bg-white/80 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
                    <div className="aspect-[4/3] overflow-hidden bg-gray-100 dark:bg-white/[0.04]">
                      <img
                        src={getPromptLibraryAssetPath(item.thumbnailSrc)}
                        alt={item.title}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    <div className="space-y-3 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="line-clamp-2 text-sm font-semibold text-gray-800 dark:text-gray-100">{item.title}</h3>
                          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">{item.sourceLabel || 'Community'}</div>
                        </div>
                        {item.featured && <span className="rounded-full bg-blue-50 px-2 py-1 text-[11px] font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">精选</span>}
                      </div>

                      <div className="flex flex-wrap gap-1.5">
                        <Tag>{getBilingualLabel(item.category)}</Tag>
                        {item.styles.slice(0, 2).map((tag) => (
                          <Tag key={tag}>{getBilingualLabel(tag)}</Tag>
                        ))}
                        {item.scenes.slice(0, 1).map((tag) => (
                          <Tag key={tag}>{getBilingualLabel(tag)}</Tag>
                        ))}
                      </div>

                      <p className="line-clamp-4 text-sm leading-6 text-gray-600 dark:text-gray-300">{item.promptPreview || item.prompt}</p>

                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <button
                          onClick={() => handleCopy(item.prompt, '案例 Prompt 已复制')}
                          className="rounded-xl bg-gray-100 px-3 py-2 text-gray-600 transition hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]"
                        >
                          复制
                        </button>
                        <button
                          onClick={() => handleInsert(item.prompt, 'replace', '案例 Prompt')}
                          className="rounded-xl bg-blue-500 px-3 py-2 text-white transition hover:bg-blue-600"
                        >
                          替换
                        </button>
                        <button
                          onClick={() => handleInsert(item.prompt, 'append', '案例 Prompt')}
                          className="rounded-xl bg-blue-50 px-3 py-2 text-blue-600 transition hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
                        >
                          追加
                        </button>
                      </div>

                      <div className="flex flex-wrap gap-3 text-xs">
                        <a href={item.githubUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 transition hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400">
                          GitHub
                        </a>
                        {item.remoteImageUrl && (
                          <a href={item.remoteImageUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 transition hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400">
                            原图
                          </a>
                        )}
                        {item.sourceUrl && (
                          <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-gray-500 transition hover:text-blue-500 dark:text-gray-400 dark:hover:text-blue-400">
                            来源
                          </a>
                        )}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
            <div className="border-b border-gray-200/70 px-4 py-4 dark:border-white/[0.08] lg:w-[320px] lg:overflow-y-auto lg:border-b-0 lg:border-r sm:px-5">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
                {templates.map((item) => {
                  const active = item.id === selectedTemplateCategory?.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => setTemplateCategoryId(item.id)}
                      className={`overflow-hidden rounded-3xl border text-left transition ${
                        active
                          ? 'border-blue-300 bg-blue-50/80 shadow-sm dark:border-blue-500/30 dark:bg-blue-500/10'
                          : 'border-gray-200/80 bg-white/70 hover:border-gray-300 dark:border-white/[0.08] dark:bg-white/[0.03] dark:hover:border-white/[0.12]'
                      }`}
                    >
                      <div className="aspect-[16/9] overflow-hidden bg-gray-100 dark:bg-white/[0.04]">
                        <img src={getPromptLibraryAssetPath(item.coverSrc)} alt={item.title} className="h-full w-full object-cover" loading="lazy" />
                      </div>
                      <div className="space-y-2 p-3">
                        <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{item.title}</div>
                        <div className="flex flex-wrap gap-1.5">
                          {item.tags.slice(0, 3).map((tag) => (
                            <Tag key={tag}>{tag}</Tag>
                          ))}
                        </div>
                        <div className="text-xs text-gray-400 dark:text-gray-500">{item.entries.length} 个条目</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-5">
              {selectedTemplateCategory ? (
                <div className="space-y-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-100">{selectedTemplateCategory.title}</h3>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">支持复制、替换或追加到当前输入框。</p>
                  </div>

                  {filteredTemplateEntries.map((entry) => (
                    <section key={entry.id} className="rounded-3xl border border-gray-200/80 bg-white/80 p-4 shadow-sm dark:border-white/[0.08] dark:bg-white/[0.03]">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-gray-800 dark:text-gray-100">{entry.title}</div>
                          <div className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                            {entry.kind === 'json' ? 'JSON 模板' : entry.kind === 'tips' ? '避坑指南' : '文本模板'}
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2 text-xs">
                          <button
                            onClick={() => handleCopy(entry.content, '模板内容已复制')}
                            className="rounded-xl bg-gray-100 px-3 py-2 text-gray-600 transition hover:bg-gray-200 dark:bg-white/[0.06] dark:text-gray-300 dark:hover:bg-white/[0.1]"
                          >
                            复制
                          </button>
                          {entry.kind !== 'tips' && (
                            <>
                              <button
                                onClick={() => handleInsert(entry.content, 'replace', '模板')}
                                className="rounded-xl bg-blue-500 px-3 py-2 text-white transition hover:bg-blue-600"
                              >
                                替换
                              </button>
                              <button
                                onClick={() => handleInsert(entry.content, 'append', '模板')}
                                className="rounded-xl bg-blue-50 px-3 py-2 text-blue-600 transition hover:bg-blue-100 dark:bg-blue-500/10 dark:text-blue-400 dark:hover:bg-blue-500/20"
                              >
                                追加
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {entry.kind === 'tips' ? (
                        <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-600 dark:text-gray-300">
                          {entry.content.split('\n').filter(Boolean).map((line) => (
                            <li key={line} className="rounded-2xl bg-gray-50 px-3 py-2 dark:bg-white/[0.04]">
                              {line}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <pre className="mt-4 overflow-x-auto rounded-2xl bg-gray-950 px-4 py-4 text-xs leading-6 text-gray-100">
                          <code data-selectable-text>{entry.content}</code>
                        </pre>
                      )}
                    </section>
                  ))}
                </div>
              ) : (
                <div className="flex h-full items-center justify-center text-sm text-gray-500 dark:text-gray-400">暂无模板数据</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
