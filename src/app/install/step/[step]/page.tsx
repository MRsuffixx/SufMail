"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function InstallStepPage() {
  const params = useParams();
  const router = useRouter();
  const step = params.step as string;

  useEffect(() => {
    const stepNum = parseInt(step, 10);
    if (isNaN(stepNum) || stepNum < 1 || stepNum > 7) {
      router.replace("/install/step/1");
    }
  }, [step, router]);

  return null;
}