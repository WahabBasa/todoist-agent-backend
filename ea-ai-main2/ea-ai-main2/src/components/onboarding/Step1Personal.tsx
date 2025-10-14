import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Step1PersonalProps {
  fullName: string;
  preferredName: string;
  onFullNameChange: (value: string) => void;
  onPreferredNameChange: (value: string) => void;
  onNext: () => void;
  errors?: {
    fullName?: string;
    preferredName?: string;
  };
}

export function Step1Personal({
  fullName,
  preferredName,
  onFullNameChange,
  onPreferredNameChange,
  onNext,
  errors = {},
}: Step1PersonalProps) {
  const isValid = fullName.trim().length >= 2 && preferredName.trim().length >= 2;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isValid) {
      onNext();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--soft-off-white)" }}
        >
          Welcome! Let's get to know you
        </h2>
        <p style={{ color: "var(--neutral-stone)" }}>
          Tell us a bit about yourself so Miller can assist you better
        </p>
      </div>

      <div className="space-y-4">
        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName">
            Full Name <span style={{ color: "#ef4444" }}>*</span>
          </Label>
          <Input
            id="fullName"
            type="text"
            value={fullName}
            onChange={(e) => onFullNameChange(e.target.value)}
            placeholder="e.g., John Smith"
            maxLength={100}
            required
            className={errors.fullName ? "border-destructive" : ""}
          />
          {errors.fullName && (
            <p className="text-sm text-destructive">{errors.fullName}</p>
          )}
        </div>

        {/* Preferred Name */}
        <div className="space-y-2">
          <Label htmlFor="preferredName">
            How should Miller address you? <span style={{ color: "#ef4444" }}>*</span>
          </Label>
          <Input
            id="preferredName"
            type="text"
            value={preferredName}
            onChange={(e) => onPreferredNameChange(e.target.value)}
            placeholder="e.g., John, Johnny, Mr. Smith"
            maxLength={50}
            required
            className={errors.preferredName ? "border-destructive" : ""}
          />
          {errors.preferredName && (
            <p className="text-sm text-destructive">{errors.preferredName}</p>
          )}
          <p className="text-xs" style={{ color: "var(--neutral-stone)" }}>
            This is how Miller will greet and refer to you in conversations
          </p>
        </div>
      </div>

      <Button 
        type="submit" 
        className="w-full"
        disabled={!isValid}
        style={{
          backgroundColor: isValid ? "var(--primary-blue)" : "var(--medium-dark)",
          color: "var(--pure-white)",
          cursor: isValid ? "pointer" : "not-allowed",
          opacity: isValid ? 1 : 0.5,
        }}
      >
        Next →
      </Button>
    </form>
  );
}
