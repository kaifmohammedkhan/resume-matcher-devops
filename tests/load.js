import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus: 1,
  iterations: 1,

  thresholds: {
    http_req_failed: ['rate<0.01'],
    checks: ['rate>0.99'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const response = http.get('http://127.0.0.1:3000/');

  check(response, {
    'application is reachable': (res) => res.status !== 0,
    'HTTP status is 200': (res) => res.status === 200,
  });

  sleep(1);
}