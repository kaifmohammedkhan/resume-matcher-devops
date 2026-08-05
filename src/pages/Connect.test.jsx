import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Connect from './Connect';

test('renders Connect page with social links', () => {
  render(
    <MemoryRouter>
      <Connect />
    </MemoryRouter>
  );

  expect(screen.getByText(/Connect with Me/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Email/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/LinkedIn/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/GitHub/i)).toBeInTheDocument();
  expect(screen.getByLabelText(/Instagram/i)).toBeInTheDocument();
});
