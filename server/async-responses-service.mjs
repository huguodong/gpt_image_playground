import { createServer } from 'node:http'
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import Database from 'better-sqlite3'

const PROMPT_REWRITE_GUARD_PREFIX = 'Use the following text as the complete prompt. Do not rewrite it:'
const MAX_IMAGE_INPUT_PAYLOAD_BYTES = 512 * 1024 * 1024
const DEFAULT_RESPONSES_BASE_URL = 'http://192.168.0.171:8080/v1'
const DEFAULT_MAX_BODY_MB = 600
const DEFAULT_CONCURRENCY = 1
const DEFAULT_LOG_TIME_ZONE = 'Asia/Shanghai'
const MIME_MAP = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
}

const __dirname = dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3002)
const HOST = process.env.HOST || '127.0.0.1'
const BASE_URL = normalizeBaseUrl(process.env.ASYNC_RESPONSES_BASE_URL || DEFAULT_RESPONSES_BASE_URL)
const JOB_SECRET = (process.env.ASYNC_JOB_SECRET || '').trim()
const PROJECT_ROOT_DB_PATH = resolve(__dirname, '..', 'response-image-jobs.sqlite')
const LEGACY_DB_PATH = resolve(__dirname, 'response-image-jobs.sqlite')
const DB_PATH = resolveDbPath()
const MAX_BODY_BYTES = Number(process.env.ASYNC_MAX_BODY_MB || DEFAULT_MAX_BODY_MB) * 1024 * 1024
const WORKER_CONCURRENCY = Math.max(1, Number(process.env.ASYNC_WORKER_CONCURRENCY || DEFAULT_CONCURRENCY))
const LOG_TIME_ZONE = String(process.env.ASYNC_LOG_TIME_ZONE || DEFAULT_LOG_TIME_ZONE).trim() || DEFAULT_LOG_TIME_ZONE
const LOG_TIME_FORMATTER = new Intl.DateTimeFormat('zh-CN', {
  timeZone: LOG_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  fractionalSecondDigits: 3,
  hour12: false,
})

if (!JOB_SECRET) {
  throw new Error('Missing ASYNC_JOB_SECRET')
}

const ENCRYPTION_KEY = createHash('sha256').update(JOB_SECRET, 'utf8').digest()

const db = new Database(DB_PATH)
db.pragma('journal_mode = WAL')
db.exec(`
  CREATE TABLE IF NOT EXISTS jobs (
    id TEXT PRIMARY KEY,
    status TEXT NOT NULL,
    model TEXT NOT NULL,
    prompt TEXT NOT NULL,
    api_key_encrypted TEXT NOT NULL DEFAULT '',
    params_json TEXT NOT NULL,
    input_images_json TEXT NOT NULL,
    mask_data_url TEXT,
    created_at INTEGER NOT NULL,
    started_at INTEGER,
    finished_at INTEGER,
    error_text TEXT,
    result_json TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at);
`)
db.prepare("UPDATE jobs SET status = 'queued', started_at = NULL WHERE status = 'running'").run()

const existingColumns = db.prepare('PRAGMA table_info(jobs)').all().map((column) => column.name)
if (!existingColumns.includes('api_key_encrypted')) {
  db.exec("ALTER TABLE jobs ADD COLUMN api_key_encrypted TEXT NOT NULL DEFAULT ''")
}

const insertJobStmt = db.prepare(`
  INSERT INTO jobs (
    id, status, model, prompt, api_key_encrypted, params_json, input_images_json, mask_data_url, created_at
  ) VALUES (
    @id, @status, @model, @prompt, @apiKeyEncrypted, @paramsJson, @inputImagesJson, @maskDataUrl, @createdAt
  )
`)
const getJobStmt = db.prepare(`
  SELECT id, status, model, prompt, api_key_encrypted, params_json, input_images_json, mask_data_url, created_at,
         started_at, finished_at, error_text, result_json
  FROM jobs
  WHERE id = ?
`)
const getQueuedJobStmt = db.prepare(`
  SELECT id, status, model, prompt, api_key_encrypted, params_json, input_images_json, mask_data_url, created_at,
         started_at, finished_at, error_text, result_json
  FROM jobs
  WHERE status = 'queued'
  ORDER BY created_at ASC
  LIMIT 1
`)
const markJobRunningStmt = db.prepare(`
  UPDATE jobs
  SET status = 'running', started_at = @startedAt, finished_at = NULL, error_text = NULL
  WHERE id = @id AND status = 'queued'
`)
const markJobDoneStmt = db.prepare(`
  UPDATE jobs
  SET status = 'done', finished_at = @finishedAt, result_json = @resultJson, error_text = NULL
  WHERE id = @id
`)
const markJobErrorStmt = db.prepare(`
  UPDATE jobs
  SET status = 'error', finished_at = @finishedAt, error_text = @errorText
  WHERE id = @id
`)

let activeWorkers = 0

function logInfo(message, meta = undefined) {
  const ts = formatLogTimestamp()
  if (meta === undefined) {
    console.log(`[${ts}] [信息] ${message}`)
    return
  }
  try {
    console.log(`[${ts}] [信息] ${message} ${JSON.stringify(meta)}`)
  } catch {
    console.log(`[${ts}] [信息] ${message}`)
  }
}

function logError(message, error, meta = undefined) {
  const ts = formatLogTimestamp()
  const errorMessage = error instanceof Error ? error.message : String(error)
  if (meta === undefined) {
    console.error(`[${ts}] [错误] ${message}: ${errorMessage}`)
    return
  }
  try {
    console.error(`[${ts}] [错误] ${message}: ${errorMessage} ${JSON.stringify(meta)}`)
  } catch {
    console.error(`[${ts}] [错误] ${message}: ${errorMessage}`)
  }
}

function normalizeBaseUrl(baseUrl) {
  const trimmed = String(baseUrl || '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return trimmed.endsWith('/v1') ? trimmed : `${trimmed}/v1`
}

function formatLogTimestamp(date = new Date()) {
  const parts = Object.create(null)
  for (const part of LOG_TIME_FORMATTER.formatToParts(date)) {
    if (part.type !== 'literal') {
      parts[part.type] = part.value
    }
  }
  return `${parts.year}-${parts.month}-${parts.day} ${parts.hour}:${parts.minute}:${parts.second}.${parts.fractionalSecond} ${LOG_TIME_ZONE}`
}

function resolveDbPath() {
  const explicitDbPath = String(process.env.ASYNC_DB_PATH || '').trim()
  if (explicitDbPath) return resolve(explicitDbPath)
  if (existsSync(PROJECT_ROOT_DB_PATH)) return PROJECT_ROOT_DB_PATH
  if (existsSync(LEGACY_DB_PATH)) return LEGACY_DB_PATH
  return PROJECT_ROOT_DB_PATH
}

function encryptSecret(plainText) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv)
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted.toString('base64')}`
}

function decryptSecret(payload) {
  const [ivPart, authTagPart, encryptedPart] = String(payload || '').split(':')
  if (!ivPart || !authTagPart || !encryptedPart) {
    throw new Error('任务密钥解密失败')
  }
  const decipher = createDecipheriv(
    'aes-256-gcm',
    ENCRYPTION_KEY,
    Buffer.from(ivPart, 'base64'),
  )
  decipher.setAuthTag(Buffer.from(authTagPart, 'base64'))
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encryptedPart, 'base64')),
    decipher.final(),
  ])
  return decrypted.toString('utf8')
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  })
  response.end(JSON.stringify(payload))
}

function toJobRecord(row) {
  if (!row) return null
  return {
    jobId: row.id,
    status: row.status,
    createdAt: row.created_at,
    startedAt: row.started_at ?? undefined,
    finishedAt: row.finished_at ?? undefined,
    error: row.error_text ?? undefined,
    result: row.result_json ? JSON.parse(row.result_json) : undefined,
  }
}

function normalizeBase64Image(value, fallbackMime) {
  return value.startsWith('data:') ? value : `data:${fallbackMime};base64,${value}`
}

function pickActualParams(source) {
  if (!source || typeof source !== 'object') return {}
  const actualParams = {}
  if (typeof source.size === 'string') actualParams.size = source.size
  if (source.quality === 'auto' || source.quality === 'low' || source.quality === 'medium' || source.quality === 'high') {
    actualParams.quality = source.quality
  }
  if (source.output_format === 'png' || source.output_format === 'jpeg' || source.output_format === 'webp') {
    actualParams.output_format = source.output_format
  }
  if (typeof source.output_compression === 'number') actualParams.output_compression = source.output_compression
  if (source.moderation === 'auto' || source.moderation === 'low') actualParams.moderation = source.moderation
  if (typeof source.n === 'number') actualParams.n = source.n
  return actualParams
}

function mergeActualParams(...sources) {
  const merged = Object.assign({}, ...sources.filter((source) => source && Object.keys(source).length))
  return Object.keys(merged).length ? merged : undefined
}

async function fetchImageAsDataUrl(url, fallbackMime) {
  if (typeof url !== 'string' || !url.trim()) return null
  if (url.startsWith('data:')) return url

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`图片下载失败: HTTP ${response.status}`)
  }

  const bytes = Buffer.from(await response.arrayBuffer())
  const contentType = response.headers.get('content-type') || fallbackMime
  return `data:${contentType};base64,${bytes.toString('base64')}`
}

function dataUrlToBlob(dataUrl) {
  const match = String(dataUrl || '').match(/^data:([^;,]+);base64,(.+)$/)
  if (!match) {
    throw new Error('输入图片格式无效')
  }
  const mimeType = match[1] || 'image/png'
  const bytes = Buffer.from(match[2], 'base64')
  return new Blob([bytes], { type: mimeType })
}

async function parseImagesApiResults(payload, fallbackMime) {
  const data = payload?.data
  if (!Array.isArray(data) || !data.length) {
    throw new Error('接口未返回图片数据')
  }

  const results = []
  for (const item of data) {
    let image = null
    if (typeof item?.b64_json === 'string' && item.b64_json.trim()) {
      image = normalizeBase64Image(item.b64_json, fallbackMime)
    } else if (typeof item?.url === 'string' && item.url.trim()) {
      image = await fetchImageAsDataUrl(item.url, fallbackMime)
    }
    if (!image) continue
    results.push({
      image,
      actualParams: mergeActualParams(pickActualParams(payload)),
      revisedPrompt: typeof item.revised_prompt === 'string' ? item.revised_prompt : undefined,
    })
  }

  if (!results.length) {
    throw new Error('接口未返回可用图片数据')
  }

  return results
}

async function getApiErrorMessage(response) {
  let errorMsg = `HTTP ${response.status}`
  try {
    const errJson = await response.json()
    if (errJson.error?.message) errorMsg = errJson.error.message
    else if (typeof errJson.detail === 'string') errorMsg = errJson.detail
    else if (Array.isArray(errJson.detail)) errorMsg = errJson.detail.map((item) => typeof item === 'string' ? item : JSON.stringify(item)).join('\n')
    else if (typeof errJson.error === 'string') errorMsg = errJson.error
    else if (errJson.message) errorMsg = errJson.message
  } catch {
    try {
      errorMsg = await response.text()
    } catch {
      /* ignore */
    }
  }
  return errorMsg
}

function getDataUrlEncodedByteSize(dataUrl) {
  return dataUrl.length
}

function assertImageInputPayloadSize(inputImageDataUrls, maskDataUrl) {
  const bytes = inputImageDataUrls.reduce((sum, dataUrl) => sum + getDataUrlEncodedByteSize(dataUrl), 0) +
    (maskDataUrl ? getDataUrlEncodedByteSize(maskDataUrl) : 0)
  if (bytes > MAX_IMAGE_INPUT_PAYLOAD_BYTES) {
    throw new Error('图像输入有效负载总大小过大')
  }
}

async function callSingleImagesJob(job) {
  const params = JSON.parse(job.params_json)
  const inputImageDataUrls = JSON.parse(job.input_images_json)
  const maskDataUrl = job.mask_data_url || undefined
  const apiKey = decryptSecret(job.api_key_encrypted)
  const isEdit = inputImageDataUrls.length > 0
  const mime = MIME_MAP[params.output_format] || 'image/png'

  assertImageInputPayloadSize(inputImageDataUrls, maskDataUrl)

  let response
  if (isEdit) {
    const formData = new FormData()
    formData.append('model', job.model)
    formData.append('prompt', job.prompt)
    formData.append('size', params.size)
    formData.append('output_format', params.output_format)
    if (params.quality) formData.append('quality', params.quality)
    if (params.moderation) formData.append('moderation', params.moderation)
    if (params.output_format !== 'png' && params.output_compression != null) {
      formData.append('output_compression', String(params.output_compression))
    }

    for (let i = 0; i < inputImageDataUrls.length; i += 1) {
      const blob = dataUrlToBlob(inputImageDataUrls[i])
      const ext = blob.type.split('/')[1] || 'png'
      formData.append('image[]', blob, `input-${i + 1}.${ext}`)
    }
    if (maskDataUrl) {
      formData.append('mask', dataUrlToBlob(maskDataUrl), 'mask.png')
    }

    response = await fetch(`${BASE_URL}/images/edits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Cache-Control': 'no-store, no-cache, max-age=0',
        Pragma: 'no-cache',
      },
      body: formData,
    })
  } else {
    const body = {
      model: job.model,
      prompt: job.prompt,
      size: params.size,
      quality: params.quality,
      output_format: params.output_format,
      moderation: params.moderation,
      ...(params.output_format !== 'png' && params.output_compression != null
        ? { output_compression: params.output_compression }
        : {}),
    }
    response = await fetch(`${BASE_URL}/images/generations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, max-age=0',
        Pragma: 'no-cache',
      },
      body: JSON.stringify(body),
    })
  }

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response))
  }

  const payload = await response.json()
  const imageResults = await parseImagesApiResults(payload, mime)
  const actualParams = mergeActualParams(imageResults[0]?.actualParams ?? {})

  return {
    images: imageResults.map((result) => result.image),
    actualParams,
    actualParamsList: imageResults.map((result) => mergeActualParams(result.actualParams ?? {})),
    revisedPrompts: imageResults.map((result) => result.revisedPrompt),
  }
}

async function executeJob(job) {
  const params = JSON.parse(job.params_json)
  const requestCount = Math.max(1, Number(params.n || 1))
  const settledResults = await Promise.allSettled(
    Array.from({ length: requestCount }, () => callSingleImagesJob(job)),
  )
  const successfulResults = settledResults
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value)

  if (!successfulResults.length) {
    const firstError = settledResults.find((result) => result.status === 'rejected')
    throw firstError?.reason ?? new Error('所有并发请求均失败')
  }

  const images = successfulResults.flatMap((result) => result.images)
  const actualParamsList = successfulResults.flatMap((result) =>
    result.actualParamsList?.length ? result.actualParamsList : result.images.map(() => result.actualParams),
  )
  const revisedPrompts = successfulResults.flatMap((result) =>
    result.revisedPrompts?.length ? result.revisedPrompts : result.images.map(() => undefined),
  )
  const actualParams = mergeActualParams(
    successfulResults[0]?.actualParams ?? {},
    images.length === requestCount ? { n: requestCount } : { n: images.length },
  )

  return {
    images,
    actualParams,
    actualParamsList,
    revisedPrompts,
  }
}

function claimQueuedJob() {
  const now = Date.now()
  const transaction = db.transaction(() => {
    const job = getQueuedJobStmt.get()
    if (!job) return null
    const result = markJobRunningStmt.run({ id: job.id, startedAt: now })
    if (result.changes !== 1) return null
    return {
      ...job,
      status: 'running',
      started_at: now,
    }
  })
  return transaction()
}

async function processQueue() {
  if (activeWorkers >= WORKER_CONCURRENCY) return
  const job = claimQueuedJob()
  if (!job) return

  activeWorkers += 1
  try {
    logInfo('任务开始处理', { jobId: job.id, model: job.model })
    const result = await executeJob(job)
    markJobDoneStmt.run({
      id: job.id,
      finishedAt: Date.now(),
      resultJson: JSON.stringify(result),
    })
    logInfo('任务处理完成', { jobId: job.id, imageCount: Array.isArray(result.images) ? result.images.length : 0 })
  } catch (error) {
    markJobErrorStmt.run({
      id: job.id,
      finishedAt: Date.now(),
      errorText: error instanceof Error ? error.message : String(error),
    })
    logError('任务处理失败', error, { jobId: job.id })
  } finally {
    activeWorkers -= 1
    queueMicrotask(() => {
      void processQueue()
    })
  }
}

function scheduleQueueWork() {
  while (activeWorkers < WORKER_CONCURRENCY) {
    const hasQueuedJob = Boolean(getQueuedJobStmt.get())
    if (!hasQueuedJob) break
    void processQueue()
    if (WORKER_CONCURRENCY === 1) break
  }
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let totalBytes = 0

    request.on('data', (chunk) => {
      totalBytes += chunk.length
      if (totalBytes > MAX_BODY_BYTES) {
        reject(new Error('请求体过大'))
        request.destroy()
        return
      }
      chunks.push(chunk)
    })

    request.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')))
      } catch {
        reject(new Error('请求体不是有效的 JSON'))
      }
    })
    request.on('error', reject)
  })
}

function validateJobRequest(body) {
  if (!body || typeof body !== 'object') throw new Error('请求体不能为空')
  if (typeof body.apiKey !== 'string' || !body.apiKey.trim()) throw new Error('缺少 API Key')
  if (typeof body.model !== 'string' || !body.model.trim()) throw new Error('缺少模型 ID')
  if (typeof body.prompt !== 'string' || !body.prompt.trim()) throw new Error('缺少提示词')
  if (!body.params || typeof body.params !== 'object') throw new Error('缺少参数配置')
  if (!Array.isArray(body.inputImageDataUrls)) throw new Error('输入图片列表格式错误')
  if (body.maskDataUrl != null && typeof body.maskDataUrl !== 'string') throw new Error('遮罩格式错误')
}

const server = createServer(async (request, response) => {
  try {
    if (!request.url) {
      sendJson(response, 404, { error: 'Not found' })
      return
    }

    const url = new URL(request.url, `http://${request.headers.host || '127.0.0.1'}`)

    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'Cache-Control': 'no-store',
      })
      response.end()
      return
    }

    if (request.method === 'POST' && url.pathname === '/api-async/v1/response-image-jobs') {
      const body = await readRequestBody(request)
      validateJobRequest(body)

      const now = Date.now()
      const jobId = randomUUID()
      insertJobStmt.run({
        id: jobId,
        status: 'queued',
        model: body.model.trim(),
        prompt: body.prompt.trim(),
        apiKeyEncrypted: encryptSecret(body.apiKey.trim()),
        paramsJson: JSON.stringify(body.params),
        inputImagesJson: JSON.stringify(body.inputImageDataUrls),
        maskDataUrl: body.maskDataUrl ?? null,
        createdAt: now,
      })
      logInfo('任务已入队', {
        jobId,
        model: body.model.trim(),
        inputImageCount: Array.isArray(body.inputImageDataUrls) ? body.inputImageDataUrls.length : 0,
        hasMask: Boolean(body.maskDataUrl),
      })
      scheduleQueueWork()
      sendJson(response, 202, {
        jobId,
        status: 'queued',
        createdAt: now,
      })
      return
    }

    if (request.method === 'GET' && url.pathname.startsWith('/api-async/v1/response-image-jobs/')) {
      const jobId = decodeURIComponent(url.pathname.split('/').pop() || '')
      const job = toJobRecord(getJobStmt.get(jobId))
      if (!job) {
        sendJson(response, 404, { error: '任务不存在' })
        return
      }
      sendJson(response, 200, job)
      return
    }

    sendJson(response, 404, { error: 'Not found' })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const statusCode = message === '请求体过大' ? 413 : 400
    sendJson(response, statusCode, { error: message })
  }
})

server.listen(PORT, HOST, () => {
  scheduleQueueWork()
  logInfo('异步服务已启动', {
    host: HOST,
    port: PORT,
    baseUrl: BASE_URL,
    dbPath: DB_PATH,
    workerConcurrency: WORKER_CONCURRENCY,
  })
})
