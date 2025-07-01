"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, LogIn, Bot, Shield, Zap, Users } from "lucide-react";
import Link from "next/link";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/";

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");

  const onLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const isEmail = identifier.includes("@");
    const result = isEmail
      ? await authClient.signIn.email({
          email: identifier,
          password,
        })
      : await authClient.signIn.username({
          username: identifier,
          password,
        });

    setLoading(false);
    if (result.error) {
      setError(result.error.message ?? "Authentication failed");
    } else {
      router.refresh();
      router.push(redirectTo);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-100 dark:from-slate-950 dark:via-slate-900 dark:to-slate-800">
      <div className="flex min-h-screen">
        {/* Left Branding Panel */}
        <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 lg:flex lg:w-1/2">
          {/* Background Pattern */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-600/20 via-purple-600/20 to-emerald-600/20" />
          <div
            className="absolute inset-0 bg-repeat opacity-50"
            style={{
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.05'%3E%3Ccircle cx='30' cy='30' r='2'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          />

          <div className="relative flex w-full flex-col justify-center px-12 xl:px-16">
            <div className="max-w-lg space-y-12">
              {/* Logo & Brand */}
              <div className="space-y-6">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-2xl bg-white/20 blur-xl" />
                    <div className="relative rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
                      <Bot className="h-8 w-8 text-white" />
                    </div>
                  </div>
                  <div>
                    <h1 className="text-3xl font-bold tracking-tight text-white">
                      AIKP
                    </h1>
                    <p className="text-sm font-medium text-slate-300">
                      AI Assistant Platform
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <h2 className="text-4xl leading-tight font-bold text-white xl:text-5xl">
                    Welcome Back
                  </h2>
                  <p className="text-xl leading-relaxed font-light text-slate-200">
                    Continue your intelligent conversations and unlock the full
                    potential of AI assistance.
                  </p>
                </div>
              </div>

              {/* Feature Highlights */}
              <div className="space-y-6">
                <div className="grid gap-4">
                  <div className="group flex items-start space-x-4">
                    <div className="mt-1 rounded-lg bg-emerald-500/20 p-2 transition-colors group-hover:bg-emerald-500/30">
                      <Zap className="h-4 w-4 text-emerald-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        Lightning Fast
                      </h3>
                      <p className="text-sm text-slate-300">
                        Get instant responses to your queries
                      </p>
                    </div>
                  </div>

                  <div className="group flex items-start space-x-4">
                    <div className="mt-1 rounded-lg bg-blue-500/20 p-2 transition-colors group-hover:bg-blue-500/30">
                      <Shield className="h-4 w-4 text-blue-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        Secure & Private
                      </h3>
                      <p className="text-sm text-slate-300">
                        Your data is encrypted and protected
                      </p>
                    </div>
                  </div>

                  <div className="group flex items-start space-x-4">
                    <div className="mt-1 rounded-lg bg-purple-500/20 p-2 transition-colors group-hover:bg-purple-500/30">
                      <Users className="h-4 w-4 text-purple-300" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-white">
                        Multi-Platform
                      </h3>
                      <p className="text-sm text-slate-300">
                        Access from web, mobile, or Discord
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="flex items-center space-x-8 border-t border-white/10 pt-8">
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">10K+</div>
                  <div className="text-xs tracking-wider text-slate-400 uppercase">
                    Active Users
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">99.9%</div>
                  <div className="text-xs tracking-wider text-slate-400 uppercase">
                    Uptime
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-white">24/7</div>
                  <div className="text-xs tracking-wider text-slate-400 uppercase">
                    Available
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Form Panel */}
        <div className="flex w-full flex-col justify-center p-6 sm:p-8 lg:w-1/2 lg:p-12 xl:p-16">
          <div className="mx-auto w-full max-w-sm space-y-8">
            {/* Mobile Header */}
            <div className="space-y-4 text-center lg:hidden">
              <div className="mx-auto flex items-center justify-center space-x-3">
                <div className="rounded-xl bg-slate-900 p-3 dark:bg-slate-800">
                  <Bot className="h-6 w-6 text-white" />
                </div>
                <div className="text-left">
                  <h1 className="text-2xl font-bold">AIKP</h1>
                  <p className="text-muted-foreground text-sm">
                    AI Assistant Platform
                  </p>
                </div>
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold">Welcome Back</h2>
                <p className="text-muted-foreground">
                  Sign in to continue your conversation
                </p>
              </div>
            </div>

            {error && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <Card className="border-0 bg-white/90 shadow-xl backdrop-blur-sm dark:bg-slate-900/90">
              <CardHeader className="space-y-3 pb-6">
                <div className="flex items-center space-x-2">
                  <LogIn className="h-5 w-5 text-slate-600 dark:text-slate-400" />
                  <CardTitle className="text-xl">Sign In</CardTitle>
                </div>
                <CardDescription className="text-base">
                  Enter your credentials to access your account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <form onSubmit={onLogin} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="identifier" className="text-sm font-medium">
                      Email or Username
                    </Label>
                    <Input
                      id="identifier"
                      type="text"
                      required
                      placeholder="you@example.com or username"
                      value={identifier}
                      onChange={(e) => setIdentifier(e.target.value)}
                      disabled={loading}
                      className="h-12 text-base"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium">
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      disabled={loading}
                      className="h-12 text-base"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={loading}
                    className="h-12 w-full text-base font-medium"
                  >
                    {loading ? "Signing In..." : "Sign In"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            <div className="space-y-4 text-center">
              <p className="text-muted-foreground text-sm">
                Don't have an account?{" "}
                <Link
                  href="/auth/signup"
                  className="text-primary hover:text-primary/80 font-medium underline underline-offset-4"
                >
                  Create one
                </Link>
              </p>

              <p className="text-muted-foreground text-xs leading-relaxed">
                By signing in, you agree to our{" "}
                <a
                  href="#"
                  className="hover:text-foreground underline underline-offset-4"
                >
                  Terms
                </a>{" "}
                and{" "}
                <a
                  href="#"
                  className="hover:text-foreground underline underline-offset-4"
                >
                  Privacy Policy
                </a>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
