import Link from "next/link";
import siteMetadata from "@/lib/site-config";

export function SiteNavbar() {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-[#7a9e8e]/15 bg-white/55 backdrop-blur-md">
      <nav
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
        aria-label="Main navigation"
      >
        <Link
          href="/"
          className="font-serif text-lg font-medium tracking-wide text-[#4a5d54] transition-colors hover:text-[#7a9e8e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a9e8e]/45 focus-visible:ring-offset-2"
        >
          {siteMetadata.title}
        </Link>

        <a
          href={siteMetadata.resumeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-[#7a9e8e]/30 bg-white/70 px-5 py-2 font-sans text-sm font-medium tracking-wide text-[#4a5d54] shadow-sm transition-[color,background-color,border-color,box-shadow] hover:border-[#7a9e8e]/50 hover:bg-white hover:text-[#7a9e8e] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a9e8e]/45 focus-visible:ring-offset-2"
        >
          Resume
        </a>
      </nav>
    </header>
  );
}
