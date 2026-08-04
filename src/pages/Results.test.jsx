import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { expect, jest } from '@jest/globals';
import { fileURLToPath } from 'node:url';

jest.unstable_mockModule(
  fileURLToPath(new URL('../components/Footer.jsx', import.meta.url)),
  () => ({
    default: () => <div data-testid="mock-footer">Footer</div>,
  })
);

const { Results } = await import(
  fileURLToPath(new URL('./Results.jsx', import.meta.url))
);

const mockJobs = [
  {
    job_id: '1',
    job_title: 'DevOps Engineer',
    company: 'TechCorp',
    source: 'LinkedIn',
    job_description: 'Looking for a DevOps engineer experienced with Docker, Kubernetes, and AWS.',
    job_apply_link: 'https://example.com/apply1',
    job_posted_at_datetime_utc: '2026-04-01T10:00:00Z',
  },
  {
    job_id: '2',
    job_title: 'Cloud Architect',
    company: 'CloudInc',
    source: 'Indeed',
    job_description: 'Architecting solutions using AWS, Terraform, Docker, and CI/CD pipelines.',
    job_apply_link: 'https://example.com/apply2',
    job_posted_at_datetime_utc: '2026-04-02T10:00:00Z',
  },
  {
    job_id: '3',
    job_title: 'Frontend Developer',
    company: 'WebStudio',
    source: 'Other',
    job_description: 'React developer with experience in Tailwind CSS and JavaScript.',
    job_apply_link: '',
    job_posted_at_datetime_utc: '2026-03-28T10:00:00Z',
  },
];

const renderWithRouterState = (jobs = mockJobs, keywords = ['docker', 'kubernetes', 'aws', 'react']) => {
  return render(
    <MemoryRouter
      initialEntries={[
        {
          pathname: '/results',
          state: { jobs, keywords },
        },
      ]}
    >
      <Routes>
        <Route path="/results" element={<Results />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('Results Component', () => {
  test('renders navigation header, section title, and footer', () => {
    renderWithRouterState();

    expect(screen.getByRole('heading', { level: 1, name: /resume matcher/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: /matched jobs/i })).toBeInTheDocument();
    expect(screen.getByTestId('mock-footer')).toBeInTheDocument();
  });

  test('calculates correct keyword match scores and displays jobs', () => {
    renderWithRouterState();

    expect(screen.getByText('DevOps Engineer')).toBeInTheDocument();
    expect(screen.getByText('3 keywords')).toBeInTheDocument();
  });

  test('filters jobs based on minimum keyword match score selection', async () => {
    const user = userEvent.setup();
    renderWithRouterState();

    const filterSelect = screen.getByRole('combobox', { name: /filter by minimum keyword matches/i });
    await user.selectOptions(filterSelect, '3');

    expect(screen.getByText('DevOps Engineer')).toBeInTheDocument();
    expect(screen.queryByText('Frontend Developer')).not.toBeInTheDocument();
  });

  test('displays empty state message when no jobs match filter criteria', async () => {
    const user = userEvent.setup();
    renderWithRouterState();

    const filterSelect = screen.getByRole('combobox', { name: /filter by minimum keyword matches/i });
    await user.selectOptions(filterSelect, '10');

    expect(screen.getByText('No matching jobs found.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry search/i })).toBeInTheDocument();
  });

  test('handles apply link fallbacks correctly for unavailable links', () => {
    renderWithRouterState();

    const disabledBtn = screen.getByText('Link Unavailable');
    expect(disabledBtn).toBeInTheDocument();
    expect(disabledBtn).toHaveClass('cursor-not-allowed');
  });

  test('paginates results correctly when jobs exceed 10 per page', () => {
    const manyJobs = Array.from({ length: 15 }, (_, i) => ({
      job_id: `job-${i + 1}`,
      job_title: `Role ${i + 1}`,
      job_description: 'docker kubernetes aws',
      job_apply_link: `https://example.com/job-${i + 1}`,
    }));

    renderWithRouterState(manyJobs, ['docker', 'kubernetes', 'aws']);

    expect(screen.getByText('Role 1')).toBeInTheDocument();
    expect(screen.getByText('Role 10')).toBeInTheDocument();
    expect(screen.queryByText('Role 11')).not.toBeInTheDocument();
  });
});
