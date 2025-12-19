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
  ArrowRight
} from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative py-24 px-4 overflow-hidden">
          {/* Background gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 -z-10" />
          <div className="absolute inset-0 bg-grid-pattern opacity-5 -z-10" />
          
          <div className="max-w-6xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-100 text-blue-700 text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              AI-Powered Content Automation
            </div>
            
            <h1 className="text-6xl md:text-7xl font-extrabold mb-6 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600">
              FlowPost
            </h1>
            
            <p className="text-2xl md:text-3xl font-semibold text-gray-800 mb-4">
              Automate Your Social Media Presence
            </p>
            
            <p className="text-lg md:text-xl text-gray-600 mb-10 max-w-3xl mx-auto">
              Create intelligent workflows that discover content, generate stunning visuals, 
              and post automatically to Instagram, Twitter, and LinkedIn. Let AI handle your social media.
            </p>
            
            <div className="flex justify-center gap-4 flex-wrap">
              <Link href="/sign-up">
                <Button size="lg" className="text-lg px-8 h-14 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="#how-it-works">
                <Button variant="outline" size="lg" className="text-lg px-8 h-14 border-2">
                  See How It Works
                </Button>
              </Link>
            </div>

            <div className="mt-12 flex justify-center items-center gap-8 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                No credit card required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Setup in 5 minutes
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5 text-green-600" />
                Cancel anytime
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 px-4 bg-white">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">How FlowPost Works</h2>
              <p className="text-xl text-gray-600">Set it up once, let it run forever</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="relative border-2 hover:shadow-xl transition-all">
                <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold">
                  1
                </div>
                <CardContent className="pt-8">
                  <Workflow className="h-12 w-12 text-blue-600 mb-4" />
                  <h3 className="text-xl font-bold mb-3">Create Workflow</h3>
                  <p className="text-gray-600">
                    Define your content strategy: what to search for, where to post, and how often. 
                    Set your style and preferences.
                  </p>
                </CardContent>
              </Card>

              <Card className="relative border-2 hover:shadow-xl transition-all">
                <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 text-white flex items-center justify-center font-bold">
                  2
                </div>
                <CardContent className="pt-8">
                  <Sparkles className="h-12 w-12 text-indigo-600 mb-4" />
                  <h3 className="text-xl font-bold mb-3">AI Works Magic</h3>
                  <p className="text-gray-600">
                    Our AI discovers relevant content, curates the best pieces, generates beautiful 
                    images, and crafts engaging captions.
                  </p>
                </CardContent>
              </Card>

              <Card className="relative border-2 hover:shadow-xl transition-all">
                <div className="absolute -top-4 left-6 w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 text-white flex items-center justify-center font-bold">
                  3
                </div>
                <CardContent className="pt-8">
                  <Zap className="h-12 w-12 text-purple-600 mb-4" />
                  <h3 className="text-xl font-bold mb-3">Auto-Post</h3>
                  <p className="text-gray-600">
                    Posts are automatically published to your social media accounts on schedule. 
                    Track performance from your dashboard.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section id="features" className="py-20 px-4 bg-gradient-to-br from-gray-50 to-blue-50">
          <div className="max-w-6xl mx-auto">
            <div className="text-center mb-16">
              <h2 className="text-4xl font-bold mb-4">Powerful Features</h2>
              <p className="text-xl text-gray-600">Everything you need to dominate social media</p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-all border-2">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-blue-100 flex items-center justify-center mb-4">
                    <Globe className="h-6 w-6 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Multi-Platform Support</h3>
                  <p className="text-gray-600 text-sm">
                    Post to Instagram, Twitter, and LinkedIn from one dashboard.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all border-2">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-indigo-100 flex items-center justify-center mb-4">
                    <Sparkles className="h-6 w-6 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">AI Content Discovery</h3>
                  <p className="text-gray-600 text-sm">
                    Smart AI finds relevant content based on your topics and location.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all border-2">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-purple-100 flex items-center justify-center mb-4">
                    <ImageIcon className="h-6 w-6 text-purple-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">AI Image Generation</h3>
                  <p className="text-gray-600 text-sm">
                    Create stunning visuals with DALL-E 3 that match your brand style.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all border-2">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-green-100 flex items-center justify-center mb-4">
                    <Calendar className="h-6 w-6 text-green-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Smart Scheduling</h3>
                  <p className="text-gray-600 text-sm">
                    Set your posting frequency - daily, weekly, or custom schedules.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all border-2">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-orange-100 flex items-center justify-center mb-4">
                    <BarChart3 className="h-6 w-6 text-orange-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Analytics Dashboard</h3>
                  <p className="text-gray-600 text-sm">
                    Track all your posts, success rates, and workflow performance.
                  </p>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-all border-2">
                <CardContent className="pt-6">
                  <div className="w-12 h-12 rounded-lg bg-pink-100 flex items-center justify-center mb-4">
                    <Workflow className="h-6 w-6 text-pink-600" />
                  </div>
                  <h3 className="text-lg font-bold mb-2">Unlimited Workflows</h3>
                  <p className="text-gray-600 text-sm">
                    Create multiple workflows for different content strategies.
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to Automate Your Social Media?
            </h2>
            <p className="text-xl mb-10 opacity-90">
              Join thousands of creators and businesses saving 10+ hours per week
            </p>
            <Link href="/sign-up">
              <Button size="lg" variant="secondary" className="text-lg px-10 h-14 bg-white text-blue-600 hover:bg-gray-100">
                Start Free Trial Today
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </section>
      </main>

      <footer className="py-12 px-4 bg-gray-900 text-gray-400">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <h3 className="text-white font-bold text-lg mb-4">FlowPost</h3>
              <p className="text-sm">
                Intelligent social media automation powered by AI.
              </p>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#features" className="hover:text-white">Features</Link></li>
                <li><Link href="#how-it-works" className="hover:text-white">How It Works</Link></li>
                <li><Link href="/sign-up" className="hover:text-white">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">About</Link></li>
                <li><Link href="#" className="hover:text-white">Blog</Link></li>
                <li><Link href="#" className="hover:text-white">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="text-white font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li><Link href="#" className="hover:text-white">Privacy</Link></li>
                <li><Link href="#" className="hover:text-white">Terms</Link></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-gray-800 pt-8 text-center text-sm">
            <p>© 2024 FlowPost. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
