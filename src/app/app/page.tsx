"use client";

import { AppLayout } from "~/components/AppLayout";
import { api } from "~/trpc/react";

export default function AppPage() {
  const { data: labels } = api.labels.listLabels.useQuery();

  return <AppLayout labels={labels ?? []} />;
}