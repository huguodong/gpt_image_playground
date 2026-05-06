export interface LatestRelease {
  tag: string
  url: string
}

export function useVersionCheck() {
  const dismiss = () => {
    /* 当前站点不启用 GitHub Release 更新提示 */
  }
  return { hasUpdate: false, latestRelease: null as LatestRelease | null, dismiss }
}
