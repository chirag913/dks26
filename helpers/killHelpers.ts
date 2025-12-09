// helpers/killHelpers.ts
export type PerformCompleteKillOpts = {
  pauseMs?: number;      // ms to wait between steps
  retryFinal?: number;   // number of final status check attempts
  backoffMs?: number;    // base backoff ms for retries
};

export async function performCompleteKill(dhan: any, opts: PerformCompleteKillOpts = {}) {
  const pauseMs = typeof opts.pauseMs === 'number' ? opts.pauseMs : 2000;
  const retryFinal = typeof opts.retryFinal === 'number' ? opts.retryFinal : 5;
  const backoffMs = typeof opts.backoffMs === 'number' ? opts.backoffMs : 500;

  const trace: any[] = [];
  const now = () => new Date().toISOString();

  const wait = (ms: number) => new Promise((res) => setTimeout(res, ms));

  // helper for safe calls that returns a normalized result
  const safeCall = async (fnName: string, fn: () => Promise<any>) => {
    try {
      const r = await fn();
      trace.push({ ts: now(), fn: fnName, ok: true, result: r });
      return { ok: true, result: r };
    } catch (err: any) {
      trace.push({ ts: now(), fn: fnName, ok: false, error: String(err?.message ?? err) });
      return { ok: false, error: String(err?.message ?? err) };
    }
  };

  // Step A: First activate
  trace.push({ ts: now(), step: 'activate_1_start' });
  await safeCall('activateKillSwitch', () => {
    if (typeof dhan.activateKillSwitch !== 'function') {
      return Promise.reject(new Error('activateKillSwitch not available on Dhan client'));
    }
    return dhan.activateKillSwitch();
  });
  await wait(pauseMs);

  // Step B: Deactivate
  trace.push({ ts: now(), step: 'deactivate_start' });
  await safeCall('deactivateKillSwitch', () => {
    if (typeof dhan.deactivateKillSwitch !== 'function') {
      return Promise.reject(new Error('deactivateKillSwitch not available on Dhan client'));
    }
    return dhan.deactivateKillSwitch();
  });
  await wait(pauseMs);

  // Step C: Activate again
  trace.push({ ts: now(), step: 'activate_2_start' });
  await safeCall('activateKillSwitch', () => {
    if (typeof dhan.activateKillSwitch !== 'function') {
      return Promise.reject(new Error('activateKillSwitch not available on Dhan client'));
    }
    return dhan.activateKillSwitch();
  });

  // Final confirmation loop
  let finalOK = false;
  for (let i = 0; i < retryFinal; i++) {
    const attempt = i + 1;
    trace.push({ ts: now(), step: 'final_check_start', attempt });

    // try getKillSwitchStatus if available, else attempt a read-call pattern
    let statusResult: any = { ok: null, error: 'no-status-method' };
    if (typeof dhan.getKillSwitchStatus === 'function') {
      statusResult = await safeCall('getKillSwitchStatus', () => dhan.getKillSwitchStatus());
    } else if (typeof dhan.fetchKillSwitchStatus === 'function') {
      statusResult = await safeCall('fetchKillSwitchStatus', () => dhan.fetchKillSwitchStatus());
    } else {
      // attempt GET /killswitch via generic fetch if client exposes a low-level request method
      // fallback: no programmatic status available
      trace.push({ ts: now(), warning: 'No status method on Dhan client; cannot confirm final state programmatically' });
    }

    // Evaluate statusResult to determine whether kill is active.
    try {
      const result = statusResult?.result ?? null;
      const ok = statusResult?.ok === true;
      // heuristics to detect active:
      const isActive =
        ok &&
        (result === true ||
          result?.isActive === true ||
          result?.killSwitch === true ||
          (typeof result === 'string' && /active/i.test(result)) ||
          (result?.data && /active/i.test(String(result.data))));

      trace.push({ ts: now(), attempt, statusChecked: result ?? null, isActive });

      if (isActive) {
        finalOK = true;
        break;
      }
    } catch (e) {
      trace.push({ ts: now(), attempt, statusCheckError: String(e) });
    }

    // backoff wait
    await wait(backoffMs * attempt);
  }

  trace.push({ ts: now(), finalOK });

  return { final: finalOK, trace };
}

// also export default so import styles won't break other places
export default performCompleteKill;
