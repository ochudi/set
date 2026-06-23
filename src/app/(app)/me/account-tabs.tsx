"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { DataTab } from "./data-tab";
import { NotificationsForm } from "./notifications-form";
import { PrivacyForm } from "./privacy-form";
import { ProfileForm, type ProfileDefaults } from "./profile-form";
import { SessionsList, type ClientSession } from "./sessions-list";

type Visibility = "public" | "members" | "private";

export function AccountTabs({
  profile,
  privacy,
  notifications,
  sessions,
  graceDays,
}: {
  profile: ProfileDefaults;
  privacy: {
    profileVisibility: Visibility;
    emailVisibility: Visibility;
    phoneVisibility: Visibility;
  };
  notifications: {
    notifyAnnouncements: boolean;
    notifyEvents: boolean;
    notifyFundraisers: boolean;
  };
  sessions: ClientSession[];
  graceDays: number;
}) {
  return (
    <Tabs defaultValue="profile" className="w-full">
      <TabsList className="mb-6 flex h-auto w-full flex-wrap justify-start gap-1">
        <TabsTrigger value="profile">Profile</TabsTrigger>
        <TabsTrigger value="privacy">Privacy</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="sessions">Sessions</TabsTrigger>
        <TabsTrigger value="data">Data</TabsTrigger>
      </TabsList>

      <TabsContent value="profile">
        <ProfileForm defaults={profile} />
      </TabsContent>
      <TabsContent value="privacy">
        <PrivacyForm defaults={privacy} />
      </TabsContent>
      <TabsContent value="notifications">
        <NotificationsForm defaults={notifications} />
      </TabsContent>
      <TabsContent value="sessions">
        <SessionsList sessions={sessions} />
      </TabsContent>
      <TabsContent value="data">
        <DataTab graceDays={graceDays} />
      </TabsContent>
    </Tabs>
  );
}
