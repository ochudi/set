import { PageWrapper } from "@/components/page-wrapper";

import { EMPTY_EVENT, EventForm } from "../event-form";

export default function NewEventPage() {
  return (
    <PageWrapper title="New event" description="Save a draft, then publish when ready.">
      <EventForm mode="create" defaults={EMPTY_EVENT} />
    </PageWrapper>
  );
}
