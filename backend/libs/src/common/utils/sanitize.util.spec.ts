import { sanitizeStoryContent } from './sanitize.util';

describe('sanitizeStoryContent', () => {
  it('buang <script> & isinya', () => {
    expect(sanitizeStoryContent('<script>alert(1)</script>')).toBe('');
  });

  it('buang <iframe>, <object>, <embed>, <form>', () => {
    expect(sanitizeStoryContent('<iframe src="https://evil.test"></iframe>')).toBe('');
    expect(sanitizeStoryContent('<object data="x"></object>')).toBe('');
    expect(sanitizeStoryContent('<embed src="x">')).toBe('');
    expect(sanitizeStoryContent('<form><input name="x"></form>')).toBe('');
  });

  it('buang handler on* & style', () => {
    expect(sanitizeStoryContent('<p onerror="alert(1)">hi</p>')).toBe('<p>hi</p>');
    expect(sanitizeStoryContent('<p onclick="alert(1)">hi</p>')).toBe('<p>hi</p>');
    expect(sanitizeStoryContent('<p style="color:red">hi</p>')).toBe('<p>hi</p>');
  });

  it('buang href/src skema javascript:', () => {
    expect(sanitizeStoryContent('<a href="javascript:alert(1)">x</a>')).toBe(
      '<a rel="noopener noreferrer">x</a>',
    );
    expect(sanitizeStoryContent('<img src="javascript:alert(1)">')).toBe('<img />');
  });

  it('pertahankan <p>, <strong>, <a href="https://...">', () => {
    expect(
      sanitizeStoryContent(
        '<p>keep</p><strong>b</strong><a href="https://a.com">l</a>',
      ),
    ).toBe('<p>keep</p><strong>b</strong><a href="https://a.com" rel="noopener noreferrer">l</a>');
  });

  it('paksa rel="noopener noreferrer" walau target ada', () => {
    expect(sanitizeStoryContent('<a href="https://a.com" target="_blank">l</a>')).toBe(
      '<a href="https://a.com" target="_blank" rel="noopener noreferrer">l</a>',
    );
  });
});
