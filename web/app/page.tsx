import type { Metadata } from 'next';
import raw from '@/data/weekend-calls.json';
import MondayScreen from '@/components/monday/MondayScreen';
import { withAdminSummaries } from '@/lib/monday';

export const metadata: Metadata = {
  title: 'Monday Morning — Harbourside Dental',
  description: 'Ninety seconds on Monday: the few things from the weekend that need a person, in order.',
};

export default function Page() {
  // Raw call summaries (free text, may hold clinical detail) never leave the server: only admin_summary is passed on.
  const data = withAdminSummaries(raw as unknown as Parameters<typeof withAdminSummaries>[0]);
  return <MondayScreen raw={data} />;
}
