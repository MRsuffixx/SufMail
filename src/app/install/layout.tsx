export default function InstallLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0, padding: 0, fontFamily: "system-ui, sans-serif", background: "#f8fafc" }}>
        {children}
      </body>
    </html>
  );
}