export type Spacing = 'short' | 'medium' | 'wide';
export type FontSize = 'small' | 'medium' | 'large' | 'xlarge';
export type FontFamily = 'serif' | 'sans' | 'mono' | 'system';
export type InputDirection = 'top' | 'bottom';

export interface Paragraph {
  text: string;
  isSpecial: boolean;
  fontSize: FontSize;
  fontFamily: FontFamily;
  isBold: boolean;
  isItalic: boolean;
  file?: {
    name: string;
    type: string;
    url: string;
    isImage: boolean;
  };
}
