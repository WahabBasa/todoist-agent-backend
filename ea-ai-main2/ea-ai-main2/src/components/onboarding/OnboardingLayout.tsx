import React from "react";
import { LogoIcon } from "@/components/logo";

interface OnboardingLayoutProps {
  children: React.ReactNode;
  currentStep: number;
  totalSteps: number;
}

export function OnboardingLayout({ children, currentStep, totalSteps }: OnboardingLayoutProps) {
  return (
    <div 
      className="min-h-screen flex flex-col items-center justify-center px-4"
      style={{ backgroundColor: "var(--dark-charcoal)" }}
    >
      {/* Logo */}
      <div className="mb-8">
        <LogoIcon />
      </div>

      {/* Progress indicator */}
      <div className="w-full max-w-md mb-8">
        <div className="flex items-center justify-between mb-2">
          <span 
            className="text-sm font-medium"
            style={{ color: "var(--soft-off-white)" }}
          >
            Step {currentStep} of {totalSteps}
          </span>
          <span 
            className="text-sm"
            style={{ color: "var(--neutral-stone)" }}
          >
            {Math.round((currentStep / totalSteps) * 100)}% complete
          </span>
        </div>
        
        {/* Progress bar */}
        <div 
          className="w-full h-2 rounded-full overflow-hidden"
          style={{ backgroundColor: "var(--medium-dark)" }}
        >
          <div
            className="h-full transition-all duration-300 ease-in-out rounded-full"
            style={{
              width: `${(currentStep / totalSteps) * 100}%`,
              backgroundColor: "var(--primary-blue)",
            }}
          />
        </div>
      </div>

      {/* Content card */}
      <div 
        className="w-full max-w-md rounded-design-lg border p-8"
        style={{
          backgroundColor: "var(--medium-dark)",
          borderColor: "var(--color-border)",
        }}
      >
        {children}
      </div>

      {/* Helper text */}
      <p 
        className="mt-6 text-sm text-center max-w-md"
        style={{ color: "var(--neutral-stone)" }}
      >
        This information helps Miller personalize your experience
      </p>
    </div>
  );
}
