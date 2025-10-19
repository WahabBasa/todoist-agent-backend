"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { OnboardingLayout } from "@/components/onboarding/OnboardingLayout";
import { Step1Personal } from "@/components/onboarding/Step1Personal";
import { Step2Professional } from "@/components/onboarding/Step2Professional";
import { Step3Preferences } from "@/components/onboarding/Step3Preferences";
import { toast } from "sonner";

export function Onboarding() {
  const [currentStep, setCurrentStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form data
  const [fullName, setFullName] = useState("");
  const [preferredName, setPreferredName] = useState("");
  const [occupation, setOccupation] = useState("");
  const [workingHoursStart, setWorkingHoursStart] = useState("");
  const [workingHoursEnd, setWorkingHoursEnd] = useState("");
  const [timezone, setTimezone] = useState("");

  // Errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Convex mutations
  const createUserProfile = useMutation(api.userProfiles.createUserProfile);
  const completeOnboarding = useAction(api.onboarding.completeOnboarding);

  const totalSteps = 3;

  const validateStep1 = () => {
    const newErrors: Record<string, string> = {};
    
    if (fullName.trim().length < 2) {
      newErrors.fullName = "Full name must be at least 2 characters";
    } else if (fullName.trim().length > 100) {
      newErrors.fullName = "Full name must be less than 100 characters";
    }

    if (preferredName.trim().length < 2) {
      newErrors.preferredName = "Preferred name must be at least 2 characters";
    } else if (preferredName.trim().length > 50) {
      newErrors.preferredName = "Preferred name must be less than 50 characters";
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleStep1Next = () => {
    if (validateStep1()) {
      setCurrentStep(2);
    }
  };

  const handleStep2Next = () => {
    setCurrentStep(3);
  };

  const handleStep3Complete = async () => {
    setIsSubmitting(true);
    setErrors({});

    try {
      // Build profile data
      const profileData: any = {
        fullName: fullName.trim(),
        preferredName: preferredName.trim(),
      };

      // Add optional fields if provided
      if (occupation.trim()) {
        profileData.occupation = occupation.trim();
      }

      // Add working hours if all fields are provided
      if (workingHoursStart && workingHoursEnd && timezone) {
        profileData.preferredWorkingHours = {
          start: workingHoursStart,
          end: workingHoursEnd,
          timezone: timezone,
        };
      }

      // Save profile to Convex
      await createUserProfile(profileData);

      // Update Clerk metadata
      await completeOnboarding();

      // Show success message
      toast.success("Profile created successfully!");

      // Prompt user to connect Google Calendar immediately (full consent)
      try {
        const clerkUser: any = (window as any).Clerk?.user;
        const redirectUrl = `${window.location.origin}/sso-callback`;
        const GCAL_SCOPES = [
          'https://www.googleapis.com/auth/calendar.events',
          'https://www.googleapis.com/auth/calendar.readonly',
          'https://www.googleapis.com/auth/calendar.settings.readonly'
        ];
        const extAcc: any = clerkUser?.externalAccounts?.find?.((a: any) => a?.provider === 'google' || a?.provider === 'oauth_google');
        if (extAcc?.reauthorize) {
          const updated = await extAcc.reauthorize({
            additionalScopes: GCAL_SCOPES,
            oidcPrompt: 'consent select_account',
            redirectUrl,
          });
          const url = updated?.verification?.externalVerificationRedirectURL;
          if (url) { window.location.href = url; return; }
        } else if (clerkUser?.createExternalAccount) {
          const ea = await clerkUser.createExternalAccount({
            strategy: 'oauth_google',
            redirectUrl,
            additionalScopes: GCAL_SCOPES,
            oidcPrompt: 'consent select_account',
          });
          const url = ea?.verification?.externalVerificationRedirectURL;
          if (url) { window.location.href = url; return; }
        }
      } catch {}

      // Fallback: Redirect to chat
      setTimeout(() => { window.location.href = "/"; }, 1000);
    } catch (error: any) {
      console.error("Onboarding error:", error);
      toast.error(error?.message || "Failed to complete onboarding. Please try again.");
      setIsSubmitting(false);
    }
  };

  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  return (
    <OnboardingLayout currentStep={currentStep} totalSteps={totalSteps}>
      {currentStep === 1 && (
        <Step1Personal
          fullName={fullName}
          preferredName={preferredName}
          onFullNameChange={setFullName}
          onPreferredNameChange={setPreferredName}
          onNext={handleStep1Next}
          errors={errors}
        />
      )}

      {currentStep === 2 && (
        <Step2Professional
          occupation={occupation}
          onOccupationChange={setOccupation}
          onNext={handleStep2Next}
          onBack={handleBack}
          errors={errors}
        />
      )}

      {currentStep === 3 && (
        <Step3Preferences
          workingHoursStart={workingHoursStart}
          workingHoursEnd={workingHoursEnd}
          timezone={timezone}
          onWorkingHoursStartChange={setWorkingHoursStart}
          onWorkingHoursEndChange={setWorkingHoursEnd}
          onTimezoneChange={setTimezone}
          onComplete={handleStep3Complete}
          onBack={handleBack}
          isSubmitting={isSubmitting}
        />
      )}
    </OnboardingLayout>
  );
}
