import { PageWrapper } from "@/components/page-wrapper";
import { listActiveMembers } from "@/lib/dal";

import { DirectoryBrowser } from "./directory-browser";

// 200-member scale: fetch every browsable member once on the server, then filter
// and sort entirely on the client. No pagination needed at this size.
export default async function DirectoryPage() {
  const members = await listActiveMembers();
  return (
    <PageWrapper title="Directory" description="Browse the alumni community.">
      <DirectoryBrowser members={members} />
    </PageWrapper>
  );
}
