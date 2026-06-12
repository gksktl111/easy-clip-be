declare module 'color-string' {
  type Model = 'rgb' | 'hsl' | 'hwb';

  type ColorString = {
    get: (color: string) => { model: Model; value: number[] } | null;
    to: {
      hex: (r: number, g: number, b: number, a?: number) => string | null;
    };
  };

  const colorString: ColorString;
  export default colorString;
}
