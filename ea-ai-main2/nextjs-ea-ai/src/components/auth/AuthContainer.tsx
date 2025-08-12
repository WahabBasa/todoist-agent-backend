'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { SignInForm } from './SignInForm';
import { SignUpForm } from './SignUpForm';
import { AuthHeader } from './AuthHeader';

export function AuthContainer() {
  const [activeTab, setActiveTab] = useState('signin');

  return (
    <Card className="w-full max-w-md p-6 space-y-6">
      <AuthHeader />
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="signin">Sign In</TabsTrigger>
          <TabsTrigger value="signup">Sign Up</TabsTrigger>
        </TabsList>
        
        <TabsContent value="signin" className="mt-6">
          <SignInForm />
        </TabsContent>
        
        <TabsContent value="signup" className="mt-6">
          <SignUpForm />
        </TabsContent>
      </Tabs>
    </Card>
  );
}