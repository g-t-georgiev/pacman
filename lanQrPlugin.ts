import { type PreviewServer, type ViteDevServer } from 'vite';
import { networkInterfaces } from 'os';
import QRCode from 'qrcode';

export function lanQrPluginInit() {
  const printQr = (server: ViteDevServer | PreviewServer) => {
    server.httpServer?.once('listening', () => {
      const address = server.httpServer?.address();

      if (!address || typeof address === 'string') {
        console.warn('Could not determine the server port for the LAN QR code.');
        return;
      }

      const ips = Object.values(networkInterfaces())
        .flatMap((interfaces) => interfaces ?? [])
        .filter((entry) => !entry.internal && (entry.family === 'IPv4'))
        .map((entry) => entry.address);

      if (ips.length === 0) {
        console.warn('No LAN IPv4 addresses found for the QR code.');
        return;
      }

      for (const ip of ips) {
        const url = `http://${ip}:${address.port}/`;
        console.log(`\nScan to open ${url}`);

        QRCode.toString(url, { type: 'terminal', small: true }, (error, output) => {
          if (error) {
            console.error(`Could not generate QR code for ${url}:`, error);
            return;
          }
          console.log(output);
        });
      }
    });
  };

  return {
    name: 'lan-qr-code',
    configureServer: printQr,
    configurePreviewServer: printQr,
  };
}