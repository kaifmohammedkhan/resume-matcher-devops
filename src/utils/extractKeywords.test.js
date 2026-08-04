import { extractKeywords } from './extractKeywords'; // Adjust path as needed

describe('extractKeywords', () => {
  test('normalizes text, converts to lowercase, and extracts clean keywords', () => {
    const input = 'React.js, Node.js & Docker!';
    const result = extractKeywords(input);

    // 'js' is 2 characters, so it is filtered out by the w.length > 2 rule
    expect(result.tech).toEqual(expect.arrayContaining(['react', 'node', 'docker']));
    expect(result.tech).not.toContain('js');
    expect(result.tech).not.toContain('react.js');
  });

  test('filters out blacklisted words and short words (length <= 2)', () => {
    const input = 'The engineer with experience in Docker and Kubernetes for my team';
    const result = extractKeywords(input);

    // Blacklisted words that should NOT be present
    expect(result.tech).not.toContain('the');
    expect(result.tech).not.toContain('with');
    expect(result.tech).not.toContain('experience');
    expect(result.tech).not.toContain('for');
    expect(result.tech).not.toContain('my');

    // Short words (length <= 2) should NOT be present
    expect(result.tech).not.toContain('in');

    // Valid keywords that SHOULD be present
    expect(result.tech).toContain('engineer');
    expect(result.tech).toContain('docker');
    expect(result.tech).toContain('kubernetes');
    expect(result.tech).toContain('team');
  });

  test('replaces slashes, hyphens, and newlines with spaces', () => {
    const input = 'DevOps/SRE-Engineer\nFull-Stack\r\nDeveloper';
    const result = extractKeywords(input);

    expect(result.tech).toEqual(
      expect.arrayContaining(['devops', 'sre', 'engineer', 'full', 'stack', 'developer'])
    );
  });

  test('correctly categorizes job titles', () => {
    const input = 'Senior Software Engineer, Cloud Architect, and Lead Developer';
    const result = extractKeywords(input);

    expect(result.titles).toEqual(
      expect.arrayContaining(['engineer', 'architect', 'lead', 'developer'])
    );
  });

  test('correctly categorizes education terms', () => {
    const input = 'Holds a Bachelor degree and BTech in Computer Science, pursuing Master or PhD';
    const result = extractKeywords(input);

    expect(result.education).toEqual(
      expect.arrayContaining(['bachelor', 'degree', 'btech', 'master', 'phd'])
    );
  });

  test('deduplicates repeating words across categories', () => {
    const input = 'Developer developer DEVELOPER engineer engineer';
    const result = extractKeywords(input);

    expect(result.tech).toEqual(['developer', 'engineer']);
    expect(result.titles).toEqual(['developer', 'engineer']);
  });

  test('handles empty input strings gracefully', () => {
    const result = extractKeywords('');

    expect(result).toEqual({
      tech: [],
      titles: [],
      education: []
    });
  });

  test('handles input containing only blacklisted or short words', () => {
    const result = extractKeywords('the and for with to in on of my your our');

    expect(result).toEqual({
      tech: [],
      titles: [],
      education: []
    });
  });
});