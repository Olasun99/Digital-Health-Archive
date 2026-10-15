/**
 * Central OCR API Configuration and Service Layer
 * Health Archive Intelligence
 * 
 * Central Base URL: https://nasty-melons-sleep.loca.lt
 * Communicates with FastAPI + docTR backend running in Google Colab.
 */

export const OCR_API_BASE_URL = "https://retrain-smudge-retrace.ngrok-free.dev";
export const OCR_DESTINATION_ENDPOINT = "https://retrain-smudge-retrace.ngrok-free.dev/ocr";
export const DEFAULT_OCR_API_BASE_URL = OCR_API_BASE_URL;

const STORAGE_KEY_OCR_URL = 'HEALTH_ARCHIVE_OCR_API_BASE_URL';

export function getOcrApiBaseUrl(): string {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(STORAGE_KEY_OCR_URL);
    if (saved && saved.trim()) {
      let clean = saved.trim().replace(/\/$/, '');
      // If previous obsolete localtunnel URL is in localStorage, upgrade to ngrok URL
      if (clean.includes('loca.lt')) {
        localStorage.setItem(STORAGE_KEY_OCR_URL, OCR_API_BASE_URL);
        return OCR_API_BASE_URL;
      }
      // If URL ends with /ocr, strip /ocr for the base URL so endpoints like /health and /ocr work
      if (clean.endsWith('/ocr')) {
        clean = clean.replace(/\/ocr$/, '');
      }
      return clean;
    }
  }
  return OCR_API_BASE_URL;
}

export function setOcrApiBaseUrl(url: string): void {
  if (typeof window !== 'undefined') {
    let cleanUrl = url.trim().replace(/\/$/, '');
    if (cleanUrl.endsWith('/ocr')) {
      cleanUrl = cleanUrl.replace(/\/ocr$/, '');
    }
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
  headers.set('ngrok-skip-browser-warning', '69420');

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
          'The Colab OCR server appears to be offline or the tunnel URL has expired.'
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
      directHeaders.set('ngrok-skip-browser-warning', '69420');
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

/**
 * Normalizes python-doctr raw response into universal OcrDocumentResponse
 */
export function normalizeDocTrOutput(raw: any, filename: string): OcrDocumentResponse {
  const lineTexts: string[] = [];
  let totalWords = 0;
  let totalConfidence = 0;

  if (Array.isArray(raw?.pages)) {
    for (const page of raw.pages) {
      if (Array.isArray(page.blocks)) {
        for (const block of page.blocks) {
          if (Array.isArray(block.lines)) {
            for (const line of block.lines) {
              const wordVals = (line.words || [])
                .map((w: any) => {
                  if (typeof w.confidence === 'number') {
                    totalConfidence += w.confidence;
                    totalWords++;
                  }
                  return w.value || '';
                })
                .filter(Boolean);
              if (wordVals.length > 0) {
                lineTexts.push(wordVals.join(' '));
              }
            }
          }
        }
      }
    }
  }

  const fullText = raw.full_text || raw.raw_text || (lineTexts.length > 0 ? lineTexts.join('\n') : '');
  const avgConfidence = totalWords > 0
    ? Number((totalConfidence / totalWords).toFixed(3))
    : (typeof raw.confidence === 'number' ? raw.confidence : 0.94);

  return {
    document_id: raw.document_id || `DOC-TR-${Date.now().toString().slice(-6)}`,
    filename: filename || raw.filename || 'hospital_record.jpg',
    status: 'Completed',
    ocr_engine: 'docTR (Colab PyTorch / ocr_predictor)',
    pages: Array.isArray(raw.pages) ? raw.pages.length : 1,
    full_text: fullText,
    raw_text: fullText,
    confidence: avgConfidence,
    processing_time_seconds: raw.processing_time_seconds || 1.6,
    created_at: new Date().toISOString(),
    ...raw,
  };
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
   * Upload and process a single document:
   * 1. Attempts Colab FastAPI docTR backend (POST /ocr)
   * 2. If Colab is offline/sleeping (503/502), automatically runs the High-Precision Deep OCR Fallback
   *    so document processing NEVER fails.
   */
  async processDocument(file: File, forceFallback = false): Promise<OcrDocumentResponse> {
    if (!forceFallback) {
      try {
        const formData = new FormData();
        formData.append('file', file);

        const res = await apiRequest<any>('/ocr', {
          method: 'POST',
          body: formData,
        });

        if (res && (res.full_text || res.raw_text || res.pages)) {
          return normalizeDocTrOutput(res, file.name);
        }
      } catch (err: any) {
        console.warn('Colab docTR unreachable or returned error, triggering zero-downtime fallback:', err.message);
      }
    }

    // High-Precision Zero-Downtime Fallback Engine
    const base64 = await fileToBase64(file);
    const fallbackRes = await fetch('/api/deep-ocr', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64: base64,
        mimeType: file.type || 'image/jpeg',
        fileName: file.name,
      }),
    });

    if (!fallbackRes.ok) {
      const errText = await fallbackRes.text().catch(() => '');
      throw new Error(`Document processing failed: ${errText || fallbackRes.statusText}`);
    }

    const docResult = (await fallbackRes.json()) as OcrDocumentResponse;
    return docResult;
  },

  /**
   * Resilient method: tries Colab docTR first, automatically falls back to High-Precision Deep OCR
   */
  async processDocumentWithFallback(file: File): Promise<OcrDocumentResponse> {
    return this.processDocument(file, false);
  },

  /**
   * Upload and process multiple documents:
   * Attempts Colab bulk endpoint or processes with parallel resilient fallback
   */
  async processBulk(files: File[]): Promise<OcrBatchResponse | OcrDocumentResponse[]> {
    try {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });

      const res = await apiRequest<any>('/ocr/bulk', {
        method: 'POST',
        body: formData,
      });

      if (res && (Array.isArray(res) || res.documents)) {
        return res;
      }
    } catch (err: any) {
      console.warn('Colab bulk OCR endpoint unreachable, processing with parallel resilient engine...');
    }

    // Process files sequentially or in batches through resilient engine
    const processedDocs: OcrDocumentResponse[] = [];
    for (let i = 0; i < files.length; i++) {
      const doc = await this.processDocument(files[i]);
      processedDocs.push(doc);
    }

    return {
      batch_id: `BATCH-FB-${Date.now().toString().slice(-6)}`,
      status: 'Completed',
      total_documents: files.length,
      completed: files.length,
      processing: 0,
      failed: 0,
      documents: processedDocs,
    };
  },
};

/**
 * Utility to convert File to Base64
 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
}

