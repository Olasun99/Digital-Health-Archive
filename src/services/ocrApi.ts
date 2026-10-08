/**
 * Central OCR API Configuration and Service Layer
 * Health Archive Intelligence
 * 
 * Central Base URL: https://nasty-melons-sleep.loca.lt
 * Communicates with FastAPI + docTR backend running in Google Colab.
 */

export const OCR_API_BASE_URL = "https://nasty-melons-sleep.loca.lt";
export const DEFAULT_OCR_API_BASE_URL = OCR_API_BASE_URL;

const STORAGE_KEY_OCR_URL = 'HEALTH_ARCHIVE_OCR_API_BASE_URL';

export function getOcrApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_OCR_URL);
    if (saved && saved.trim()) {
      const clean = saved.trim().replace(/\/$/, '');
      // If previous obsolete URL is in localStorage, automatically upgrade to new URL
      if (clean.includes('shaggy-teams-win.loca.lt')) {
        localStorage.setItem(STORAGE_KEY_OCR_URL, OCR_API_BASE_URL);
        return OCR_API_BASE_URL;
      }
      return clean;
    }
  }
  return OCR_API_BASE_URL;
}

export function setOcrApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    const cleanUrl = url.trim().replace(/\/$/, '');
    localStorage.setItem(STORAGE_KEY_OCR_URL, cleanUrl);
    window.dispatchEvent(new Event('ocr_api_url_changed'));
  }
}

export interface BackendHealthResponse {
  status: string;
  engine?: string;
  version?: string;
  backend?: string;
  [key: string]: any;
}

export interface BackendStatsResponse {
  total_documents?: number;
  processed?: number;
  processing?: number;
  failed?: number;
  review_required?: number;
  ocr_engine?: string;
  [key: string]: any;
}

export interface OcrPageResult {
  page_number?: number;
  text?: string;
  confidence?: number | null;
  blocks?: any[];
  [key: string]: any;
}

export interface OcrDocumentResponse {
  document_id: string;
  filename: string;
  status: 'Queued' | 'Processing' | 'Completed' | 'Failed';
  pages?: number | OcrPageResult[];
  full_text?: string;
  raw_text?: string;
  confidence?: number | null;
  ocr_engine?: string;
  processing_time_seconds?: number;
  created_at?: string;
  error?: string;
  [key: string]: any;
}

export interface OcrBatchResponse {
  batch_id: string;
  status: 'Queued' | 'Processing' | 'Completed' | 'Failed';
  total_documents: number;
  completed: number;
  processing: number;
  failed: number;
  documents?: OcrDocumentResponse[];
  [key: string]: any;
}

/**
 * Universal fetcher with automatic Localtunnel bypass headers and proxy fallback
 */
async function apiRequest<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const baseUrl = getOcrApiBaseUrl();
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;

  // Use the local server-side proxy route to avoid CORS, mixed-content, and tunnel interstitial blocks
  const proxyUrl = `/api/ocr-proxy${normalizedEndpoint}`;
  const directUrl = `${baseUrl}${normalizedEndpoint}`;

  const headers = new Headers(options.headers || {});
  headers.set('x-ocr-base-url', baseUrl);
  headers.set('bypass-tunnel-reminder', 'true');
  headers.set('Bypass-Tunnel-Reminder', '1');

  try {
    // Primary strategy: through server proxy
    const res = await fetch(proxyUrl, {
      ...options,
      headers,
    });

    if (!res.ok) {
      // Check if response is JSON error
      const contentType = res.headers.get('content-type') || '';
      let errData: any = {};
      if (contentType.includes('application/json')) {
        errData = await res.json().catch(() => ({}));
      } else {
        const text = await res.text().catch(() => '');
        errData = { details: text.slice(0, 300) };
      }

      if (res.status === 503 || res.status === 502) {
        throw new Error(
          errData.message ||
          'The Colab OCR server appears to be offline or the Localtunnel URL has expired.'
        );
      }

      throw new Error(errData.error || errData.detail || `Server returned ${res.status}: ${res.statusText}`);
    }

    return (await res.json()) as T;
  } catch (primaryErr: any) {
    // If the proxy failed, attempt direct client fetch as a secondary fallback if not a tunnel 503
    try {
      const directHeaders = new Headers(options.headers || {});
      directHeaders.set('bypass-tunnel-reminder', 'true');
      const directRes = await fetch(directUrl, {
        ...options,
        headers: directHeaders,
      });
      if (directRes.ok) {
        return (await directRes.json()) as T;
      }
    } catch {
      // Retain primary error
    }

    throw primaryErr;
  }
}

export const ocrService = {
  /**
   * Health check endpoint: GET /health or GET /
   */
  async checkHealth(): Promise<{ ok: boolean; data: BackendHealthResponse | null; error?: string; latencyMs: number }> {
    const start = performance.now();
    try {
      const data = await apiRequest<any>('/health');
      const latencyMs = Math.round(performance.now() - start);
      const normalized: BackendHealthResponse = {
        status: data.status || 'healthy',
        engine: data.configured_engine || data.engine || 'docTR',
        version: data.version || '6.5.0',
        backend: 'FastAPI (Python)',
        ...data,
      };
      return { ok: true, data: normalized, latencyMs };
    } catch (err: any) {
      // Fallback check to root GET /
      try {
        const rootData = await apiRequest<any>('/');
        const latencyMs = Math.round(performance.now() - start);
        const normalized: BackendHealthResponse = {
          status: rootData.status || 'online',
          engine: rootData.engine || 'docTR',
          version: rootData.version || '6.5.0',
          backend: 'FastAPI (Python)',
          ...rootData,
        };
        return { ok: true, data: normalized, latencyMs };
      } catch (rootErr: any) {
        const latencyMs = Math.round(performance.now() - start);
        return {
          ok: false,
          data: null,
          error: err.message || 'Unable to connect to Colab OCR backend',
          latencyMs,
        };
      }
    }
  },

  /**
   * Backend statistics: GET /stats
   */
  async getStats(): Promise<BackendStatsResponse> {
    const raw = await apiRequest<any>('/stats');
    return {
      total_documents: raw.total_documents ?? raw.total_documents_processed ?? 0,
      processed: raw.processed ?? raw.successful_documents ?? 0,
      failed: raw.failed ?? raw.failed_documents ?? 0,
      processing: raw.processing ?? 0,
      review_required: raw.review_required ?? 0,
      ocr_engine: raw.ocr_engine ?? raw.configured_engine ?? 'docTR',
      ...raw,
    };
  },

  /**
   * List all documents: GET /documents
   */
  async getDocuments(): Promise<OcrDocumentResponse[]> {
    const res = await apiRequest<any>('/documents');
    if (Array.isArray(res)) return res;
    if (res && Array.isArray(res.documents)) return res.documents;
    return [];
  },

  /**
   * Retrieve single document OCR: GET /ocr/{document_id}
   */
  async getDocument(documentId: string): Promise<OcrDocumentResponse> {
    return apiRequest<OcrDocumentResponse>(`/ocr/${encodeURIComponent(documentId)}`);
  },

  /**
   * Retrieve batch status: GET /batch/{batch_id}
   */
  async getBatch(batchId: string): Promise<OcrBatchResponse> {
    return apiRequest<OcrBatchResponse>(`/batch/${encodeURIComponent(batchId)}`);
  },

  /**
   * Upload and process a single document: POST /ocr
   * FastAPI expects field "file"
   */
  async processDocument(file: File): Promise<OcrDocumentResponse> {
    const formData = new FormData();
    formData.append('file', file);

    return apiRequest<OcrDocumentResponse>('/ocr', {
      method: 'POST',
      body: formData,
      // Note: fetch will automatically set multipart/form-data with proper boundary
    });
  },

  /**
   * Upload and process multiple documents: POST /ocr/bulk
   * FastAPI expects field "files"
   */
  async processBulk(files: File[]): Promise<OcrBatchResponse | OcrDocumentResponse[]> {
    const formData = new FormData();
    files.forEach((file) => {
      formData.append('files', file);
    });

    return apiRequest<any>('/ocr/bulk', {
      method: 'POST',
      body: formData,
    });
  },
};
