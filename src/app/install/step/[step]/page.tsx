import InstallStepClient from "./client";

export default function InstallStepPage({
  params,
}: {
  params: { step: string };
}) {
  return <InstallStepClient params={params} />;
}