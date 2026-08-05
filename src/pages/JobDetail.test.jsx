import { jest } from '@jest/globals';
import axios from 'axios';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import JobDetail from './JobDetail';

test('renders loading state initially', () => {
  axios.get = jest.fn().mockResolvedValueOnce({ data: null });

  render(
    <MemoryRouter initialEntries={['/job/123']}>
      <Routes>
        <Route path="/job/:id" element={<JobDetail />} />
      </Routes>
    </MemoryRouter>
  );

  expect(screen.getByText(/Loading job details/i)).toBeInTheDocument();
});

test('renders error state when API fails', async () => {
  axios.get = jest.fn().mockRejectedValueOnce(new Error('Network error'));

  render(
    <MemoryRouter initialEntries={['/job/123']}>
      <Routes>
        <Route path="/job/:id" element={<JobDetail />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(/Job not found/i)).toBeInTheDocument();
});

test('renders job details when API succeeds', async () => {
  axios.get = jest.fn().mockResolvedValueOnce({
    data: { title: 'Frontend Developer', description: 'Build UI', url: 'http://apply', source: 'LinkedIn' }
  });

  render(
    <MemoryRouter initialEntries={['/job/123']}>
      <Routes>
        <Route path="/job/:id" element={<JobDetail />} />
      </Routes>
    </MemoryRouter>
  );

  expect(await screen.findByText(/Frontend Developer/i)).toBeInTheDocument();
  expect(await screen.findByText(/Build UI/i)).toBeInTheDocument();
  expect(await screen.findByText(/Apply on LinkedIn/i)).toBeInTheDocument();
});
