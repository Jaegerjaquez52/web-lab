const startedAt = Date.now();
let httpRequests = 0;

export function trackRequest(_req, _res, next) {
  httpRequests += 1;
  next();
}

export function snapshot(extra = {}) {
  return {
    uptimeSec: Math.round((Date.now() - startedAt) / 1000),
    httpRequests,
    ...extra,
  };
}
