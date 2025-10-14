import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

interface Step2ProfessionalProps {
  occupation: string;
  onOccupationChange: (value: string) => void;
  onNext: () => void;
  onBack: () => void;
  errors?: {
    occupation?: string;
  };
}

export function Step2Professional({
  occupation,
  onOccupationChange,
  onNext,
  onBack,
  errors = {},
}: Step2ProfessionalProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onNext();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--soft-off-white)" }}
        >
          Tell us what you do
        </h2>
        <p style={{ color: "var(--neutral-stone)" }}>
          This helps Miller provide more relevant assistance for your work
        </p>
      </div>

      <div className="space-y-4">
        {/* Occupation */}
        <div className="space-y-2">
          <Label htmlFor="occupation">
            Occupation or Role
          </Label>
          <Input
            id="occupation"
            type="text"
            value={occupation}
            onChange={(e) => onOccupationChange(e.target.value)}
            placeholder="e.g., Software Engineer, Designer, Student"
            maxLength={100}
            className={errors.occupation ? "border-destructive" : ""}
          />
          {errors.occupation && (
            <p className="text-sm text-destructive">{errors.occupation}</p>
          )}
          <p className="text-xs" style={{ color: "var(--neutral-stone)" }}>
            Optional - You can skip this step if you prefer
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button 
          type="button"
          variant="outline"
          onClick={onBack}
          className="flex-1"
        >
          ← Back
        </Button>
        <Button 
          type="submit" 
          className="flex-1"
          style={{
            backgroundColor: "var(--primary-blue)",
            color: "var(--pure-white)",
          }}
        >
          Next →
        </Button>
      </div>
    </form>
  );
}
