// @ts-ignore - Tauri API may not be available in all environments
export const API_BASE = window.__TAURI_IPC__ ? 'http://localhost:1420' : import.meta.env.VITE_API_URL;