import React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface Step3PreferencesProps {
  workingHoursStart: string;
  workingHoursEnd: string;
  timezone: string;
  onWorkingHoursStartChange: (value: string) => void;
  onWorkingHoursEndChange: (value: string) => void;
  onTimezoneChange: (value: string) => void;
  onComplete: () => void;
  onBack: () => void;
  isSubmitting?: boolean;
}

const COMMON_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Phoenix",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Dubai",
  "Australia/Sydney",
  "Pacific/Auckland",
];

export function Step3Preferences({
  workingHoursStart,
  workingHoursEnd,
  timezone,
  onWorkingHoursStartChange,
  onWorkingHoursEndChange,
  onTimezoneChange,
  onComplete,
  onBack,
  isSubmitting = false,
}: Step3PreferencesProps) {
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onComplete();
  };

  const handleSkip = () => {
    // Clear values and complete
    onWorkingHoursStartChange("");
    onWorkingHoursEndChange("");
    onTimezoneChange("");
    onComplete();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h2 
          className="text-2xl font-bold mb-2"
          style={{ color: "var(--soft-off-white)" }}
        >
          Set your preferences
        </h2>
        <p style={{ color: "var(--neutral-stone)" }}>
          Help Miller respect your working hours and schedule
        </p>
      </div>

      <div className="space-y-4">
        {/* Working Hours Start */}
        <div className="space-y-2">
          <Label htmlFor="workingHoursStart">
            Preferred Working Hours - Start
          </Label>
          <Input
            id="workingHoursStart"
            type="time"
            value={workingHoursStart}
            onChange={(e) => onWorkingHoursStartChange(e.target.value)}
            placeholder="09:00"
          />
        </div>

        {/* Working Hours End */}
        <div className="space-y-2">
          <Label htmlFor="workingHoursEnd">
            Preferred Working Hours - End
          </Label>
          <Input
            id="workingHoursEnd"
            type="time"
            value={workingHoursEnd}
            onChange={(e) => onWorkingHoursEndChange(e.target.value)}
            placeholder="17:00"
          />
        </div>

        {/* Timezone */}
        <div className="space-y-2">
          <Label htmlFor="timezone">
            Timezone
          </Label>
          <Select value={timezone} onValueChange={onTimezoneChange}>
            <SelectTrigger id="timezone">
              <SelectValue placeholder="Select your timezone" />
            </SelectTrigger>
            <SelectContent>
              {COMMON_TIMEZONES.map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz.replace(/_/g, " ")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="text-xs" style={{ color: "var(--neutral-stone)" }}>
            All fields are optional - You can configure these later in settings
          </p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button 
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={isSubmitting}
          className="flex-1"
        >
          ← Back
        </Button>
        <Button 
          type="button"
          variant="ghost"
          onClick={handleSkip}
          disabled={isSubmitting}
          style={{ color: "var(--neutral-stone)" }}
        >
          Skip
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting}
          className="flex-1"
          style={{
            backgroundColor: "var(--primary-blue)",
            color: "var(--pure-white)",
            opacity: isSubmitting ? 0.5 : 1,
          }}
        >
          {isSubmitting ? "Setting up..." : "Complete →"}
        </Button>
      </div>
    </form>
  );
}
