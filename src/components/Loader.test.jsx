import { render } from '@testing-library/react';
import Loader from './Loader';

test('renders loader spinner', () => {
  const { container } = render(<Loader />);
  expect(container.querySelector('.animate-spin')).toBeInTheDocument();
});
