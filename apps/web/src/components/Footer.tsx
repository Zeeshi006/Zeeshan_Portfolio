const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line py-10">
      <div className="max-w-content mx-auto px-6">
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6">
          <p className="font-mono text-small text-text-mid">
            © {year} Hammad Afzal
          </p>

          {/* Quiet architecture note — per PRD v2.0: don't oversell it, just link it */}
          <p className="font-mono text-small text-text-lo text-right">
            Built with NestJS · Next.js · pgvector ·{" "}
            <a
              href={`${API_URL}/api/docs`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-mid hover:text-signal transition-colors underline underline-offset-2"
            >
              live Swagger
            </a>
            {" · "}
            <a
              href="https://github.com/HammadAfzalCode"
              target="_blank"
              rel="noopener noreferrer"
              className="text-text-mid hover:text-signal transition-colors underline underline-offset-2"
            >
              source
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
