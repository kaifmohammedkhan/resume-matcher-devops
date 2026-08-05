import { render, screen, fireEvent } from '@testing-library/react';
import Footer from './Footer';

test('renders footer and scrolls to top', () => {
  render(<Footer />);
  expect(screen.getByText(/Kaif Mohammed Khan/i)).toBeInTheDocument();
  const button = screen.getByRole('button', { name: /Back to top/i });
  fireEvent.click(button);
});
