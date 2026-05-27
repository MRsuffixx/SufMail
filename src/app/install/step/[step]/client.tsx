"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import type { InstallPayload, InstallStep } from "~/types/install";
import SystemCheck from "./components/SystemCheck";
import DatabaseStep from "./components/DatabaseStep";
import AppSettingsStep from "./components/AppSettingsStep";
import MailServerStep from "./components/MailServerStep";
import AuthStep from "./components/AuthStep";
import AdminAccountStep from "./components/AdminAccountStep";
import ReviewStep from "./components/ReviewStep";

const STORAGE_KEY = "installState";

const steps: InstallStep[] = [1, 2, 3, 4, 5, 6, 7];

const stepLabels: Record<InstallStep, string> = {
  1: "System Check",
  2: "Database",
  3: "App Settings",
  4: "Mail Server",
  5: "Auth & Security",
  6: "Admin Account",
  7: "Review & Install",
};

function loadState(): Partial<InstallPayload> {
  if (typeof window === "undefined") return {};
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveState(data: Partial<InstallPayload>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {}
}

export default function InstallStepPage({
  params,
}: {
  params: { step: string };
}) {
  const router = useRouter();
  const initialStep = parseInt(params.step, 10) as InstallStep;

  const [currentStep, setCurrentStep] = useState<InstallStep>(initialStep);
  const [installData, setInstallData] = useState<Partial<InstallPayload>>(loadState);

  useEffect(() => {
    const step = parseInt(params.step, 10);
    if (!isNaN(step) && step >= 1 && step <= 7) {
      setCurrentStep(step as InstallStep);
    }
  }, [params.step]);

  useEffect(() => {
    saveState(installData);
  }, [installData]);

  const goTo = (step: InstallStep) => {
    setCurrentStep(step);
    router.push(`/install/step/${step}`);
  };

  const updateData = (updater: (prev: Partial<InstallPayload>) => Partial<InstallPayload>) => {
    setInstallData((prev) => updater(prev));
  };

  const handleNext = (stepData: Partial<InstallPayload>) => {
    const newData = { ...installData, ...stepData };
    setInstallData(newData);
    const nextStep = Math.min(currentStep + 1, 7) as InstallStep;
    goTo(nextStep);
  };

  const handleBack = () => {
    const prevStep = Math.max(currentStep - 1, 1) as InstallStep;
    goTo(prevStep);
  };

  const progress = ((currentStep - 1) / (steps.length - 1)) * 100;

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <SystemCheck onNext={() => handleNext({})} />;
      case 2:
        return (
          <DatabaseStep
            initialData={installData.database as { connectionString: string; useDocker: boolean } | undefined}
            onNext={(data) => updateData((prev) => ({ ...prev, database: data }))}
            onBack={handleBack}
          />
        );
      case 3:
        return (
          <AppSettingsStep
            initialData={installData.app as Parameters<typeof AppSettingsStep>[0]["initialData"]}
            onNext={(data) => updateData((prev) => ({ ...prev, app: data }))}
            onBack={handleBack}
          />
        );
      case 4:
        return (
          <MailServerStep
            initialData={installData.mail as Parameters<typeof MailServerStep>[0]["initialData"]}
            onNext={(data) => updateData((prev) => ({ ...prev, mail: data }))}
            onBack={handleBack}
          />
        );
      case 5:
        return (
          <AuthStep
            initialData={installData.auth as Parameters<typeof AuthStep>[0]["initialData"]}
            onNext={(data) => updateData((prev) => ({ ...prev, auth: data }))}
            onBack={handleBack}
          />
        );
      case 6:
        return (
          <AdminAccountStep
            initialData={installData.admin as Parameters<typeof AdminAccountStep>[0]["initialData"]}
            onNext={(data) => updateData((prev) => ({ ...prev, admin: data.admin, mailAccount: data.mailAccount }))}
            onBack={handleBack}
          />
        );
      case 7:
        return (
          <ReviewStep
            installData={installData}
            onNext={handleNext}
            onBack={handleBack}
            onEdit={(step) => goTo(step as InstallStep)}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <div style={{ height: 4, background: "#e2e8f0", width: "100%" }}>
        <div
          style={{
            height: "100%",
            background: "#4f46e5",
            transition: "width 0.3s ease",
            width: `${progress}%`,
          }}
        />
      </div>

      <div style={{ padding: "32px 20px" }}>
        <div style={{ maxWidth: 700, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: "50%",
                background: "#4f46e5",
                color: "white",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: 700,
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {currentStep}
            </div>
            <div>
              <div style={{ fontSize: 13, color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1 }}>
                Step {currentStep} of {steps.length}
              </div>
              <div style={{ fontWeight: 600, fontSize: 16 }}>{stepLabels[currentStep]}</div>
            </div>
          </div>

          <div style={{ background: "white", borderRadius: 12, border: "1px solid #e2e8f0", padding: 24 }}>
            {renderStep()}
          </div>
        </div>
      </div>
    </div>
  );
}