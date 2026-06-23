import Link from "next/link";
import { notFound } from "next/navigation";
import { format } from "date-fns";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Pin } from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { initials } from "@/lib/member-display";
import { getPublishedAnnouncement } from "@/lib/dal";

const MD =
  "text-sm leading-relaxed [&_a]:text-brand [&_a]:underline [&_h2]:mt-5 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5";

export default async function AnnouncementPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const a = await getPublishedAnnouncement(id);
  if (!a) notFound();

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 sm:px-6 lg:px-8">
      <Link
        href="/announcements"
        className="text-sm text-muted-foreground hover:text-foreground"
      >
        ← Announcements
      </Link>

      <article className="mt-4">
        {a.pinned ? (
          <Badge variant="secondary" className="mb-2 gap-1">
            <Pin className="size-3" /> Pinned
          </Badge>
        ) : null}
        <h1 className="text-2xl font-semibold tracking-tight">{a.title}</h1>
        <div className="mb-6 mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Avatar className="size-6">
            {a.authorAvatarUrl ? (
              <AvatarImage src={a.authorAvatarUrl} alt="" />
            ) : null}
            <AvatarFallback className="text-[10px]">
              {initials(a.authorName)}
            </AvatarFallback>
          </Avatar>
          <span>{a.authorName}</span>
          {a.publishedAt ? (
            <>
              <span aria-hidden>·</span>
              <span>{format(a.publishedAt, "d MMMM yyyy")}</span>
            </>
          ) : null}
        </div>

        <div className={MD}>
          {/* rule 10: react-markdown WITHOUT rehype-raw */}
          <Markdown remarkPlugins={[remarkGfm]}>{a.body}</Markdown>
        </div>
      </article>
    </div>
  );
}
