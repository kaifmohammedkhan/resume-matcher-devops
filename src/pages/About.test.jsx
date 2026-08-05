import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import About from './About';

test('renders About page content', () => {
  render(
    <MemoryRouter>
      <About />
    </MemoryRouter>
  );

  expect(screen.getByText(/About This Platform/i)).toBeInTheDocument();
  expect(screen.getByText(/Resume Matcher/i)).toBeInTheDocument();
  expect(screen.getByText(/upload Resume in PDF format/i)).toBeInTheDocument();
});
