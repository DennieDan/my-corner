"use client";

import Image from "next/image";

import type { TimelineProject } from "@/lib/timeline-data";
import { parseRichText } from "@/lib/parse-rich-text";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type TimelineProjectCardProps = {
  project: TimelineProject;
  className?: string;
};

function TimelineProjectCard({ project, className }: TimelineProjectCardProps) {
  return (
    <Card
      className={cn(
        "gap-0 overflow-hidden rounded-[10px] border-[#7a9e8e]/25 bg-white/80 py-0 shadow-none transition-shadow duration-200 ease-out hover:border-[#7a9e8e]/40 hover:shadow-[0_16px_40px_-10px_rgba(74,93,84,1)]",
        className,
      )}
    >
      <CardContent className="p-0">
        <div className="flex flex-col">
          {project.thumbnail && (
            <div className="border-b border-[#7a9e8e]/25 p-4 pb-3">
              <div className="relative aspect-video w-full overflow-hidden rounded-[8px] border border-[#7a9e8e]/35 bg-[#eef4f1]">
                <Image
                  src={project.thumbnail.src}
                  alt={project.thumbnail.alt}
                  fill
                  className="object-contain p-1"
                  sizes="(max-width: 768px) 100vw, 640px"
                />
              </div>
            </div>
          )}

          <div className="flex min-w-0 flex-1 flex-col gap-3 p-4">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="font-serif text-lg font-semibold text-[#4a5d54]">
                {project.title}
              </h4>
              {project.status === "ongoing" && (
                <Badge
                  variant="outline"
                  className="border-[#7a9e8e]/40 bg-[#7a9e8e]/10 text-xs text-[#527063]"
                >
                  ongoing
                </Badge>
              )}
            </div>

            <p className="text-sm leading-relaxed text-[#5a6b62]">
              {parseRichText(project.objectives)}
            </p>

            {project.userGuide && (
              <p className="border-l-2 border-[#7a9e8e]/40 pl-3 text-sm leading-relaxed text-[#5a6b62]/90">
                {parseRichText(project.userGuide)}
              </p>
            )}

            {project.suggestedQuestions &&
              project.suggestedQuestions.length > 0 && (
                <ul className="space-y-1 text-xs leading-relaxed text-[#5a6b62]/80">
                  {project.suggestedQuestions.map((question) => (
                    <li key={question} className="flex gap-2">
                      <span className="text-[#7a9e8e]">•</span>
                      <span>{question}</span>
                    </li>
                  ))}
                </ul>
              )}

            {project.techStacks.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {project.techStacks.map((stack) => (
                  <Badge
                    key={stack}
                    variant="outline"
                    className="border-[#7a9e8e]/40 bg-white/50 text-xs text-[#5a6b62]"
                  >
                    {stack}
                  </Badge>
                ))}
              </div>
            )}

            {project.links.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {project.links.map((link) => (
                  <Button
                    key={link.href}
                    variant="outline"
                    size="sm"
                    asChild
                    className="border-[#7a9e8e]/35 bg-[#d4e8de] text-[#4a5d54] hover:bg-[#c5ddd0] hover:text-[#4a5d54]"
                  >
                    <a
                      href={link.href}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {link.label}
                      <span className="sr-only"> (opens in new tab)</span>
                    </a>
                  </Button>
                ))}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export { TimelineProjectCard };
