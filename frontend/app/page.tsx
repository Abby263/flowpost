import { Navbar } from "@/components/navbar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import Link from "next/link";
import {
  Sparkles,
  Zap,
  Calendar,
  BarChart3,
  Workflow,
  Image as ImageIcon,
  Globe,
  CheckCircle2,
  ArrowRight,
  Play,
  Instagram,
  Twitter,
  Linkedin,
  Clock,
  TrendingUp,
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-20 lg:py-28 px-4 overflow-hidden bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900">
          <div className="max-w-6xl mx-auto">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* Left: Text Content */}
              <div className="text-center lg:text-left">
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 text-blue-200 text-sm font-medium mb-6 backdrop-blur-sm border border-white/10">
                  <Sparkles className="h-4 w-4" />
                  AI-Powered Social Media Automation
                </div>

                <h1 className="text-4xl md:text-5xl lg:text-6xl font-extrabold mb-6 text-white leading-tight">
                  Automate Your
                  <span className="bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-cyan-400">
                    {" "}
                    Social Media{" "}
                  </span>
                  Presence
                </h1>

                <p className="text-lg md:text-xl text-slate-300 mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed">
                  FlowPost uses AI to discover trending content, generate
                  stunning visuals, and automatically post to your social
                  accounts. Set it up once, let it run forever.
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start mb-8">
                  <Link href="/sign-up">
                    <Button
                      size="lg"
                      className="text-base px-8 h-12 bg-white text-slate-900 hover:bg-slate-100 font-semibold w-full sm:w-auto"
                    >
                      Start Free Trial
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="#how-it-works">
                    <Button
                      variant="outline"
                      size="lg"
                      className="text-base px-8 h-12 border-white/20 text-white hover:bg-white/10 w-full sm:w-auto"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      See How It Works
                    </Button>
                  </Link>
                </div>

                <div className="flex flex-wrap justify-center lg:justify-start gap-6 text-sm text-slate-400">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    No credit card required
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    10 free credits
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" />
                    Cancel anytime
                  </div>
                </div>
              </div>

              {/* Right: Platform Cards */}
              <div className="hidden lg:block relative">
                <div className="relative w-full h-[400px]">
                  {/* Instagram Card */}
                  <div className="absolute top-0 left-0 bg-white rounded-2xl shadow-2xl p-5 w-64 transform -rotate-6 hover:rotate-0 transition-transform">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-400 flex items-center justify-center">
                        <Instagram className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          Instagram
                        </p>
                        <p className="text-xs text-slate-500">
                          Auto-posted 2h ago
                        </p>
                      </div>
                    </div>
                    <div className="bg-slate-100 rounded-lg h-32 mb-3 flex items-center justify-center">
                      <ImageIcon className="h-8 w-8 text-slate-400" />
                    </div>
                    <p className="text-sm text-slate-600 line-clamp-2">
                      🚀 AI is transforming content creation...
                    </p>
                  </div>

                  {/* Twitter Card */}
                  <div className="absolute top-20 right-0 bg-white rounded-2xl shadow-2xl p-5 w-64 transform rotate-3 hover:rotate-0 transition-transform">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-black flex items-center justify-center">
                        <Twitter className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">
                          Twitter/X
                        </p>
                        <p className="text-xs text-slate-500">Scheduled 4pm</p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600 mb-3">
                      Just discovered how AI workflows can save 10+ hours/week
                      on content creation 🎯
                    </p>
                    <div className="flex gap-4 text-xs text-slate-500">
                      <span>♥ 128</span>
                      <span>↺ 45</span>
                      <span>💬 23</span>
                    </div>
                  </div>

                  {/* LinkedIn Card */}
                  <div className="absolute bottom-0 left-16 bg-white rounded-2xl shadow-2xl p-5 w-64 transform rotate-2 hover:rotate-0 transition-transform">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                        <Linkedin className="h-5 w-5 text-white" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">LinkedIn</p>
                        <p className="text-xs text-slate-500">
                          Published today
                        </p>
                      </div>
                    </div>
                    <p className="text-sm text-slate-600">
                      How we automated our entire social media strategy using
                      AI...
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-12 px-4 bg-white border-b">
          <div className="max-w-5xl mx-auto">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-slate-900 mb-1">
                  10+
                </div>
                <p className="text-sm text-slate-600">Hours saved weekly</p>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-slate-900 mb-1">
                  3
                </div>
                <p className="text-sm text-slate-600">Platforms supported</p>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-slate-900 mb-1">
                  AI
                </div>
                <p className="text-sm text-slate-600">Powered by Gemini</p>
              </div>
              <div className="text-center">
                <div className="text-3xl md:text-4xl font-bold text-slate-900 mb-1">
                  24/7
                </div>
                <p className="text-sm text-slate-600">Automated posting</p>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 px-4 bg-slate-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-4">
                <Workflow className="h-4 w-4" />
                Simple 3-Step Process
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                How FlowPost Works
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                Set up your automation in minutes, then watch your social media
                presence grow on autopilot.
              </p>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
              {/* Step 1 */}
              <div className="relative">
                <div className="absolute -top-4 left-0 w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                  1
                </div>
                <Card className="pt-8 h-full border-2 hover:border-blue-200 hover:shadow-lg transition-all bg-white">
                  <CardContent>
                    <div className="w-14 h-14 rounded-2xl bg-blue-100 flex items-center justify-center mb-5">
                      <Workflow className="h-7 w-7 text-blue-600" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-slate-900">
                      Create Your Workflow
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Define your content strategy: choose your niche, target
                      platform, posting style, and schedule. Connect your social
                      accounts securely.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Step 2 */}
              <div className="relative">
                <div className="absolute -top-4 left-0 w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                  2
                </div>
                <Card className="pt-8 h-full border-2 hover:border-indigo-200 hover:shadow-lg transition-all bg-white">
                  <CardContent>
                    <div className="w-14 h-14 rounded-2xl bg-indigo-100 flex items-center justify-center mb-5">
                      <Sparkles className="h-7 w-7 text-indigo-600" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-slate-900">
                      AI Creates Content
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Our AI discovers trending topics, curates relevant
                      content, generates eye-catching images with DALL-E, and
                      writes engaging captions.
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Step 3 */}
              <div className="relative">
                <div className="absolute -top-4 left-0 w-10 h-10 rounded-full bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-lg">
                  3
                </div>
                <Card className="pt-8 h-full border-2 hover:border-emerald-200 hover:shadow-lg transition-all bg-white">
                  <CardContent>
                    <div className="w-14 h-14 rounded-2xl bg-emerald-100 flex items-center justify-center mb-5">
                      <Zap className="h-7 w-7 text-emerald-600" />
                    </div>
                    <h3 className="text-xl font-bold mb-3 text-slate-900">
                      Auto-Publish
                    </h3>
                    <p className="text-slate-600 leading-relaxed">
                      Posts are automatically published to Instagram, Twitter,
                      or LinkedIn on your schedule. Track performance from your
                      dashboard.
                    </p>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-indigo-100 text-indigo-700 text-sm font-medium mb-4">
                <Zap className="h-4 w-4" />
                Powerful Features
              </div>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-4">
                Everything You Need
              </h2>
              <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                A complete toolkit to automate and grow your social media
                presence.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-all border-2 hover:border-blue-100 group bg-white">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Globe className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-slate-900">
                    Multi-Platform
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Post to Instagram, Twitter/X, and LinkedIn from one
                    dashboard. One workflow, multiple platforms.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all border-2 hover:border-indigo-100 group bg-white">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-xl bg-indigo-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <TrendingUp className="h-6 w-6 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-slate-900">
                    Trend Discovery
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    AI automatically finds trending content in your niche.
                    Always stay relevant and timely.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all border-2 hover:border-purple-100 group bg-white">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-xl bg-purple-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <ImageIcon className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-slate-900">
                    AI Image Generation
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Generate stunning visuals with DALL-E 3 that match your
                    content and brand style.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all border-2 hover:border-emerald-100 group bg-white">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-xl bg-emerald-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Calendar className="h-6 w-6 text-emerald-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-slate-900">
                    Smart Scheduling
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Set posting frequency - daily, weekly, or custom. Schedule
                    recurring workflows automatically.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all border-2 hover:border-orange-100 group bg-white">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-xl bg-orange-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <BarChart3 className="h-6 w-6 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-slate-900">
                    Analytics Dashboard
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Track post performance, workflow runs, and engagement
                    metrics all in one place.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all border-2 hover:border-pink-100 group bg-white">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-xl bg-pink-100 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Clock className="h-6 w-6 text-pink-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2 text-slate-900">
                    Save 10+ Hours/Week
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed">
                    Automate the entire content creation pipeline. Focus on your
                    business, not posting.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">
              Ready to Automate Your Social Media?
            </h2>
            <p className="text-lg text-slate-300 mb-10 max-w-2xl mx-auto">
              Join creators and businesses saving hours every week. Start with
              10 free credits, no credit card required.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/sign-up">
                <Button
                  size="lg"
                  className="text-base px-10 h-12 bg-white text-slate-900 hover:bg-slate-100 font-semibold"
                >
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base px-10 h-12 border-white/20 text-white hover:bg-white/10"
                >
                  View Pricing
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="py-12 px-4 bg-slate-900 text-slate-400">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <span className="text-white font-bold text-lg">FlowPost</span>
              </div>
              <p className="text-sm leading-relaxed">
                AI-powered social media automation. Create once, post
                everywhere.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link
                    href="#features"
                    className="hover:text-white transition"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="#how-it-works"
                    className="hover:text-white transition"
                  >
                    How It Works
                  </Link>
                </li>
                <li>
                  <Link href="/pricing" className="hover:text-white transition">
                    Pricing
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="hover:text-white transition">
                    About
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition">
                    Blog
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition">
                    Contact
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <Link href="#" className="hover:text-white transition">
                    Privacy
                  </Link>
                </li>
                <li>
                  <Link href="#" className="hover:text-white transition">
                    Terms
                  </Link>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-center text-sm">
            <p>© 2024 FlowPost. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
