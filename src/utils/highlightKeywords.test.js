import { highlightKeywords } from './highlightKeywords.js';

test('highlights keywords in text', () => {
  const text = 'React and Node are popular';
  const result = highlightKeywords(text, ['React', 'Node']);
  expect(result).toMatch(/<span.*>React<\/span>/);
  expect(result).toMatch(/<span.*>Node<\/span>/);
});
