import { SignUp } from "@clerk/nextjs";

export default function Page() {
  if (!process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background px-6">
        <div className="max-w-md text-center space-y-3">
          <h1 className="text-2xl font-semibold text-foreground">
            Authentication is not configured
          </h1>
          <p className="text-sm text-muted-foreground">
            Add Clerk environment variables in Vercel to enable sign up.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <SignUp />
    </div>
  );
}
