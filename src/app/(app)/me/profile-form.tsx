"use client";

import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

import { PAU_FACULTIES, isPauFaculty } from "@/lib/pau";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

import { AvatarField } from "./avatar-field";
import { saveMyProfile } from "./actions";

const selectClass =
  "h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm outline-none focus-visible:border-ring";

const schema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(80),
  lastName: z.string().trim().min(1, "Last name is required").max(80),
  preferredName: z.string().trim().max(80),
  avatarUrl: z.string().trim().max(1000),
  bio: z.string().trim().max(500),
  graduationYear: z.coerce
    .number({ message: "Enter a year" })
    .int()
    .min(1990, "Too early")
    .max(2100, "Too late"),
  faculty: z.string().refine(isPauFaculty, "Choose a faculty"),
  programme: z.string().trim().max(120),
  phone: z.string().trim().max(40),
  city: z.string().trim().max(120),
  country: z.string().trim().max(120),
  jobTitle: z.string().trim().max(160),
  company: z.string().trim().max(160),
  linkedinUrl: z.string().trim().max(300),
});

// z.coerce.number() makes the input type wider (unknown) than the output
// (number), so the form is parameterised with both: input for the fields and
// defaults, output for the validated submit handler.
type FormInput = z.input<typeof schema>;
type FormValues = z.output<typeof schema>;

export type ProfileDefaults = {
  firstName: string;
  lastName: string;
  preferredName: string;
  avatarUrl: string;
  bio: string;
  graduationYear: number | null;
  faculty: string;
  programme: string;
  phone: string;
  city: string;
  country: string;
  jobTitle: string;
  company: string;
  linkedinUrl: string;
};

export function ProfileForm({ defaults }: { defaults: ProfileDefaults }) {
  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormInput, unknown, FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      ...defaults,
      graduationYear: defaults.graduationYear ?? undefined,
    },
  });

  async function onSubmit(values: FormValues) {
    const res = await saveMyProfile(values);
    if (res.ok) toast.success("Profile saved");
    else toast.error(res.error ?? "Could not save your profile");
  }

  const avatarUrl = watch("avatarUrl");
  const firstName = watch("firstName");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-2xl space-y-6">
      <AvatarField
        value={avatarUrl ?? ""}
        fallbackName={firstName ?? ""}
        onChange={(url) =>
          setValue("avatarUrl", url, { shouldDirty: true, shouldValidate: true })
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="firstName" label="First name" error={errors.firstName?.message}>
          <Input id="firstName" {...register("firstName")} />
        </Field>
        <Field id="lastName" label="Last name" error={errors.lastName?.message}>
          <Input id="lastName" {...register("lastName")} />
        </Field>
        <Field
          id="preferredName"
          label="Preferred name"
          error={errors.preferredName?.message}
        >
          <Input id="preferredName" {...register("preferredName")} />
        </Field>
        <Field
          id="graduationYear"
          label="Graduating year"
          error={errors.graduationYear?.message}
        >
          <Input
            id="graduationYear"
            type="number"
            min={1990}
            max={2100}
            {...register("graduationYear")}
          />
        </Field>
        <Field id="faculty" label="Faculty" error={errors.faculty?.message}>
          <Controller
            control={control}
            name="faculty"
            render={({ field }) => (
              <select id="faculty" className={selectClass} {...field}>
                <option value="" disabled>
                  Select your school
                </option>
                {PAU_FACULTIES.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            )}
          />
        </Field>
        <Field id="programme" label="Programme" error={errors.programme?.message}>
          <Input
            id="programme"
            placeholder="e.g. MBA, BSc Accounting"
            {...register("programme")}
          />
        </Field>
        <Field
          id="phone"
          label="Phone"
          hint="Encrypted at rest. Choose who sees it under Privacy."
          error={errors.phone?.message}
        >
          <Input id="phone" placeholder="+234 800 000 0000" {...register("phone")} />
        </Field>
        <Field id="city" label="City" error={errors.city?.message}>
          <Input id="city" {...register("city")} />
        </Field>
        <Field id="country" label="Country" error={errors.country?.message}>
          <Input id="country" {...register("country")} />
        </Field>
        <Field id="jobTitle" label="Role" error={errors.jobTitle?.message}>
          <Input id="jobTitle" {...register("jobTitle")} />
        </Field>
        <Field id="company" label="Employer" error={errors.company?.message}>
          <Input id="company" {...register("company")} />
        </Field>
        <Field id="linkedinUrl" label="LinkedIn" error={errors.linkedinUrl?.message}>
          <Input
            id="linkedinUrl"
            placeholder="linkedin.com/in/you"
            {...register("linkedinUrl")}
          />
        </Field>
      </div>

      <Field id="bio" label="Bio" error={errors.bio?.message}>
        <Textarea id="bio" rows={4} {...register("bio")} />
      </Field>

      <Button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Saving..." : "Save changes"}
      </Button>
    </form>
  );
}

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
