import { detectClipType } from './clip-type-detector';

describe('clip-type-detector', () => {
  it('#fff는 COLOR로 판별되고 HEX로 정규화된다', () => {
    expect(detectClipType('#fff')).toEqual({
      type: 'COLOR',
      hex: '#FFFFFF',
    });
  });

  it('rgb(0,0,0)은 COLOR로 판별된다', () => {
    expect(detectClipType('rgb(0,0,0)')).toEqual({
      type: 'COLOR',
      hex: '#000000',
    });
  });

  it('그 외 입력은 TEXT로 판별되고 trim 된다', () => {
    expect(detectClipType('  hello world  ')).toEqual({
      type: 'TEXT',
      text: 'hello world',
    });
  });
});
