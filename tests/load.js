import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 10,
  duration: '30s',

  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: [
      'p(95)<500',
      'p(99)<1000',
    ],
    checks: ['rate>0.99'],
  },
}

export default function () {
  const response = http.get('http://127.0.0.1:3000', {
    redirects: 0,
  })

  check(response, {
    'HTTP status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  })

  sleep(1)
}