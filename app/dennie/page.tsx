import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { dennieInfoCard } from "@/lib/dennie-info-card";
import siteMetadata from "@/lib/site-config";

export const metadata: Metadata = {
  title: `Dennie — Chatbot Info Card | ${siteMetadata.title}`,
  description:
    "Transparency information for Dennie, the generative AI chatbot on My Corner: capabilities, limitations, data practices, and how to report issues.",
};

function LeafDecoration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 180"
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M50 10 C50 10, 30 30, 35 55 C38 70, 45 75, 50 90"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        fill="none"
        opacity="0.6"
      />
      <ellipse
        cx="30"
        cy="25"
        rx="12"
        ry="20"
        fill="currentColor"
        opacity="0.5"
        transform="rotate(-30 30 25)"
      />
      <ellipse
        cx="25"
        cy="50"
        rx="10"
        ry="18"
        fill="currentColor"
        opacity="0.45"
        transform="rotate(-40 25 50)"
      />
      <ellipse
        cx="30"
        cy="75"
        rx="11"
        ry="19"
        fill="currentColor"
        opacity="0.4"
        transform="rotate(-35 30 75)"
      />
      <ellipse
        cx="70"
        cy="35"
        rx="12"
        ry="20"
        fill="currentColor"
        opacity="0.5"
        transform="rotate(30 70 35)"
      />
      <ellipse
        cx="75"
        cy="60"
        rx="10"
        ry="18"
        fill="currentColor"
        opacity="0.45"
        transform="rotate(40 75 60)"
      />
    </svg>
  );
}

function SectionHeading({
  id,
  children,
}: {
  id: string;
  children: ReactNode;
}) {
  return (
    <h2
      id={id}
      className="scroll-mt-28 font-serif text-2xl font-medium tracking-wide text-[#4a5d54] md:text-3xl"
    >
      {children}
    </h2>
  );
}

export default function DennieInfoCardPage() {
  const { sections, capabilities, reliability, data, reporting } =
    dennieInfoCard;

  return (
    <main className="relative min-h-screen">
      <div
        className="absolute inset-0"
        style={{
          background: `
            linear-gradient(
              180deg,
              #c5d5d3 0%,
              #d8e2e0 18%,
              #e8e5e2 40%,
              #f0e8e4 65%,
              #efd5cc 100%
            )
          `,
        }}
      />
      <div
        className="absolute inset-0 opacity-25"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E")`,
          mixBlendMode: "overlay",
        }}
      />
      <LeafDecoration className="pointer-events-none absolute top-16 left-0 w-20 text-[#7a9e8e] opacity-70 -translate-x-1 rotate-12 md:w-28" />
      <LeafDecoration className="pointer-events-none absolute bottom-8 right-0 w-20 text-[#7a9e8e] opacity-70 translate-x-1 rotate-180 md:w-28" />

      <div className="relative z-10 mx-auto max-w-3xl px-6 pb-24 pt-28 md:pt-32">
        <p className="mb-3 font-sans text-xs font-medium uppercase tracking-[0.2em] text-[#7a9e8e]">
          Chatbot info card
        </p>
        <h1 className="font-serif text-4xl font-medium tracking-wide text-[#4a5d54] md:text-5xl">
          {dennieInfoCard.chatbotName}
        </h1>
        <p className="mt-4 max-w-2xl font-sans text-base leading-relaxed text-[#5a6b62] md:text-lg">
          {dennieInfoCard.purpose}
        </p>

        <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-2 border-y border-[#7a9e8e]/20 py-4 font-sans text-sm text-[#5a6b62]">
          <div className="flex gap-2">
            <dt className="text-[#7a9e8e]">Deployer</dt>
            <dd className="font-medium text-[#4a5d54]">
              {dennieInfoCard.deployer}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-[#7a9e8e]">Version</dt>
            <dd className="font-medium text-[#4a5d54]">
              {dennieInfoCard.version}
            </dd>
          </div>
          <div className="flex gap-2">
            <dt className="text-[#7a9e8e]">Last updated</dt>
            <dd className="font-medium text-[#4a5d54]">
              <time dateTime={dennieInfoCard.lastUpdated}>
                {dennieInfoCard.lastUpdated}
              </time>
            </dd>
          </div>
        </dl>

        <nav
          aria-label="Info card sections"
          className="mt-10 rounded-sm border border-[#7a9e8e]/20 bg-white/40 px-5 py-5 backdrop-blur-sm"
        >
          <p className="mb-3 font-sans text-xs font-medium uppercase tracking-[0.15em] text-[#7a9e8e]">
            On this page
          </p>
          <ol className="space-y-2 font-sans text-sm text-[#4a5d54]">
            {sections.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex gap-2 transition-colors hover:text-[#7a9e8e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a9e8e]/45 focus-visible:ring-offset-2"
                >
                  <span className="tabular-nums text-[#7a9e8e]">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span>
                    <span className="font-medium">{section.title}</span>
                    <span className="mt-0.5 block text-[#5a6b62]/90">
                      {section.summary}
                    </span>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="mt-16 space-y-16">
          <section aria-labelledby="capabilities" className="space-y-6">
            <SectionHeading id="capabilities">
              {sections[0].title}
            </SectionHeading>
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <h3 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wider text-[#7a9e8e]">
                  Intended uses
                </h3>
                <ul className="space-y-2.5 font-sans text-base leading-relaxed text-[#5a6b62]">
                  {capabilities.intendedUses.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7a9e8e]"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-3 font-sans text-sm font-semibold uppercase tracking-wider text-[#7a9e8e]">
                  Limitations
                </h3>
                <ul className="space-y-2.5 font-sans text-base leading-relaxed text-[#5a6b62]">
                  {capabilities.limitations.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#c4a484]"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section aria-labelledby="reliability" className="space-y-6">
            <SectionHeading id="reliability">
              {sections[1].title}
            </SectionHeading>
            <ul className="space-y-3 font-sans text-base leading-relaxed text-[#5a6b62]">
              {reliability.statements.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
            <div className="border-l-2 border-[#7a9e8e]/40 pl-5">
              <h3 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wider text-[#7a9e8e]">
                What you should do
              </h3>
              <ul className="space-y-2 font-sans text-base leading-relaxed text-[#5a6b62]">
                {reliability.userPrecautions.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </section>

          <section aria-labelledby="data" className="space-y-6">
            <SectionHeading id="data">{sections[2].title}</SectionHeading>

            <div className="space-y-5">
              <div>
                <h3 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wider text-[#7a9e8e]">
                  What is collected
                </h3>
                <ul className="space-y-2 font-sans text-base leading-relaxed text-[#5a6b62]">
                  {data.collected.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7a9e8e]"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wider text-[#7a9e8e]">
                  Storage and processing
                </h3>
                <ul className="space-y-2 font-sans text-base leading-relaxed text-[#5a6b62]">
                  {data.storage.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7a9e8e]"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wider text-[#7a9e8e]">
                  Model training
                </h3>
                <p className="font-sans text-base leading-relaxed text-[#5a6b62]">
                  {data.training}
                </p>
              </div>

              <div>
                <h3 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wider text-[#7a9e8e]">
                  Your controls
                </h3>
                <ul className="space-y-2 font-sans text-base leading-relaxed text-[#5a6b62]">
                  {data.controls.map((item) => (
                    <li key={item} className="flex gap-2.5">
                      <span
                        className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7a9e8e]"
                        aria-hidden
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>

          <section aria-labelledby="reporting" className="space-y-6">
            <SectionHeading id="reporting">{sections[3].title}</SectionHeading>
            <p className="font-sans text-base leading-relaxed text-[#5a6b62]">
              Email{" "}
              <a
                href={`mailto:${reporting.email}`}
                className="font-medium text-[#4a5d54] underline decoration-[#7a9e8e]/40 underline-offset-4 transition-colors hover:text-[#7a9e8e] hover:decoration-[#7a9e8e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a9e8e]/45 focus-visible:ring-offset-2"
              >
                {reporting.email}
              </a>{" "}
              to raise concerns about Dennie.
            </p>
            <div>
              <h3 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wider text-[#7a9e8e]">
                You can report
              </h3>
              <ul className="space-y-2 font-sans text-base leading-relaxed text-[#5a6b62]">
                {reporting.issues.map((item) => (
                  <li key={item} className="flex gap-2.5">
                    <span
                      className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7a9e8e]"
                      aria-hidden
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <h3 className="mb-2 font-sans text-sm font-semibold uppercase tracking-wider text-[#7a9e8e]">
                What happens next
              </h3>
              <p className="font-sans text-base leading-relaxed text-[#5a6b62]">
                {reporting.process}
              </p>
            </div>
          </section>
        </div>

        <p className="mt-20 border-t border-[#7a9e8e]/20 pt-8 font-sans text-sm leading-relaxed text-[#5a6b62]">
          This page is provided as a transparency reference for Dennie, consistent
          with Singapore IMDA’s voluntary transparency guidelines for generative AI
          chatbots.{" "}
          <Link
            href="/"
            className="font-medium text-[#4a5d54] underline decoration-[#7a9e8e]/40 underline-offset-4 transition-colors hover:text-[#7a9e8e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7a9e8e]/45 focus-visible:ring-offset-2"
          >
            Return to My Corner
          </Link>
        </p>
      </div>
    </main>
  );
}
