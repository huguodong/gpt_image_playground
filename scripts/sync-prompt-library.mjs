import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'freestylefly/awesome-gpt-image-2'
const REPOSITORY_URL = `https://github.com/${REPO}`
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/main`

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..')
const libraryDir = path.join(rootDir, 'public', 'prompt-library')
const coversDir = path.join(libraryDir, 'covers')
const thumbsDir = path.join(libraryDir, 'cases', 'thumbs')

const templateCategoryConfig = [
  { anchor: 'tpl-ui', title: 'UI与界面', coverFile: 'ui.jpg', tags: ['UI', '截图', '界面'], caseCategory: 'UI & Interfaces' },
  { anchor: 'tpl-infographic', title: '图表与信息可视化', coverFile: 'infographic.jpg', tags: ['信息图', '图表', '知识卡'], caseCategory: 'Charts & Infographics' },
  { anchor: 'tpl-poster', title: '海报与排版', coverFile: 'poster.jpg', tags: ['海报', '排版', '视觉'], caseCategory: 'Posters & Typography' },
  { anchor: 'tpl-product', title: '商品与电商', coverFile: 'product.jpg', tags: ['商品', '电商', '详情页'], caseCategory: 'Products & E-commerce' },
  { anchor: 'tpl-brand', title: '品牌与标志', coverFile: 'brand.jpg', tags: ['品牌', '标志', '识别系统'], caseCategory: 'Brand & Logos' },
  { anchor: 'tpl-architecture', title: '建筑与空间', coverFile: 'architecture.jpg', tags: ['建筑', '空间', '室内'], caseCategory: 'Architecture & Spaces' },
  { anchor: 'tpl-photo', title: '摄影与写实', coverFile: 'photo.jpg', tags: ['摄影', '写实', '镜头'], caseCategory: 'Photography & Realism' },
  { anchor: 'tpl-illustration', title: '插画与艺术', coverFile: 'illustration.jpg', tags: ['插画', '艺术', '风格'], caseCategory: 'Illustration & Art' },
  { anchor: 'tpl-character', title: '人物与角色', coverFile: 'character.jpg', tags: ['人物', '角色', '设定'], caseCategory: 'Characters & People' },
  { anchor: 'tpl-scene', title: '场景与叙事', coverFile: 'scene.jpg', tags: ['场景', '叙事', '分镜'], caseCategory: 'Scenes & Storytelling' },
  { anchor: 'tpl-history', title: '历史与古风题材', coverFile: 'history.jpg', tags: ['古风', '历史', '题材'], caseCategory: 'History & Classical Themes' },
  { anchor: 'tpl-document', title: '文档与出版物', coverFile: 'document.jpg', tags: ['文档', '出版', '页面系统'], caseCategory: 'Documents & Publishing' },
  { anchor: 'tpl-other', title: '其他应用场景', coverFile: 'other.jpg', tags: ['混合任务', '实验', '其他'], caseCategory: 'Other Use Cases' },
]

const categoryToAnchor = Object.fromEntries(
  templateCategoryConfig.map((item) => [item.caseCategory, item.anchor]),
)

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function cleanText(value = '') {
  return value
    .replace(/\r/g, '')
    .replace(/\u0000/g, '')
    .trim()
}

function createEntryId(anchor, title, index) {
  const slug = slugify(title) || `entry-${index + 1}`
  return `${anchor}-${slug}`
}

function parseTemplateSections(markdown) {
  const normalized = cleanText(markdown)
  const parts = normalized.split(/<a name="(tpl-[^"]+)"><\/a>/g)
  const categories = []

  for (let index = 1; index < parts.length; index += 2) {
    const anchor = parts[index]
    const body = parts[index + 1] ?? ''
    const config = templateCategoryConfig.find((item) => item.anchor === anchor)
    if (!config) continue

    const titleMatch = body.match(/###\s*(.+)/)
    const title = cleanText(titleMatch?.[1] ?? config.title)
    const lines = body.replace(/\r/g, '').split('\n')
    const entries = []

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
      const headingMatch = lines[lineIndex].match(/^\*\*(.+?)\*\*$/)
      if (!headingMatch) continue

      const entryTitle = cleanText(headingMatch[1])
      if (entryTitle === '避坑指南') {
        const tips = []
        let cursor = lineIndex + 1
        while (cursor < lines.length) {
          const candidate = lines[cursor].trim()
          if (/^\*\*(.+?)\*\*$/.test(candidate) || /^<a name="tpl-/.test(candidate)) break
          if (candidate.startsWith('- ')) tips.push(candidate.replace(/^- /, '').trim())
          cursor += 1
        }
        if (tips.length > 0) {
          entries.push({
            id: createEntryId(anchor, entryTitle, entries.length),
            title: entryTitle,
            kind: 'tips',
            content: tips.join('\n'),
          })
        }
        lineIndex = cursor - 1
        continue
      }

      let cursor = lineIndex + 1
      while (cursor < lines.length && !lines[cursor].trim().startsWith('```')) {
        cursor += 1
      }
      if (cursor >= lines.length) continue

      const fenceLine = lines[cursor].trim()
      const kind = fenceLine.includes('json') ? 'json' : 'text'
      const block = []
      cursor += 1
      while (cursor < lines.length && !lines[cursor].trim().startsWith('```')) {
        block.push(lines[cursor])
        cursor += 1
      }
      const content = cleanText(block.join('\n'))
      if (!content) continue

      entries.push({
        id: createEntryId(anchor, entryTitle, entries.length),
        title: entryTitle,
        kind,
        content,
      })
      lineIndex = cursor
    }

    categories.push({
      id: anchor.replace(/^tpl-/, ''),
      anchor,
      title,
      coverSrc: `covers/${config.coverFile}`,
      tags: config.tags,
      entries,
    })
  }

  return categories
}

function mapCaseItem(caseItem) {
  const imagePath = String(caseItem.image || '')
  const remoteImageUrl = imagePath.startsWith('/images/')
    ? `${RAW_BASE}/data${imagePath}`
    : ''
  const templateAnchor = categoryToAnchor[String(caseItem.category)] || 'tpl-other'

  return {
    id: Number(caseItem.id),
    title: String(caseItem.title || ''),
    category: String(caseItem.category || 'Other Use Cases'),
    styles: Array.isArray(caseItem.styles) ? caseItem.styles.map(String) : [],
    scenes: Array.isArray(caseItem.scenes) ? caseItem.scenes.map(String) : [],
    prompt: String(caseItem.prompt || ''),
    promptPreview: String(caseItem.promptPreview || ''),
    sourceLabel: String(caseItem.sourceLabel || ''),
    sourceUrl: String(caseItem.sourceUrl || ''),
    githubUrl: String(caseItem.githubUrl || ''),
    thumbnailSrc: `cases/thumbs/case${caseItem.id}.jpg`,
    remoteImageUrl,
    templateAnchor,
    featured: Boolean(caseItem.featured),
  }
}

function buildAssetManifest(casesData) {
  return {
    repository: REPOSITORY_URL,
    syncedAt: new Date().toISOString(),
    covers: templateCategoryConfig.map((item) => ({
      id: item.id ?? item.anchor.replace(/^tpl-/, ''),
      url: `${RAW_BASE}/data/images/category-covers/${item.coverFile}`,
      output: `covers/${item.coverFile}`,
    })),
    cases: casesData.map((item) => ({
      id: item.id,
      url: item.remoteImageUrl,
      output: item.thumbnailSrc,
    })),
  }
}

async function fetchJson(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`请求失败: ${url}`)
  return response.json()
}

async function fetchText(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`请求失败: ${url}`)
  return response.text()
}

async function main() {
  await mkdir(libraryDir, { recursive: true })
  await mkdir(coversDir, { recursive: true })
  await mkdir(thumbsDir, { recursive: true })

  const [casesRoot, templatesMarkdown] = await Promise.all([
    fetchJson(`${RAW_BASE}/data/cases.json`),
    fetchText(`${RAW_BASE}/docs/templates.md`),
  ])

  const rawCases = Array.isArray(casesRoot?.cases) ? casesRoot.cases : []
  const cases = rawCases.map(mapCaseItem)
  const templates = parseTemplateSections(templatesMarkdown)
  const meta = {
    repository: REPOSITORY_URL,
    syncedAt: new Date().toISOString(),
    license: 'MIT',
    totalCases: cases.length,
    totalTemplateCategories: templates.length,
  }
  const manifest = buildAssetManifest(cases)

  await Promise.all([
    writeFile(path.join(libraryDir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`),
    writeFile(path.join(libraryDir, 'cases.json'), `${JSON.stringify(cases, null, 2)}\n`),
    writeFile(path.join(libraryDir, 'templates.json'), `${JSON.stringify(templates, null, 2)}\n`),
    writeFile(path.join(libraryDir, 'asset-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`),
  ])

  console.log(`Prompt library metadata synced: ${cases.length} cases, ${templates.length} template categories.`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
