import { PageWrapper } from "@/components/page-wrapper";
import { listEvents } from "@/lib/dal";

import { EventsBrowser } from "./events-browser";

export default async function EventsPage() {
  const [upcoming, past] = await Promise.all([
    listEvents("upcoming"),
    listEvents("past"),
  ]);

  return (
    <PageWrapper title="Events" description="Reunions, meetups, and more.">
      <EventsBrowser upcoming={upcoming} past={past} />
    </PageWrapper>
  );
}
