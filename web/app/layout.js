import './globals.css';

export const metadata = {
  title: 'Léo — Painel',
  description: 'Painel de saúde, documentos e lembretes do Léo',
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
