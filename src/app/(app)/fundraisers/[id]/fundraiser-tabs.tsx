"use client";

import { format } from "date-fns";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { FundraiserDetail } from "@/lib/dal";
import { formatNaira } from "@/lib/money";

const MD =
  "text-sm leading-relaxed [&_a]:text-brand [&_a]:underline [&_h2]:mt-4 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_li]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_p]:my-3 [&_ul]:list-disc [&_ul]:pl-5";

export function FundraiserTabs({ detail }: { detail: FundraiserDetail }) {
  return (
    <Tabs defaultValue="story" className="mt-6">
      <TabsList>
        <TabsTrigger value="story">Story</TabsTrigger>
        <TabsTrigger value="pledgers">
          Pledgers ({detail.pledgerCount})
        </TabsTrigger>
        <TabsTrigger value="updates">Updates ({detail.updates.length})</TabsTrigger>
      </TabsList>

      <TabsContent value="story" className="pt-4">
        <div className={MD}>
          {/* rule 10: react-markdown WITHOUT rehype-raw */}
          <Markdown remarkPlugins={[remarkGfm]}>
            {detail.description ?? "No story yet."}
          </Markdown>
        </div>
      </TabsContent>

      <TabsContent value="pledgers" className="pt-4">
        {detail.pledgers.length === 0 ? (
          <p className="text-sm text-muted-foreground">No pledges yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border">
            {detail.pledgers.map((p, i) => (
              <li
                key={i}
                className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
              >
                <span className="truncate">{p.name}</span>
                <span className="flex items-center gap-2">
                  {p.status === "paid" ? (
                    <Badge variant="secondary">received</Badge>
                  ) : null}
                  {p.amount != null ? (
                    <span className="tabular-nums">{formatNaira(p.amount)}</span>
                  ) : null}
                </span>
              </li>
            ))}
          </ul>
        )}
      </TabsContent>

      <TabsContent value="updates" className="pt-4">
        {detail.updates.length === 0 ? (
          <p className="text-sm text-muted-foreground">No updates yet.</p>
        ) : (
          <div className="space-y-5">
            {detail.updates.map((u) => (
              <article key={u.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2">
                  {u.title ? (
                    <h3 className="text-sm font-semibold">{u.title}</h3>
                  ) : (
                    <span />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(u.createdAt, "d MMM yyyy")}
                  </span>
                </div>
                <div className={MD}>
                  <Markdown remarkPlugins={[remarkGfm]}>{u.body}</Markdown>
                </div>
              </article>
            ))}
          </div>
        )}
      </TabsContent>
    </Tabs>
  );
}
