import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import { GoogleGenAI } from '@google/genai';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      {
        name: 'api-server-middleware',
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = new URL(req.url || '', `http://${req.headers.host || 'localhost:3000'}`);

            // CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-ocr-base-url');

            if (req.method === 'OPTIONS') {
              res.statusCode = 204;
              res.end();
              return;
            }

            // Local App health check
            if (url.pathname === '/api/health' || url.pathname === '/api/health/') {
              res.setHeader('Content-Type', 'application/json');
              res.statusCode = 200;
              res.end(JSON.stringify({ status: 'ok', version: '0.1.0' }));
              return;
            }

            // Gemini Clinical Information Extraction endpoint
            if (url.pathname === '/api/extract' && req.method === 'POST') {
              try {
                let body = '';
                for await (const chunk of req) {
                  body += chunk;
                }
                const { ocrText, documentId, pages } = JSON.parse(body || '{}');

                if (!ocrText || typeof ocrText !== 'string') {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'ocrText is required' }));
                  return;
                }

                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server' }));
                  return;
                }

                const ai = new GoogleGenAI({ apiKey });

                const systemInstruction = `You are an expert clinical health data extraction specialist for the "Health Archive Intelligence" platform.
Your task is to transform raw OCR text from scanned/photographed hospital documents into structured clinical JSON.

RULES:
1. Extract ONLY what is literally visible or stated in the OCR text.
2. NEVER guess, invent, or extrapolate missing data. If a field is not present, return null.
3. This is STRICTLY information extraction, NOT clinical diagnosis. Do not diagnose symptoms. Only extract diagnoses that are explicitly documented in the text.
4. If OCR text is ambiguous or degraded, record the extracted value and flag it under "uncertainties".
5. For each field, preserve source page attribution if identifiable.
6. Return purely valid JSON adhering strictly to the requested schema.`;

                const prompt = `Convert the following hospital document OCR text into structured JSON according to this exact specification:

OCR TEXT:
"""
${ocrText}
"""

DOCUMENT CONTEXT:
Document ID: ${documentId || 'DOC-UNKNOWN'}
Total Pages: ${pages || 1}

JSON SCHEMA:
{
  "patient": {
    "patient_name": string or null,
    "hospital_number": string or null,
    "date_of_birth": string or null,
    "age": string or number or null,
    "sex": "Male" | "Female" | "Other" | null,
    "address": string or null
  },
  "encounter": {
    "encounter_date": string or null,
    "encounter_type": "Outpatient" | "Inpatient" | "Emergency" | "Laboratory" | "Pharmacy" | "Other" | null,
    "department": string or null,
    "attending_clinician": string or null
  },
  "clinical_information": {
    "chief_complaint": string or null,
    "history_of_present_illness": string or null,
    "symptoms": string[] or null,
    "clinical_observations": string[] or null,
    "diagnoses": string[] or null
  },
  "vital_signs": {
    "blood_pressure": string or null,
    "heart_rate": string or null,
    "respiratory_rate": string or null,
    "temperature": string or null,
    "oxygen_saturation": string or null,
    "weight": string or null,
    "height": string or null
  },
  "laboratory": [
    {
      "test_name": string,
      "result": string,
      "unit": string or null,
      "reference_range": string or null,
      "test_date": string or null
    }
  ],
  "medications": [
    {
      "medication_name": string,
      "dose": string or null,
      "route": string or null,
      "frequency": string or null,
      "duration": string or null
    }
  ],
  "doctor_notes": {
    "clinical_notes": string or null
  },
  "document_metadata": {
    "document_type": "Outpatient Record" | "Laboratory Report" | "Prescription" | "Doctor's Note" | "Admission Record" | "Discharge Summary" | "Referral" | "Imaging Report" | "Other" | "Unknown",
    "document_date": string or null,
    "source_document_id": "${documentId || 'DOC-UNKNOWN'}",
    "source_page": 1
  },
  "confidence_review": {
    "extraction_confidence": number between 0.0 and 1.0,
    "requires_review": boolean,
    "uncertainties": string[]
  }
}`;

                const response = await ai.models.generateContent({
                  model: 'gemini-3.8-flash',
                  contents: prompt,
                  config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
                    temperature: 0.1,
                  },
                });

                const content = response.text?.trim() || '{}';
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(content);
                return;
              } catch (err: any) {
                console.error('Gemini extraction error:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err?.message || 'Failed to extract clinical information' }));
                return;
              }
            }

            // Step 3 - Intelligent Tabularisation Endpoint
            if (url.pathname === '/api/tabularise' && req.method === 'POST') {
              try {
                let body = '';
                for await (const chunk of req) {
                  body += chunk;
                }
                const { rawOcrText, fileName, documentId } = JSON.parse(body || '{}');

                if (!rawOcrText || typeof rawOcrText !== 'string') {
                  res.statusCode = 400;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'rawOcrText is required' }));
                  return;
                }

                const apiKey = process.env.GEMINI_API_KEY;
                if (!apiKey) {
                  res.statusCode = 500;
                  res.setHeader('Content-Type', 'application/json');
                  res.end(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server' }));
                  return;
                }

                const ai = new GoogleGenAI({ apiKey });

                const systemInstruction = `You are a medical health data tabularisation specialist.
Your task is to take raw OCR text from a hospital document (patient card, lab report, prescription, doctor notes, or general health form) and convert it into a structured tabular format.

MANDATORY RULES:
1. Target Columns:
   - File_Name
   - Patient_Name
   - Age
   - Gender
   - Hospital_No
   - Date
   - Diagnosis
   - Lab_Test
   - Result
   - Value
   - Unit
   - Reference_Range
   - Doctor_Notes
   - Confidence_Score (number between 0.0 and 1.0)
   - Provenance_Snippet (the exact text snippet from the raw OCR evidence)

2. If the document is a TABLE (e.g. lab report with multiple tests), expand it so each test is its OWN row, repeating the Patient_Name, Hospital_No, and Date for each row.
3. If the document is a FORM (patient card / consultation), map key-value pairs into the row columns.
4. If a piece of handwriting is ambiguous, degraded, or unclear, mark it as "[ILLEGIBLE - Confidence X%]" where X is the estimated confidence (e.g. 45%).
5. NEVER hallucinate data. If a field is not present in the document, use an empty string ("").
6. Provide an accurate Confidence_Score for each row. If any item is illegible or faint, reduce the score below 0.70.
7. Return a JSON object with a "rows" array.`;

                const prompt = `Convert the following raw OCR text into tabular rows.

FILE NAME: ${fileName || 'document.jpg'}
DOCUMENT ID: ${documentId || 'DOC-001'}

RAW OCR TEXT:
"""
${rawOcrText}
"""

Return JSON in this exact structure:
{
  "rows": [
    {
      "File_Name": "${fileName || 'document.jpg'}",
      "Patient_Name": string,
      "Age": string,
      "Gender": string,
      "Hospital_No": string,
      "Date": string,
      "Diagnosis": string,
      "Lab_Test": string,
      "Result": string,
      "Value": string,
      "Unit": string,
      "Reference_Range": string,
      "Doctor_Notes": string,
      "Confidence_Score": number,
      "Provenance_Snippet": string
    }
  ]
}`;

                const response = await ai.models.generateContent({
                  model: 'gemini-3.8-flash',
                  contents: prompt,
                  config: {
                    systemInstruction,
                    responseMimeType: 'application/json',
                    temperature: 0.1,
                  },
                });

                const content = response.text?.trim() || '{"rows":[]}';
                res.setHeader('Content-Type', 'application/json');
                res.statusCode = 200;
                res.end(content);
                return;
              } catch (err: any) {
                console.error('Tabularisation error:', err);
                res.statusCode = 500;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({ error: err?.message || 'Failed to tabularise document' }));
                return;
              }
            }

            // Proxy to Colab OCR backend
            if (url.pathname.startsWith('/api/ocr-proxy/')) {
              const subPath = url.pathname.replace('/api/ocr-proxy', '');
              const targetBase = (req.headers['x-ocr-base-url'] as string) || process.env.OCR_API_BASE_URL || 'https://nasty-melons-sleep.loca.lt';
              const targetUrl = `${targetBase.replace(/\/$/, '')}${subPath}${url.search}`;

              try {
                const proxyHeaders: Record<string, string> = {
                  'bypass-tunnel-reminder': 'true',
                  'Bypass-Tunnel-Reminder': '1',
                  'User-Agent': 'HealthArchiveIntelligence/1.0',
                };
                if (req.headers['content-type']) {
                  proxyHeaders['content-type'] = req.headers['content-type'] as string;
                }

                // Collect request body if POST/PUT
                let bodyBuffer: Buffer | undefined = undefined;
                if (['POST', 'PUT', 'PATCH'].includes(req.method || '')) {
                  const chunks: Buffer[] = [];
                  for await (const chunk of req) {
                    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
                  }
                  bodyBuffer = Buffer.concat(chunks);
                }

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 60000); // 60s timeout for heavy OCR

                const response = await fetch(targetUrl, {
                  method: req.method,
                  headers: proxyHeaders,
                  body: bodyBuffer as any,
                  signal: controller.signal,
                });
                clearTimeout(timeoutId);

                res.statusCode = response.status;
                const contentType = response.headers.get('content-type') || 'application/json';
                res.setHeader('Content-Type', contentType);
                const arrayBuffer = await response.arrayBuffer();
                res.end(Buffer.from(arrayBuffer));
                return;
              } catch (err: any) {
                res.statusCode = 502;
                res.setHeader('Content-Type', 'application/json');
                res.end(JSON.stringify({
                  error: 'OCR backend unreachable',
                  message: err?.message || 'Could not connect to Colab OCR server',
                  targetUrl,
                  details: 'The Colab runtime may be offline, stopped, or the Localtunnel URL has changed.'
                }));
                return;
              }
            }

            next();
          });
        },
      },
    ],
    resolve: {
      alias: {
        '@': path.resolve('.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});


