import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export interface Release {
  version: string;
  date?: string;
  tags?: string[];
  content: ReactNode;
}

const DEFAULT_TITLE = "Changelog Origin Update";
const DEFAULT_DESCRIPTION =
  "Discover what's been added, changed, fixed, improved, and updated in this release.";

interface ChangelogContentProps {
  releases: Release[];
  title?: string;
  description?: string;
  className?: string;
  showHeader?: boolean;
  headingId?: string;
  titleClassName?: string;
}

function ReleaseMeta({
  release,
  className,
  badgeClassName,
}: {
  release: Release;
  className?: string;
  badgeClassName?: string;
}) {
  return (
    <>
      {release.tags && release.tags.length > 0 ? (
        <div className={cn("flex flex-wrap gap-1.5", className)}>
          {release.tags.map((tag) => (
            <Badge
              key={tag}
              variant="outline"
              className={cn(
                "border-[#7a9e8e]/40 bg-white/50 text-xs text-[#5a6b62]",
                badgeClassName,
              )}
            >
              {tag}
            </Badge>
          ))}
        </div>
      ) : release.date ? (
        <div className={cn("text-sm font-medium text-[#5a6b62]", className)}>
          {release.date}
        </div>
      ) : null}
    </>
  );
}

const ChangelogContent = ({
  releases,
  title = DEFAULT_TITLE,
  description = DEFAULT_DESCRIPTION,
  className,
  showHeader = true,
  headingId,
  titleClassName,
}: ChangelogContentProps) => {
  return (
    <div className={cn("w-full", className)}>
      {showHeader && (
        <div className="mb-8 space-y-4 text-center md:mb-10 lg:mb-18">
          <h2
            id={headingId}
            className={cn(
              "font-serif text-2xl font-medium tracking-wide text-[#4a5d54] md:text-3xl lg:text-4xl",
              titleClassName,
            )}
          >
            {title}
          </h2>
          {description ? (
            <p className="text-base text-[#5a6b62] md:text-lg">{description}</p>
          ) : null}
        </div>
      )}
      {releases.map((release, index) => (
        <div
          key={`${release.version}-${index}`}
          id={String(index + 1)}
          className="relative flex scroll-mt-[4.5rem] justify-end gap-2"
        >
          {/* Sticky date — pins until the next row pushes it up (component-05 pattern) */}
          <div className="sticky top-[4.75rem] z-10 flex w-36 shrink-0 flex-col items-end gap-2 self-start pb-4 max-md:hidden">
            <Badge
              variant="outline"
              className="h-auto w-auto justify-end rounded-sm border-[#527063] bg-[#668a7a] px-2.5 py-1 text-sm font-medium text-[#f5fffe]"
            >
              {release.version}
            </Badge>
            <ReleaseMeta release={release} className="max-w-36 justify-end" />
          </div>

          <div className="flex w-6 shrink-0 flex-col items-center self-stretch">
            <div className="sticky top-[4.75rem] z-10 flex size-6 items-center justify-center max-sm:top-5">
              <span className="flex size-4.5 shrink-0 items-center justify-center rounded-full bg-[#7a9e8e]/25">
                <span className="size-3 rounded-full bg-[#7a9e8e]" />
              </span>
            </div>
            <span className="-mt-2.5 w-px min-h-0 flex-1 bg-[#7a9e8e]/45" />
          </div>

          <div className="flex min-w-0 flex-1 flex-col gap-4 pb-11 pl-3 md:pl-6 lg:pl-9">
            <div className="flex flex-col gap-2 md:hidden">
              <Badge
                variant="outline"
                className="w-fit rounded-sm border-[#527063] bg-[#668a7a] font-medium text-[#f5fffe]"
              >
                {release.version}
              </Badge>
              <ReleaseMeta release={release} />
            </div>
            {release.content}
          </div>
        </div>
      ))}
    </div>
  );
};

export { ChangelogContent };
export default ChangelogContent;
