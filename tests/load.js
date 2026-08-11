import http from 'k6/http';
import { check, sleep } from 'k6';

export default function () {
  const res = http.get('http://127.0.0.1:3000');

  const ok = check(res, {
    'HTTP status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  });

  if (!ok) {
    console.log(`STATUS=${res.status} BODY=${res.body}`);
  }

  sleep(1);
}