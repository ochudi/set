import { redirect } from "next/navigation";

// The self-service profile/account area lives at /me. Keep this path working for
// any old links or bookmarks.
export default function ProfileRedirect() {
  redirect("/me");
}
