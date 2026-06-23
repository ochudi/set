import Link from "next/link";
import { format } from "date-fns";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pin } from "lucide-react";

import { PageWrapper } from "@/components/page-wrapper";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { initials } from "@/lib/member-display";
import { listPublishedAnnouncements } from "@/lib/dal";

const MD =
  "text-sm leading-relaxed [&_a]:text-brand [&_a]:underline [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:list-disc [&_ul]:pl-5";

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page } = await searchParams;
  const { items, totalPages, page: current } = await listPublishedAnnouncements(
    Math.max(1, Number(page) || 1),
  );

  return (
    <PageWrapper title="Announcements" description="News from the community.">
      {items.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No announcements yet. Check back soon.
        </p>
      ) : (
        <div className="space-y-4">
          {items.map((a) => (
            <article key={a.id} className="rounded-lg border bg-card p-5">
              {a.pinned ? (
                <Badge variant="secondary" className="mb-2 gap-1">
                  <Pin className="size-3" /> Pinned
                </Badge>
              ) : null}
              <Link href={`/announcements/${a.id}`}>
                <h2 className="text-lg font-semibold hover:underline">
                  {a.title}
                </h2>
              </Link>
              <div className="mb-3 mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Avatar className="size-5">
                  {a.authorAvatarUrl ? (
                    <AvatarImage src={a.authorAvatarUrl} alt="" />
                  ) : null}
                  <AvatarFallback className="text-[9px]">
                    {initials(a.authorName)}
                  </AvatarFallback>
                </Avatar>
                <span>{a.authorName}</span>
                {a.publishedAt ? (
                  <>
                    <span aria-hidden>·</span>
                    <span>{format(a.publishedAt, "d MMM yyyy")}</span>
                  </>
                ) : null}
              </div>
              <div className={MD}>
                {/* rule 10: react-markdown WITHOUT rehype-raw */}
                <Markdown remarkPlugins={[remarkGfm]}>{a.body}</Markdown>
              </div>
            </article>
          ))}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="mt-6 flex items-center justify-between">
          {current > 1 ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/announcements?page=${current - 1}`}>Previous</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Previous
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            Page {current} of {totalPages}
          </span>
          {current < totalPages ? (
            <Button asChild variant="outline" size="sm">
              <Link href={`/announcements?page=${current + 1}`}>Next</Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
            </Button>
          )}
        </div>
      ) : null}
    </PageWrapper>
  );
}
