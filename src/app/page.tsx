import { FamilyCalendarApp } from "@/components/family-calendar-app";

export default function Home() {
  return <FamilyCalendarApp googleClientId={process.env.GOOGLE_CLIENT_ID ?? ""} />;
}
