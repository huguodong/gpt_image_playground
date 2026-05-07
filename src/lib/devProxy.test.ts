import { describe, expect, it } from 'vitest'
import { buildApiUrl, getMixedContentError, isApiProxyAvailable, shouldUseApiProxy } from './devProxy'

describe('buildApiUrl', () => {
  it('uses the same-origin proxy prefix when API proxy is enabled', () => {
    expect(buildApiUrl('http://api.example.com/v1', 'images/edits', null, true)).toBe(
      '/api-proxy/images/edits',
    )
  })

  it('keeps the v1 segment when the configured API URL does not include it', () => {
    expect(buildApiUrl('http://api.example.com', 'images/generations', null, true)).toBe(
      '/api-proxy/v1/images/generations',
    )
  })

  it('uses a configured proxy prefix when one is available', () => {
    expect(
      buildApiUrl(
        'http://api.example.com/v1',
        'responses',
        {
          enabled: true,
          prefix: '/openai-proxy',
          target: 'http://api.example.com/v1',
          changeOrigin: true,
          secure: false,
        },
        true,
      ),
    ).toBe('/openai-proxy/responses')
  })

  it('uses the configured API URL directly when API proxy is disabled', () => {
    expect(buildApiUrl('http://api.example.com/v1', 'responses', null, false)).toBe(
      'http://api.example.com/v1/responses',
    )
  })

  it('flags direct HTTP API URLs on HTTPS pages', () => {
    expect(getMixedContentError('http://api.example.com/v1', 'https:')).toMatch(
      '浏览器会拦截 HTTP API 请求',
    )
  })

  it('does not flag HTTPS API URLs on HTTPS pages', () => {
    expect(getMixedContentError('https://api.example.com/v1', 'https:')).toBeNull()
  })

  it('treats the API proxy as available in production by default', () => {
    expect(isApiProxyAvailable(null, false)).toBe(true)
  })

  it('treats the API proxy as available in dev by default', () => {
    expect(isApiProxyAvailable(null, true)).toBe(true)
  })

  it('auto-uses the proxy for local network API URLs in dev', () => {
    expect(shouldUseApiProxy('http://192.168.0.171:8080/v1', {
      enabled: true,
      prefix: '/api-proxy',
      target: 'http://192.168.0.171:8080/v1',
      changeOrigin: true,
      secure: false,
    }, 'http://192.168.0.105:4173', true)).toBe(true)
  })

  it('auto-uses the proxy for public HTTPS API URLs in dev', () => {
    expect(shouldUseApiProxy('https://api.example.com/v1', {
      enabled: true,
      prefix: '/api-proxy',
      target: 'https://api.example.com/v1',
      changeOrigin: true,
      secure: false,
    }, 'http://192.168.0.105:4173', true)).toBe(true)
  })

  it('auto-uses the proxy for cross-origin API URLs in production when proxy is available', () => {
    expect(shouldUseApiProxy('https://api.example.com/v1', null, 'https://image.52moyu.net', false)).toBe(true)
  })

  it('does not auto-use the proxy for same-origin API URLs in production', () => {
    expect(shouldUseApiProxy('https://image.52moyu.net/v1', null, 'https://image.52moyu.net', false)).toBe(false)
  })
})
