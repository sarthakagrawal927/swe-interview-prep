/**
 * Hybrid Go executor — starts with API, switches to local WASM once loaded.
 *
 * Flow:
 * 1. First Go run → API call to /api/go-run
 * 2. Background: start loading WASM interpreter
 * 3. Once WASM is ready → all subsequent runs use local WASM
 */

export type GoBackend = 'api' | 'wasm' | 'wasm-loading';

interface GoResult {
  output: string;
  errors: string | null;
  execTimeMs: number;
  errorLine: number | null;
  backend: GoBackend;
}

let wasmReady = false;
let wasmLoading = false;
let wasmLoadPromise: Promise<boolean> | null = null;

function extractErrorLine(err: string): number | null {
  // Go compile errors: "prog.go:5:3:" or yaegi: "1:5:"
  const m = err.match(/(?:prog\.go:|^)(\d+):\d+/m);
  return m ? parseInt(m[1], 10) : null;
}

/** Run Go code via the Vercel serverless API proxy */
async function executeViaAPI(code: string): Promise<GoResult> {
  const t0 = performance.now();
  try {
    const res = await fetch('/api/go-run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });
    const data = await res.json();
    const time = performance.now() - t0;
    const errors = data.errors || data.error || null;
    return {
      output: data.output || '',
      errors,
      execTimeMs: time,
      errorLine: errors ? extractErrorLine(errors) : null,
      backend: 'api',
    };
  } catch (e: any) {
    return {
      output: '',
      errors: 'Go API error: ' + e.message,
      execTimeMs: performance.now() - t0,
      errorLine: null,
      backend: 'api',
    };
  }
}

/** Run Go code via the local WASM interpreter (Yaegi) */
async function executeViaWASM(code: string): Promise<GoResult> {
  const goRunCode = (window as any).__goRunCode;
  if (!goRunCode) {
    return executeViaAPI(code);
  }

  const t0 = performance.now();
  try {
    const result = goRunCode(code);
    const time = performance.now() - t0;
    const output = result.output || '';
    const errors = result.errors || null;
    return {
      output,
      errors,
      execTimeMs: time,
      errorLine: errors ? extractErrorLine(errors) : null,
      backend: 'wasm',
    };
  } catch (e: any) {
    // WASM execution failed — fall back to API
    console.warn('WASM execution failed, falling back to API:', e.message);
    return executeViaAPI(code);
  }
}

/** Load the WASM interpreter in the background */
export function startWASMLoading(): void {
  if (wasmReady || wasmLoading) return;
  wasmLoading = true;

  wasmLoadPromise = (async () => {
    try {
      // Load wasm_exec.js (Go's WASM glue)
      if (!(window as any).Go) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement('script');
          script.src = '/wasm/wasm_exec.js';
          script.onload = () => resolve();
          script.onerror = () => reject(new Error('Failed to load wasm_exec.js'));
          document.head.appendChild(script);
        });
      }

      // Instantiate the Go WASM module
      const go = new (window as any).Go();
      const response = await fetch('/wasm/go-interp.wasm');
      const result = await WebAssembly.instantiateStreaming(response, go.importObject);
      go.run(result.instance); // starts the Go main() which sets __goRunCode

      // Wait for __goRunCode to be available
      await new Promise<void>((resolve) => {
        const check = () => {
          if ((window as any).__goRunCode) {
            resolve();
          } else {
            setTimeout(check, 50);
          }
        };
        check();
      });

      wasmReady = true;
      wasmLoading = false;
      console.log('Go WASM interpreter loaded successfully');
      return true;
    } catch (e) {
      console.warn('Failed to load Go WASM interpreter:', e);
      wasmLoading = false;
      return false;
    }
  })();
}

/** Execute Go code using the best available backend */
export async function executeGo(code: string): Promise<GoResult> {
  if (wasmReady) {
    return executeViaWASM(code);
  }

  // Start loading WASM in background on first Go execution
  if (!wasmLoading && !wasmLoadPromise) {
    startWASMLoading();
  }

  return executeViaAPI(code);
}

/** Get the current backend status */
export function getGoBackendStatus(): GoBackend {
  if (wasmReady) return 'wasm';
  if (wasmLoading) return 'wasm-loading';
  return 'api';
}
