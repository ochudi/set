import { Mail } from "lucide-react";

import { PageWrapper } from "@/components/page-wrapper";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { listExco, type ExcoView } from "@/lib/dal";
import { initials } from "@/lib/member-display";

export default async function ExcoPage() {
  const people = await listExco();
  const exco = people.filter((p) => p.group !== "alumni_office");
  const office = people.filter((p) => p.group === "alumni_office");

  return (
    <PageWrapper
      title="Leadership"
      description="The people steering the PAU Alumni Association."
    >
      {people.length === 0 ? (
        <p className="rounded-lg border border-dashed p-10 text-center text-sm text-muted-foreground">
          The leadership list has not been published yet.
        </p>
      ) : (
        <div className="space-y-10">
          <Group title="Executive council" people={exco} />
          {office.length ? <Group title="Alumni office" people={office} /> : null}
        </div>
      )}
    </PageWrapper>
  );
}

function Group({ title, people }: { title: string; people: ExcoView[] }) {
  if (people.length === 0) return null;
  return (
    <section>
      <h2 className="mb-4 text-sm font-semibold text-muted-foreground">{title}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {people.map((p) => (
          <article
            key={p.id}
            className="flex flex-col rounded-lg border bg-card p-5 transition-colors hover:border-brand"
          >
            <div className="flex items-center gap-3">
              <Avatar className="size-12">
                {p.photoUrl ? <AvatarImage src={p.photoUrl} alt="" /> : null}
                <AvatarFallback>{initials(p.name)}</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <p className="truncate font-semibold">{p.name}</p>
                <p className="truncate text-sm text-brand-deep">{p.role}</p>
                {p.setLabel ? (
                  <p className="truncate font-mono text-[11px] text-muted-foreground">
                    {p.setLabel}
                  </p>
                ) : null}
              </div>
            </div>
            {p.bio ? (
              <p className="mt-3 text-sm text-muted-foreground">{p.bio}</p>
            ) : null}
            {p.email ? (
              <a
                href={`mailto:${p.email}`}
                className="mt-3 inline-flex items-center gap-1.5 text-sm text-brand-deep hover:underline"
              >
                <Mail className="size-3.5" /> Email
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}
