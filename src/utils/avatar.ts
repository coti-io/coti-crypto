import { sha256 } from 'js-sha256';

export default class TokenAvatar {
  symbol: string;
  elements: number;
  size: number;
  hash: string;
  colors: any[];

  constructor(symbol: string, elements = 60, size = 60) {
    this.symbol = symbol;
    this.elements = elements;
    this.size = size;
    this.hash = sha256(symbol).toString();
    this.colors = this.generateAvatarPalette();
  }

  public generateAvatarPalette(): string[] {
    const colors = this.hash
      .replace(/(\w|\d)/g, (current: string, next: string, index: number) => `${current}${index !== 0 && index % 20 === 0 ? '-' : ''}`)
      .split('-');
    return this.generateColors(
      this.symbol,
      colors.map((colorHash: string) => this.getIconColor(colorHash))
    );
  }

  public getRandomColor(number: number, colors: string[], range: number): string {
    return colors[number % range];
  }

  public hslToHex(h: number, s: number, l: number): string {
    l /= 100;
    const a = (s * Math.min(l, 1 - l)) / 100;
    const f = (n: number): string => {
      const k = (n + h / 30) % 12;
      const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
      return Math.round(255 * color)
        .toString(16)
        .padStart(2, '0'); // convert to Hex and prefix "0" if needed
    };
    return `#${f(0)}${f(8)}${f(4)}`;
  }

  public hashCode(name: string): number {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      const character = name.charCodeAt(i);
      hash = (hash << 5) - hash + character;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
  }

  generateColors = (name: string, colors: string[]): string[] => {
    const numFromName = this.hashCode(name);
    const range = colors && colors.length;
    return Array.from({ length: this.elements }, (_, i) => this.getRandomColor(numFromName % i, colors, range));
  };

  toSvg(): string {
    return `<svg
            viewBox="0 0 ${this.size} ${this.size}"
            fill="none"
            role="img"
            xmlns="http://www.w3.org/2000/svg"
            width="${this.size}"
            height="${this.size}"
        >
            <title>${this.symbol}</title>
            <mask
                id="mask__pixel"
                mask-type="alpha"
                maskUnits="userSpaceOnUse"
                x="0"
                y="0"
                width="${this.size}"
                height="${this.size}"
            >
                <rect width="${this.size}" height="${this.size}" rx="${this.size * 2}" fill="#FFFFFF" />
            </mask>
            <g mask="url(#mask__pixel)">
                <rect width="10" height="10" fill="${0}" />
                <rect x="20" width="10" height="10" fill="${this.colors[1]}" />
                <rect x="40" width="10" height="10" fill="${this.colors[2]}" />
                <rect x="60" width="10" height="10" fill="${this.colors[3]}" />
                <rect x="10" width="10" height="10" fill="${this.colors[4]}" />
                <rect x="30" width="10" height="10" fill="${this.colors[5]}" />
                <rect x="50" width="10" height="10" fill="${this.colors[6]}" />
                <rect x="70" width="10" height="10" fill="${this.colors[7]}" />
                <rect y="10" width="10" height="10" fill="${this.colors[8]}" />
                <rect y="20" width="10" height="10" fill="${this.colors[9]}" />
                <rect y="30" width="10" height="10" fill="${this.colors[10]}" />
                <rect y="40" width="10" height="10" fill="${this.colors[11]}" />
                <rect y="50" width="10" height="10" fill="${this.colors[12]}" />
                <rect y="60" width="10" height="10" fill="${this.colors[13]}" />
                <rect y="70" width="10" height="10" fill="${this.colors[14]}" />
                <rect x="20" y="10" width="10" height="10" fill="${this.colors[15]}" />
                <rect x="20" y="20" width="10" height="10" fill="${this.colors[16]}" />
                <rect x="20" y="30" width="10" height="10" fill="${this.colors[17]}" />
                <rect x="20" y="40" width="10" height="10" fill="${this.colors[18]}" />
                <rect x="20" y="50" width="10" height="10" fill="${this.colors[19]}" />
                <rect x="20" y="60" width="10" height="10" fill="${this.colors[20]}" />
                <rect x="20" y="70" width="10" height="10" fill="${this.colors[21]}" />
                <rect x="40" y="10" width="10" height="10" fill="${this.colors[22]}" />
                <rect x="40" y="20" width="10" height="10" fill="${this.colors[23]}" />
                <rect x="40" y="30" width="10" height="10" fill="${this.colors[24]}" />
                <rect x="40" y="40" width="10" height="10" fill="${this.colors[25]}" />
                <rect x="40" y="50" width="10" height="10" fill="${this.colors[26]}" />
                <rect x="40" y="60" width="10" height="10" fill="${this.colors[27]}" />
                <rect x="40" y="70" width="10" height="10" fill="${this.colors[28]}" />
                <rect x="60" y="10" width="10" height="10" fill="${this.colors[29]}" />
                <rect x="60" y="20" width="10" height="10" fill="${this.colors[30]}" />
                <rect x="60" y="30" width="10" height="10" fill="${this.colors[31]}" />
                <rect x="60" y="40" width="10" height="10" fill="${this.colors[32]}" />
                <rect x="60" y="50" width="10" height="10" fill="${this.colors[33]}" />
                <rect x="60" y="60" width="10" height="10" fill="${this.colors[34]}" />
                <rect x="60" y="70" width="10" height="10" fill="${this.colors[35]}" />
                <rect x="10" y="10" width="10" height="10" fill="${this.colors[36]}" />
                <rect x="10" y="20" width="10" height="10" fill="${this.colors[37]}" />
                <rect x="10" y="30" width="10" height="10" fill="${this.colors[38]}" />
                <rect x="10" y="40" width="10" height="10" fill="${this.colors[39]}" />
                <rect x="10" y="50" width="10" height="10" fill="${this.colors[40]}" />
                <rect x="10" y="60" width="10" height="10" fill="${this.colors[41]}" />
                <rect x="10" y="70" width="10" height="10" fill="${this.colors[42]}" />
                <rect x="30" y="10" width="10" height="10" fill="${this.colors[43]}" />
                <rect x="30" y="20" width="10" height="10" fill="${this.colors[44]}" />
                <rect x="30" y="30" width="10" height="10" fill="${this.colors[45]}" />
                <rect x="30" y="40" width="10" height="10" fill="${this.colors[46]}" />
                <rect x="30" y="50" width="10" height="10" fill="${this.colors[47]}" />
                <rect x="30" y="60" width="10" height="10" fill="${this.colors[48]}" />
                <rect x="30" y="70" width="10" height="10" fill="${this.colors[49]}" />
                <rect x="50" y="10" width="10" height="10" fill="${this.colors[50]}" />
                <rect x="50" y="20" width="10" height="10" fill="${this.colors[51]}" />
                <rect x="50" y="30" width="10" height="10" fill="${this.colors[52]}" />
                <rect x="50" y="40" width="10" height="10" fill="${this.colors[53]}" />
                <rect x="50" y="50" width="10" height="10" fill="${this.colors[54]}" />
                <rect x="50" y="60" width="10" height="10" fill="${this.colors[55]}" />
                <rect x="50" y="70" width="10" height="10" fill="${this.colors[56]}" />
                <rect x="70" y="10" width="10" height="10" fill="${this.colors[57]}" />
                <rect x="70" y="20" width="10" height="10" fill="${this.colors[58]}" />
                <rect x="70" y="30" width="10" height="10" fill="${this.colors[59]}" />
                <rect x="70" y="40" width="10" height="10" fill="${this.colors[60]}" />
                <rect x="70" y="50" width="10" height="10" fill="${this.colors[61]}" />
                <rect x="70" y="60" width="10" height="10" fill="${this.colors[62]}" />
                <rect x="70" y="70" width="10" height="10" fill="${this.colors[63]}" />
            </g>
        </svg>`;
  }

  toBuffer(): string {
    const buffer = Buffer.from(this.toSvg(), 'utf8').toString('base64');
    return `data:image/svg+xml;base64,${buffer}`;
  }

  private getIconColor(symbol: string): string {
    return this.hslToHex(Number(this.hashCode(symbol)), 95, 40);
  }
}
