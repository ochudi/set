import Link from "next/link";
import { Plus } from "lucide-react";

import { PageWrapper } from "@/components/page-wrapper";
import { Button } from "@/components/ui/button";
import { listAdminEvents } from "@/lib/dal";

import { EventsTable } from "./events-table";

export default async function AdminEventsPage() {
  const rows = await listAdminEvents();
  return (
    <PageWrapper
      title="Events"
      description="Create and manage events."
      actions={
        <Button asChild>
          <Link href="/admin/events/new">
            <Plus className="mr-2 size-4" /> New event
          </Link>
        </Button>
      }
    >
      <EventsTable rows={rows} />
    </PageWrapper>
  );
}
