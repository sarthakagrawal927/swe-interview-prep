import { useState, useCallback } from 'react';
import { transform } from 'sucrase';
import type { TestCase, Language } from '../types';

export interface TestResult extends TestCase {
  actual: unknown;
  passed: boolean;
  error?: string;
}

interface ExecuteResult {
  output: string;
  errors: string | null;
  testResults: TestResult[];
  execTimeMs: number;
  errorLine: number | null;
}

function transpileTS(code: string): { code: string | null; error: string | null } {
  try {
    const result = transform(code, { transforms: ['typescript'], disableESTransforms: true });
    return { code: result.code, error: null };
  } catch (e: any) {
    return { code: null, error: e.message };
  }
}

export function useCodeExecution() {
  const [output, setOutput] = useState('');
  const [errors, setErrors] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [execTimeMs, setExecTimeMs] = useState<number>(0);
  const [errorLine, setErrorLine] = useState<number | null>(null);

  const execute = useCallback((code: string, testCases: TestCase[], language: Language = 'typescript'): Promise<ExecuteResult> => {
    setIsRunning(true);
    setOutput('');
    setErrors(null);
    setTestResults([]);

    let jsCode = code;
    if (language === 'typescript') {
      const { code: transpiled, error } = transpileTS(code);
      if (error) {
        setErrors('TypeScript Error: ' + error);
        setErrorLine(null);
        setIsRunning(false);
        return Promise.resolve({ output: '', errors: 'TypeScript Error: ' + error, testResults: [], execTimeMs: 0, errorLine: null });
      }
      jsCode = transpiled!;
    }

    return new Promise((resolve) => {
      const iframe = document.createElement('iframe');
      iframe.style.display = 'none';
      iframe.sandbox.add('allow-scripts');

      const testCasesJSON = JSON.stringify(testCases || []);
      const funcMatchRegex = `
        const funcMatches = userCode.match(/function\\s+(\\w+)/g);
        let funcName = null;
        if (funcMatches) {
          const m = funcMatches[0].match(/function\\s+(\\w+)/);
          funcName = m ? m[1] : null;
        }
        if (!funcName) {
          const arrowMatch = userCode.match(/(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:\\(|function)/);
          funcName = arrowMatch ? arrowMatch[1] : null;
        }
      `;

      const html = `<!DOCTYPE html><html><body><script>
        const logs = [];
        console.log = function() {
          const args = Array.from(arguments);
          logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
        };
        console.error = function() { logs.push('ERROR: ' + Array.from(arguments).map(String).join(' ')); };
        console.warn = function() { logs.push('WARN: ' + Array.from(arguments).map(String).join(' ')); };
        console.info = function() { logs.push('INFO: ' + Array.from(arguments).map(String).join(' ')); };
        console.assert = function(condition) {
          if (!condition) {
            const args = Array.from(arguments).slice(1);
            const msg = args.length > 0 ? args.map(function(a) { return typeof a === 'object' ? JSON.stringify(a) : String(a); }).join(' ') : '';
            logs.push('Assertion failed: ' + msg);
          }
        };
        var _t0 = performance.now();
        try {
          const userCode = ${JSON.stringify(jsCode)};
          eval(userCode);
          const testCases = ${testCasesJSON};
          ${funcMatchRegex}
          const results = testCases.map(function(tc) {
            try {
              if (funcName) {
                const argsStr = JSON.stringify(tc.args);
                const result = eval(funcName + '(...' + argsStr + ')');
                const passed = JSON.stringify(result) === JSON.stringify(tc.expected);
                return { args: tc.args, expected: tc.expected, description: tc.description, actual: result, passed: passed };
              }
              return { args: tc.args, expected: tc.expected, description: tc.description, actual: null, passed: false, error: 'No function found' };
            } catch(e) {
              return { args: tc.args, expected: tc.expected, description: tc.description, actual: null, passed: false, error: e.message };
            }
          });
          var _t1 = performance.now();
          parent.postMessage({ type: 'exec-result', output: logs.join('\\n'), errors: null, testResults: results, execTimeMs: _t1 - _t0 }, '*');
        } catch(e) {
          var _t1 = performance.now();
          var _errLine = null;
          if (e.stack) {
            var _m = e.stack.match(/eval.*?(\\d+):(\\d+)/);
            if (_m) _errLine = parseInt(_m[1], 10);
          }
          parent.postMessage({ type: 'exec-result', output: logs.join('\\n'), errors: e.message, testResults: [], execTimeMs: _t1 - _t0, errorLine: _errLine }, '*');
        }
      </script></body></html>`;

      let timeout: ReturnType<typeof setTimeout>;
      const handler = (event: MessageEvent) => {
        if (event.data?.type === 'exec-result') {
          clearTimeout(timeout);
          window.removeEventListener('message', handler);
          document.body.removeChild(iframe);
          const { output: out, errors: err, testResults: results, execTimeMs: time, errorLine: eLine } = event.data;
          setOutput(out || '');
          setErrors(err);
          setTestResults(results || []);
          setExecTimeMs(time || 0);
          setErrorLine(eLine || null);
          setIsRunning(false);
          resolve({ output: out, errors: err, testResults: results, execTimeMs: time || 0, errorLine: eLine || null });
        }
      };
      window.addEventListener('message', handler);
      timeout = setTimeout(() => {
        window.removeEventListener('message', handler);
        if (iframe.parentNode) document.body.removeChild(iframe);
        setErrors('Execution timed out (5s limit)');
        setErrorLine(null);
        setIsRunning(false);
        resolve({ output: '', errors: 'Execution timed out (5s limit)', testResults: [], execTimeMs: 5000, errorLine: null });
      }, 5000);
      document.body.appendChild(iframe);
      iframe.srcdoc = html;
    });
  }, []);

  const clearOutput = useCallback(() => {
    setOutput('');
    setErrors(null);
    setTestResults([]);
  }, []);

  return { execute, output, errors, testResults, isRunning, execTimeMs, errorLine, clearOutput };
}
