const raw = import.meta.env.VITE_API_BASE_URL
/** Base URL do backend (Express), ex.: `http://127.0.0.1:3000` */
export const apiBaseUrl: string = typeof raw === "string" && raw.length > 0 ? raw : "http://127.0.0.1:3000"
