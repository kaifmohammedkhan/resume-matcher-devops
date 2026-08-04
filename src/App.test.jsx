import React from 'react';
import { render, screen } from '@testing-library/react';
import { expect, jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';
import * as matchers from '@testing-library/jest-dom/matchers';

expect.extend(matchers);

jest.unstable_mockModule(
  fileURLToPath(new URL('./pages/JobDetail.jsx', import.meta.url)),
  () => ({
    default: () => <div data-testid="page-job-detail">Job Detail Page</div>,
  })
);

jest.unstable_mockModule(
  fileURLToPath(new URL('./pages/About.jsx', import.meta.url)),
  () => ({
    default: () => <div data-testid="page-about">About Page</div>,
  })
);

jest.unstable_mockModule(
  fileURLToPath(new URL('./pages/Connect.jsx', import.meta.url)),
  () => ({
    default: () => <div data-testid="page-connect">Connect Page</div>,
  })
);

const { default: App } = await import(
  fileURLToPath(new URL('./App.jsx', import.meta.url))
);

describe('App Component', () => {
  it('renders without crashing', () => {
    render(<App />);
    expect(document.body).toBeInTheDocument();
  });
});