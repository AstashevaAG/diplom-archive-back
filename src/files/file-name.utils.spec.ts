import {
  buildInlineContentDisposition,
  normalizeFileNameEncoding,
} from './file-name.utils';

describe('file name utils', () => {
  it('restores Cyrillic names read as latin1', () => {
    const original = 'ВКР Иванов.pdf';
    const mojibake = Buffer.from(original, 'utf8').toString('latin1');

    expect(normalizeFileNameEncoding(mojibake)).toBe(original);
  });

  it('keeps already valid Cyrillic names unchanged', () => {
    expect(normalizeFileNameEncoding('Презентация ВКР.pptx')).toBe(
      'Презентация ВКР.pptx',
    );
  });

  it('uses RFC 5987 encoding for response filenames', () => {
    expect(buildInlineContentDisposition('Отчет.pdf')).toContain(
      "filename*=UTF-8''%D0%9E%D1%82%D1%87%D0%B5%D1%82.pdf",
    );
  });
});
