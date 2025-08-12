import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function Home() {
  return (
    <div className="min-h-screen p-8 bg-background">
      <div className="max-w-4xl mx-auto space-y-8">
        <header className="text-center">
          <h1 className="text-4xl font-bold mb-4">Next.js + shadcn/ui</h1>
          <p className="text-xl text-muted-foreground">Twitter Theme Demo with Tailwind v4</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {/* Button Demo Card */}
          <Card>
            <CardHeader>
              <CardTitle>Buttons</CardTitle>
              <CardDescription>Various button styles from the Twitter theme</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full">Primary Button</Button>
              <Button variant="secondary" className="w-full">Secondary Button</Button>
              <Button variant="outline" className="w-full">Outline Button</Button>
              <Button variant="ghost" className="w-full">Ghost Button</Button>
            </CardContent>
          </Card>

          {/* Input Demo Card */}
          <Card>
            <CardHeader>
              <CardTitle>Form Elements</CardTitle>
              <CardDescription>Input fields with Twitter theme styling</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input placeholder="Enter your email" />
              <Input type="password" placeholder="Enter password" />
              <Textarea placeholder="Write your message..." />
            </CardContent>
          </Card>

          {/* Theme Demo Card */}
          <Card>
            <CardHeader>
              <CardTitle>Twitter Theme</CardTitle>
              <CardDescription>Color palette and design system</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex space-x-2">
                <div className="w-8 h-8 bg-primary rounded"></div>
                <div className="w-8 h-8 bg-secondary rounded"></div>
                <div className="w-8 h-8 bg-accent rounded"></div>
                <div className="w-8 h-8 bg-muted rounded"></div>
              </div>
              <p className="text-sm text-muted-foreground">
                Twitter-inspired color scheme with modern design patterns
              </p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Technology Stack</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold">Next.js 15.4.6</h3>
                <p className="text-sm text-muted-foreground">React Framework</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold">React 19</h3>
                <p className="text-sm text-muted-foreground">UI Library</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold">Tailwind v4</h3>
                <p className="text-sm text-muted-foreground">CSS Framework</p>
              </div>
              <div className="p-4 bg-muted rounded-lg">
                <h3 className="font-semibold">shadcn/ui</h3>
                <p className="text-sm text-muted-foreground">Component Library</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
