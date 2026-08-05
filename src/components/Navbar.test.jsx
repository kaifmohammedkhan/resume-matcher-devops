import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Navbar from './Navbar';

test('renders navbar links', () => {
  render(<MemoryRouter><Navbar /></MemoryRouter>);
  expect(screen.getByText(/Resume Matcher/i)).toBeInTheDocument();
  expect(screen.getByText(/Home/i)).toHaveAttribute('href', '/');
  expect(screen.getByText(/About/i)).toHaveAttribute('href', '/about');
  expect(screen.getByText(/Connect/i)).toHaveAttribute('href', '/connect');
});
