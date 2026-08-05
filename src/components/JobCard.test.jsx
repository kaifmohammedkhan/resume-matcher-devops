import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JobCard from './JobCard';

const job = { id: 1, title: 'Dev', company: 'ACME', location: 'Remote', url: 'http://apply' };

test('renders job info and links', () => {
  render(<MemoryRouter><JobCard job={job} /></MemoryRouter>);
  expect(screen.getByText(/Dev/i)).toBeInTheDocument();
  expect(screen.getByText(/ACME/i)).toBeInTheDocument();
  expect(screen.getByText(/View Full Job/i)).toHaveAttribute('href', '/job/1');
  expect(screen.getByText(/Apply Now/i)).toHaveAttribute('href', 'http://apply');
});

test('renders disabled button when no url', () => {
  const noUrlJob = { ...job, url: null };
  render(<MemoryRouter><JobCard job={noUrlJob} /></MemoryRouter>);
  expect(screen.getByText(/No Link/i)).toBeDisabled();
});
