import { describe, expect, it } from 'vitest'
import { resolveAppConfig } from './appConfig'

describe('resolveAppConfig', () => {
  it('uses defaults when no env values are provided', () => {
    expect(resolveAppConfig({})).toEqual({
      publicSiteUrl: 'https://52moyu.net',
      apiKeyApplyUrl: 'https://52moyu.net',
      publicSiteHostname: '52moyu.net',
      appNamespace: 'ai-52moyu-net',
      indexedDbName: 'ai-52moyu-net',
      persistStorageKey: 'ai-52moyu-net',
      exportZipPrefix: 'ai-52moyu-net',
    })
  })

  it('uses the public site URL for site-owned links when only that value is configured', () => {
    expect(resolveAppConfig({
      VITE_PUBLIC_SITE_URL: 'https://example.com/portal',
    })).toMatchObject({
      publicSiteUrl: 'https://example.com/portal',
      apiKeyApplyUrl: 'https://example.com/portal',
      publicSiteHostname: 'example.com',
    })
  })

  it('lets the API key apply URL override the dedicated button target', () => {
    expect(resolveAppConfig({
      VITE_PUBLIC_SITE_URL: 'https://example.com',
      VITE_API_KEY_APPLY_URL: 'https://keys.example.com/apply',
    })).toMatchObject({
      publicSiteUrl: 'https://example.com/',
      apiKeyApplyUrl: 'https://keys.example.com/apply',
      publicSiteHostname: 'example.com',
    })
  })

  it('falls back to defaults for empty or invalid URLs', () => {
    expect(resolveAppConfig({
      VITE_PUBLIC_SITE_URL: '   ',
      VITE_API_KEY_APPLY_URL: 'not-a-url',
    })).toMatchObject({
      publicSiteUrl: 'https://52moyu.net',
      apiKeyApplyUrl: 'https://52moyu.net',
      publicSiteHostname: '52moyu.net',
    })
  })

  it('derives storage names from the configured namespace', () => {
    expect(resolveAppConfig({
      VITE_APP_NAMESPACE: 'custom-brand',
    })).toMatchObject({
      appNamespace: 'custom-brand',
      indexedDbName: 'custom-brand',
      persistStorageKey: 'custom-brand',
      exportZipPrefix: 'custom-brand',
    })
  })
})
