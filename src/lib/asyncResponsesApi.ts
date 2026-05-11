import type {
  AsyncResponseImageJobRecord,
  TaskParams,
} from '../types'

const JOBS_BASE_PATH = '/api-async/v1/response-image-jobs'

interface CreateAsyncResponseImageJobRequest {
  model: string
  prompt: string
  params: TaskParams
  inputImageDataUrls: string[]
  maskDataUrl?: string
}

async function getApiErrorMessage(response: Response): Promise<string> {
  let errorMsg = `HTTP ${response.status}`
  try {
    const errJson = await response.json()
    if (errJson.error?.message) errorMsg = errJson.error.message
    else if (typeof errJson.detail === 'string') errorMsg = errJson.detail
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

export async function createAsyncResponseImageJob(
  apiKey: string,
  request: CreateAsyncResponseImageJobRequest,
): Promise<AsyncResponseImageJobRecord> {
  const response = await fetch(JOBS_BASE_PATH, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, max-age=0',
      Pragma: 'no-cache',
    },
    cache: 'no-store',
    body: JSON.stringify(request),
  })

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response))
  }

  return await response.json() as AsyncResponseImageJobRecord
}

export async function getAsyncResponseImageJob(apiKey: string, jobId: string): Promise<AsyncResponseImageJobRecord> {
  const requestUrl = new URL(`${JOBS_BASE_PATH}/${encodeURIComponent(jobId)}`, window.location.origin)
  requestUrl.searchParams.set('_t', String(Date.now()))

  const response = await fetch(requestUrl.toString(), {
    cache: 'no-store',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Cache-Control': 'no-store, no-cache, max-age=0',
      Pragma: 'no-cache',
    },
  })

  if (!response.ok) {
    throw new Error(await getApiErrorMessage(response))
  }

  return await response.json() as AsyncResponseImageJobRecord
}
