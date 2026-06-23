import { redirect } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getCurrentMember, requireSession } from "@/lib/dal";
import { PAU_FACULTIES } from "@/lib/pau";

import {
  saveStep1,
  saveStep2,
  saveStep3,
  saveStep4,
  saveStep5,
} from "./actions";
import { AvatarUploader } from "./avatar-uploader";
import { SubmitButton } from "./submit-button";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

export default async function WelcomePage({
  searchParams,
}: {
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  await requireSession();
  const member = await getCurrentMember();
  if (member?.onboardedAt) redirect("/dashboard");

  const sp = await searchParams;
  const step = Math.min(5, Math.max(1, Number(sp.step) || 1));
  const showError = sp.error === "1";

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center p-6">
      <div className="mb-6">
        <h1 className="font-sans text-2xl font-semibold italic tracking-tight">
          Set.
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">Step {step} of 5</p>
      </div>

      {showError ? (
        <p className="mb-4 rounded-md border border-destructive/30 bg-destructive/10 p-2 text-sm text-destructive">
          Please check the fields and try again.
        </p>
      ) : null}

      {step === 1 ? (
        <form action={saveStep1} className="space-y-4">
          <AvatarUploader defaultUrl={member?.avatarUrl} />
          <div className="space-y-2">
            <Label htmlFor="firstName">First name</Label>
            <Input
              id="firstName"
              name="firstName"
              required
              defaultValue={member?.firstName ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lastName">Last name</Label>
            <Input
              id="lastName"
              name="lastName"
              required
              defaultValue={member?.lastName ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferredName">Preferred name (optional)</Label>
            <Input
              id="preferredName"
              name="preferredName"
              defaultValue={member?.preferredName ?? ""}
            />
          </div>
          <SubmitButton>Continue</SubmitButton>
        </form>
      ) : null}

      {step === 2 ? (
        <form action={saveStep2} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="graduationYear">Graduating year</Label>
            <Input
              id="graduationYear"
              name="graduationYear"
              type="number"
              min={1990}
              max={2100}
              required
              defaultValue={member?.graduationYear ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="faculty">Faculty</Label>
            <select
              id="faculty"
              name="faculty"
              required
              defaultValue={member?.faculty ?? ""}
              className={selectClass}
            >
              <option value="" disabled>
                Select your school
              </option>
              {PAU_FACULTIES.map((faculty) => (
                <option key={faculty} value={faculty}>
                  {faculty}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="programme">Programme (optional)</Label>
            <Input
              id="programme"
              name="programme"
              defaultValue={member?.programme ?? ""}
              placeholder="e.g. MBA, BSc Accounting"
            />
          </div>
          <SubmitButton>Continue</SubmitButton>
        </form>
      ) : null}

      {step === 3 ? (
        <form action={saveStep3} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="city">City</Label>
            <Input id="city" name="city" defaultValue={member?.city ?? ""} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              name="country"
              defaultValue={member?.country ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="jobTitle">Role</Label>
            <Input
              id="jobTitle"
              name="jobTitle"
              defaultValue={member?.jobTitle ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Employer</Label>
            <Input
              id="company"
              name="company"
              defaultValue={member?.company ?? ""}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="linkedinUrl">LinkedIn</Label>
            <Input
              id="linkedinUrl"
              name="linkedinUrl"
              defaultValue={member?.linkedinUrl ?? ""}
              placeholder="linkedin.com/in/you"
            />
          </div>
          <SubmitButton>Continue</SubmitButton>
        </form>
      ) : null}

      {step === 4 ? (
        <form action={saveStep4} className="space-y-4">
          {(
            [
              ["profileVisibility", "Profile"],
              ["emailVisibility", "Email"],
              ["phoneVisibility", "Phone"],
            ] as const
          ).map(([name, label]) => (
            <div key={name} className="space-y-2">
              <Label htmlFor={name}>{label} visibility</Label>
              <select
                id={name}
                name={name}
                defaultValue={
                  member?.[name] ??
                  (name === "phoneVisibility" ? "private" : "members")
                }
                className={selectClass}
              >
                <option value="public">Public</option>
                <option value="members">Members</option>
                <option value="private">Private</option>
              </select>
            </div>
          ))}
          <fieldset className="space-y-2">
            <legend className="mb-1 text-sm font-medium">Email me about</legend>
            {(
              [
                ["notifyAnnouncements", "Announcements"],
                ["notifyEvents", "Events"],
                ["notifyFundraisers", "Fundraisers"],
              ] as const
            ).map(([name, label]) => (
              <label key={name} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name={name}
                  defaultChecked={member?.[name] ?? true}
                  className="size-4"
                  style={{ accentColor: "var(--brand)" }}
                />
                {label}
              </label>
            ))}
          </fieldset>
          <SubmitButton>Continue</SubmitButton>
        </form>
      ) : null}

      {step === 5 ? (
        <form action={saveStep5} className="space-y-4">
          <p className="text-sm text-muted-foreground">
            One last thing before you are in.
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="consent"
              required
              className="mt-0.5 size-4"
              style={{ accentColor: "var(--brand)" }}
            />
            <span>
              I agree to the{" "}
              <a href="/privacy" className="underline">
                privacy policy
              </a>{" "}
              and{" "}
              <a href="/terms" className="underline">
                terms
              </a>
              .
            </span>
          </label>
          <SubmitButton>Finish</SubmitButton>
        </form>
      ) : null}
    </main>
  );
}
