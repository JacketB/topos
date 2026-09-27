export function isTauriApp(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const w = window as any;
  return !!w.isTauri || w.__TAURI_INTERNALS__ !== undefined || w.__TAURI__ !== undefined;
}

export async function checkIsTauri(): Promise<boolean> {
  if (typeof window === 'undefined') {
    return false;
  }
  try {
    const { isTauri } = await import('@tauri-apps/api/core');
    if (typeof isTauri === 'function') {
      return isTauri();
    }
  } catch {}
  return isTauriApp();
}
