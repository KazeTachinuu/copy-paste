import qrcode from 'qrcode-generator';

// Renders a scannable QR as inline SVG, generated entirely in the browser.
export function qrSvg(text) {
  const qr = qrcode(0, 'M');
  qr.addData(text);
  qr.make();
  return qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
}
