import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import Home from './Home';

test('renders Home page and handles file upload', () => {
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );

  expect(screen.getByText(/Resume to Active Roles/i)).toBeInTheDocument();

  const fileInput = screen.getByLabelText(/Choose your PDF resume/i);
  const file = new File(['resume content'], 'resume.pdf', { type: 'application/pdf' });

  fireEvent.change(fileInput, { target: { files: [file] } });
  expect(screen.getByText(/Selected: resume.pdf/i)).toBeInTheDocument();
});

test('disables Upload & Match button when no file selected', () => {
  render(
    <MemoryRouter>
      <Home />
    </MemoryRouter>
  );

  const button = screen.getByRole('button', { name: /Upload & Match/i });
  expect(button).toBeDisabled();
});
