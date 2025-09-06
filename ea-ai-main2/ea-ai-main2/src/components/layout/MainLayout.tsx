"use client";

import { Toaster } from "sonner";

export type MainLayoutProps = {
  children: React.ReactNode;
};

export const MainLayout = ({ children }: MainLayoutProps) => {
  return (
    <div className="w-full h-[100dvh] bg-background p-1 flex flex-row">
      {children}
      <Toaster />
    </div>
  );
};