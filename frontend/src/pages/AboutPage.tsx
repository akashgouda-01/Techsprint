import { motion } from "framer-motion";
import { Shield, Brain, Lock, Users, ArrowRight, MapPin } from "lucide-react";
import { Link } from "react-router-dom";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

const steps = [
  {
    number: "01",
    title: "Enter Your Route",
    description: "Input your source and destination. Select your travel mode - walking or two-wheeler.",
  },
  {
    number: "02",
    title: "AI Analyzes Routes",
    description: "Our system generates multiple route options and breaks each into road segments for analysis.",
  },
  {
    number: "03",
    title: "Safety Scoring",
    description: "Each segment is evaluated for time-of-day risk, nearby activity, crowd presence, and past feedback.",
  },
  {
    number: "04",
    title: "Safest Route Selected",
    description: "Routes are ranked by cumulative safety score. The safest path is highlighted for you.",
  },
  {
    number: "05",
    title: "Live Monitoring",
    description: "During navigation, safety is continuously re-evaluated. If risk increases, rerouting happens automatically.",
  },
];

const principles = [
  {
    icon: Shield,
    title: "Prevention First",
    description: "We prevent exposure to unsafe areas before you reach them, not after an incident occurs.",
  },
  {
    icon: Lock,
    title: "Privacy Protected",
    description: "No personal identity storage. All safety signals are aggregated anonymously.",
  },
  {
    icon: Brain,
    title: "AI-Powered",
    description: "Machine learning evaluates multiple data signals to compute dynamic safety scores.",
  },
  {
    icon: Users,
    title: "Community Driven",
    description: "Anonymous user feedback continuously improves route safety accuracy over time.",
  },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="pt-24 pb-16">
        {/* Hero Section */}
        <section className="container mx-auto px-4 mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="max-w-3xl mx-auto text-center"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-6">
              How <span className="text-gradient-primary">SafeRoute AI</span> Works
            </h1>
            <p className="text-xl text-muted-foreground leading-relaxed">
              Unlike traditional navigation that optimizes for speed, SafeRoute AI prioritizes 
              your safety by analyzing multiple risk factors before you travel.
            </p>
          </motion.div>
        </section>

        {/* Process Steps */}
        <section className="container mx-auto px-4 mb-24">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-bold text-center mb-12"
          >
            The Safety Analysis Process
          </motion.h2>
          
          <div className="max-w-4xl mx-auto space-y-6">
            {steps.map((step, index) => (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card variant="gradient" className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-6 flex items-start gap-6">
                    <span className="text-4xl font-bold text-primary/30">{step.number}</span>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                      <p className="text-muted-foreground">{step.description}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Core Principles */}
        <section className="container mx-auto px-4 mb-24">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-2xl md:text-3xl font-bold text-center mb-12"
          >
            Our Core Principles
          </motion.h2>
          
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {principles.map((principle, index) => (
              <motion.div
                key={principle.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
              >
                <Card variant="gradient" className="h-full">
                  <CardContent className="p-6">
                    <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                      <principle.icon className="w-6 h-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{principle.title}</h3>
                    <p className="text-muted-foreground text-sm">{principle.description}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </section>

        {/* Target Users */}
        <section className="container mx-auto px-4 mb-24">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-3xl mx-auto text-center"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-6">
              Built For Those Who Need It Most
            </h2>
            <p className="text-muted-foreground mb-8">
              SafeRoute AI is designed for anyone who wants to travel safer, especially:
            </p>
            <div className="flex flex-wrap justify-center gap-3">
              {["Women", "Students", "Pedestrians", "Two-Wheeler Users", "Late-Night Travelers"].map(
                (user) => (
                  <span
                    key={user}
                    className="px-4 py-2 rounded-full bg-primary/10 text-primary text-sm font-medium"
                  >
                    {user}
                  </span>
                )
              )}
            </div>
          </motion.div>
        </section>

        {/* CTA */}
        <section className="container mx-auto px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <h2 className="text-2xl md:text-3xl font-bold mb-6">
              Ready to Navigate <span className="text-gradient-safety">Safely</span>?
            </h2>
            <Button variant="hero" size="xl" asChild>
              <Link to="/navigate">
                <MapPin className="w-5 h-5" />
                Plan Your Safe Route
                <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </motion.div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
