import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  Sparkles,
  Zap,
  Calendar,
  BarChart3,
  Image as ImageIcon,
  Globe,
  ArrowRight,
  Play,
  Instagram,
  Twitter,
  Linkedin,
  TrendingUp,
  Bot,
  Rocket,
  MousePointerClick,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-[#0a0a0f]">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative min-h-[90vh] flex items-center justify-center px-4 overflow-hidden">
          {/* Animated background */}
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-purple-600/30 rounded-full blur-[128px] animate-pulse" />
            <div className="absolute bottom-1/4 right-1/4 w-[400px] h-[400px] bg-cyan-500/20 rounded-full blur-[128px] animate-pulse delay-1000" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[128px]" />
          </div>

          {/* Grid pattern overlay */}
          <div
            className="absolute inset-0 opacity-20"
            style={{
              backgroundImage: `linear-gradient(rgba(255,255,255,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.03) 1px, transparent 1px)`,
              backgroundSize: "64px 64px",
            }}
          />

          <div className="relative max-w-5xl mx-auto text-center">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-cyan-400 text-sm font-medium mb-8 backdrop-blur-sm">
              <Sparkles className="h-4 w-4" />
              <span>AI-Powered Automation</span>
              <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-xs">
                NEW
              </span>
            </div>

            {/* Main heading */}
            <h1 className="text-5xl md:text-7xl lg:text-8xl font-black mb-6 tracking-tight">
              <span className="text-white">Social Media</span>
              <br />
              <span className="bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 bg-clip-text text-transparent">
                on Autopilot
              </span>
            </h1>

            {/* Subheading - shorter */}
            <p className="text-xl md:text-2xl text-zinc-400 mb-10 max-w-2xl mx-auto font-light">
              AI finds trends. Creates content. Posts everywhere.
              <br />
              <span className="text-zinc-500">You focus on what matters.</span>
            </p>

            {/* CTAs */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="text-lg px-8 h-14 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold rounded-xl shadow-lg shadow-cyan-500/25 transition-all hover:shadow-cyan-500/40 hover:scale-105"
                >
                  Start Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-lg px-8 h-14 border-white/20 text-white hover:bg-white/10 font-semibold rounded-xl backdrop-blur-sm"
                >
                  <Play className="mr-2 h-5 w-5" />
                  Watch Demo
                </Button>
              </Link>
            </div>

            {/* Trust indicators */}
            <div className="flex flex-wrap justify-center gap-8 text-sm text-zinc-500">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                No credit card
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                10 free credits
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                Cancel anytime
              </div>
            </div>
          </div>

          {/* Floating platform icons */}
          <div className="absolute bottom-20 left-10 hidden lg:block animate-bounce delay-100">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center shadow-xl shadow-pink-500/30">
              <Instagram className="h-7 w-7 text-white" />
            </div>
          </div>
          <div className="absolute top-40 right-20 hidden lg:block animate-bounce delay-300">
            <div className="w-14 h-14 rounded-2xl bg-black border border-white/20 flex items-center justify-center shadow-xl">
              <Twitter className="h-7 w-7 text-white" />
            </div>
          </div>
          <div className="absolute bottom-40 right-32 hidden lg:block animate-bounce delay-500">
            <div className="w-14 h-14 rounded-2xl bg-[#0A66C2] flex items-center justify-center shadow-xl shadow-blue-500/30">
              <Linkedin className="h-7 w-7 text-white" />
            </div>
          </div>
        </section>

        {/* Stats - Compact and visual */}
        <section className="py-16 px-4 border-y border-white/5">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              {[
                { value: "10+", label: "Hours saved", icon: "⏱️" },
                { value: "3", label: "Platforms", icon: "🎯" },
                { value: "AI", label: "Powered", icon: "🤖" },
                { value: "24/7", label: "Always on", icon: "⚡" },
              ].map((stat, i) => (
                <div key={i} className="text-center group">
                  <div className="text-4xl mb-2">{stat.icon}</div>
                  <div className="text-3xl md:text-4xl font-black text-white mb-1 group-hover:text-cyan-400 transition-colors">
                    {stat.value}
                  </div>
                  <p className="text-zinc-500 text-sm">{stat.label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works - Visual steps */}
        <section id="how-it-works" className="py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                Three steps.{" "}
                <span className="text-zinc-500">That&apos;s it.</span>
              </h2>
            </div>

            <div className="grid md:grid-cols-3 gap-6">
              {/* Step 1 */}
              <div className="group relative p-8 rounded-3xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 hover:border-cyan-500/50 transition-all hover:-translate-y-2">
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-cyan-500 text-black font-bold flex items-center justify-center text-sm">
                  1
                </div>
                <div className="w-16 h-16 rounded-2xl bg-cyan-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <MousePointerClick className="h-8 w-8 text-cyan-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Connect</h3>
                <p className="text-zinc-400">
                  Link your socials. Pick your niche. Set your schedule.
                </p>
              </div>

              {/* Step 2 */}
              <div className="group relative p-8 rounded-3xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 hover:border-purple-500/50 transition-all hover:-translate-y-2">
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-purple-500 text-white font-bold flex items-center justify-center text-sm">
                  2
                </div>
                <div className="w-16 h-16 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Bot className="h-8 w-8 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  AI Creates
                </h3>
                <p className="text-zinc-400">
                  Finds trends. Writes captions. Generates images.
                </p>
              </div>

              {/* Step 3 */}
              <div className="group relative p-8 rounded-3xl bg-gradient-to-b from-white/5 to-transparent border border-white/10 hover:border-emerald-500/50 transition-all hover:-translate-y-2">
                <div className="absolute -top-3 -left-3 w-8 h-8 rounded-full bg-emerald-500 text-black font-bold flex items-center justify-center text-sm">
                  3
                </div>
                <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                  <Rocket className="h-8 w-8 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">Sit Back</h3>
                <p className="text-zinc-400">
                  Posts go live. You track results. Repeat forever.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features - Bento grid style */}
        <section id="features" className="py-24 px-4">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl md:text-5xl font-black text-white mb-4">
                Everything you need
              </h2>
              <p className="text-zinc-500 text-lg">
                One platform. Zero busywork.
              </p>
            </div>

            {/* Bento Grid */}
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Feature 1 - Large */}
              <div className="lg:col-span-2 group p-8 rounded-3xl bg-gradient-to-br from-cyan-500/10 via-transparent to-transparent border border-white/10 hover:border-cyan-500/30 transition-all">
                <div className="flex items-start justify-between mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-cyan-500/20 flex items-center justify-center">
                    <Globe className="h-7 w-7 text-cyan-400" />
                  </div>
                  <div className="flex gap-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                      <Instagram className="h-5 w-5 text-white" />
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-black border border-white/20 flex items-center justify-center">
                      <Twitter className="h-5 w-5 text-white" />
                    </div>
                    <div className="w-10 h-10 rounded-xl bg-[#0A66C2] flex items-center justify-center">
                      <Linkedin className="h-5 w-5 text-white" />
                    </div>
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Multi-Platform
                </h3>
                <p className="text-zinc-400">
                  One workflow posts to Instagram, Twitter, and LinkedIn.
                  Automatically.
                </p>
              </div>

              {/* Feature 2 */}
              <div className="group p-8 rounded-3xl bg-gradient-to-br from-purple-500/10 via-transparent to-transparent border border-white/10 hover:border-purple-500/30 transition-all">
                <div className="w-14 h-14 rounded-2xl bg-purple-500/20 flex items-center justify-center mb-6">
                  <TrendingUp className="h-7 w-7 text-purple-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Trend Hunter
                </h3>
                <p className="text-zinc-400 text-sm">
                  AI scans the web for viral content in your niche.
                </p>
              </div>

              {/* Feature 3 */}
              <div className="group p-8 rounded-3xl bg-gradient-to-br from-pink-500/10 via-transparent to-transparent border border-white/10 hover:border-pink-500/30 transition-all">
                <div className="w-14 h-14 rounded-2xl bg-pink-500/20 flex items-center justify-center mb-6">
                  <ImageIcon className="h-7 w-7 text-pink-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  DALL-E Images
                </h3>
                <p className="text-zinc-400 text-sm">
                  Stunning AI visuals that match your brand.
                </p>
              </div>

              {/* Feature 4 */}
              <div className="group p-8 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border border-white/10 hover:border-emerald-500/30 transition-all">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/20 flex items-center justify-center mb-6">
                  <Calendar className="h-7 w-7 text-emerald-400" />
                </div>
                <h3 className="text-xl font-bold text-white mb-2">
                  Smart Schedule
                </h3>
                <p className="text-zinc-400 text-sm">
                  Daily, weekly, or custom. Your timing, automated.
                </p>
              </div>

              {/* Feature 5 - Large */}
              <div className="lg:col-span-2 group p-8 rounded-3xl bg-gradient-to-br from-orange-500/10 via-transparent to-transparent border border-white/10 hover:border-orange-500/30 transition-all">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 rounded-2xl bg-orange-500/20 flex items-center justify-center">
                    <BarChart3 className="h-7 w-7 text-orange-400" />
                  </div>
                  <div className="flex-1 h-8 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full w-3/4 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-full animate-pulse" />
                  </div>
                </div>
                <h3 className="text-2xl font-bold text-white mb-2">
                  Track Everything
                </h3>
                <p className="text-zinc-400">
                  Real-time analytics. See what works. Double down on winners.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-4 relative overflow-hidden">
          {/* Background glow */}
          <div className="absolute inset-0">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[400px] bg-gradient-to-r from-cyan-500/20 via-purple-500/20 to-pink-500/20 rounded-full blur-[100px]" />
          </div>

          <div className="relative max-w-3xl mx-auto text-center">
            <h2 className="text-4xl md:text-6xl font-black text-white mb-6">
              Ready to go
              <br />
              <span className="bg-gradient-to-r from-cyan-400 to-purple-500 bg-clip-text text-transparent">
                viral?
              </span>
            </h2>
            <p className="text-xl text-zinc-400 mb-10">
              10 free credits. No credit card. Start in 60 seconds.
            </p>
            <Link href="/sign-up">
              <Button
                size="lg"
                className="text-lg px-12 h-16 bg-white text-black hover:bg-zinc-100 font-bold rounded-2xl shadow-2xl shadow-white/10 transition-all hover:scale-105"
              >
                Start Free Trial
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      {/* Footer - Minimal */}
      <footer className="py-12 px-4 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="h-5 w-5 text-white" />
              </div>
              <span className="text-white font-bold text-xl">FlowPost</span>
            </div>

            <div className="flex gap-8 text-sm text-zinc-500">
              <Link
                href="#features"
                className="hover:text-white transition-colors"
              >
                Features
              </Link>
              <Link
                href="#how-it-works"
                className="hover:text-white transition-colors"
              >
                How It Works
              </Link>
              <Link
                href="/pricing"
                className="hover:text-white transition-colors"
              >
                Pricing
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
                Privacy
              </Link>
              <Link href="#" className="hover:text-white transition-colors">
                Terms
              </Link>
            </div>
          </div>

          <div className="mt-8 pt-8 border-t border-white/5 text-center text-zinc-600 text-sm">
            © 2025 FlowPost. Ship content, not stress.
          </div>
        </div>
      </footer>
    </div>
  );
}
