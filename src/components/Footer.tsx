import Image from "next/image";

export default function Footer() {
  return (
    <footer className="border-t border-hairline px-6 py-12">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div>
          <Image
            src="/assets/giggre_logo.png"
            alt="Giggre"
            width={120}
            height={57}
            className="h-7 w-auto"
          />
          <p className="mt-2 max-w-xs text-sm text-muted">
            Hyperlocal gigs, wherever you are. Same block, same day.
          </p>
        </div>

        <div>
          <p className="font-[var(--font-mono)] text-xs uppercase tracking-wide text-muted">
            Product
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><a href="#how-it-works" className="hover:text-ink">How it works</a></li>
            <li><a href="#local" className="hover:text-ink">Why hyperlocal</a></li>
            <li><a href="#download" className="hover:text-ink">Download</a></li>
          </ul>
        </div>

        <div>
          <p className="font-[var(--font-mono)] text-xs uppercase tracking-wide text-muted">
            Legal
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><a href="/privacy-policy" className="hover:text-ink">Privacy policy</a></li>
            <li><a href="/terms" className="hover:text-ink">Terms of service</a></li>
            <li><a href="/delete-account" className="hover:text-ink">Delete your account</a></li>
          </ul>
        </div>

        <div>
          <p className="font-[var(--font-mono)] text-xs uppercase tracking-wide text-muted">
            Company
          </p>
          <ul className="mt-3 space-y-2 text-sm text-muted">
            <li><a href="mailto:hello@airstaffs.com" className="hover:text-ink">Contact</a></li>
          </ul>
        </div>
      </div>
      <p className="mx-auto mt-10 max-w-6xl font-[var(--font-mono)] text-xs text-muted">
        © {new Date().getFullYear()} Giggre. Made by locals, for locals.
      </p>
    </footer>
  );
}
