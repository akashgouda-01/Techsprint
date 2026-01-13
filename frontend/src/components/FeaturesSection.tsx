import { motion } from "framer-motion";
import { Shield, Route, Brain, AlertTriangle, RefreshCw, MessageSquare } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const features = [
  {
    icon: Route,
    title: "Segment Analysis",
    description: "Routes are broken into segments, each evaluated for individual safety risks.",
    color: "text-primary",
  },
  {
    icon: Brain,
    title: "AI-Powered Scoring",
    description: "Machine learning evaluates time, environment, and community signals.",
    color: "text-safety-high",
  },
  {
    icon: AlertTriangle,
    title: "Risk Detection",
    description: "Identifies low lighting, isolation, and reduced activity areas.",
    color: "text-safety-medium",
  },
  {
    icon: RefreshCw,
    title: "Live Rerouting",
    description: "Continuously monitors and suggests safer alternatives in real-time.",
    color: "text-primary",
  },
  {
    icon: Shield,
    title: "Preventive Focus",
    description: "Prevents exposure to unsafe areas before you reach them.",
    color: "text-safety-high",
  },
  {
    icon: MessageSquare,
    title: "Community Feedback",
    description: "Anonymous user feedback improves safety scoring over time.",
    color: "text-primary",
  },
];

export function FeaturesSection() {
  return (
    <section className="py-24 relative">
      <div className="absolute inset-0 bg-gradient-dark" />
      
      <div className="container mx-auto px-4 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            How <span className="text-gradient-primary">SafeRoute</span> Works
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Our multi-layer safety analysis ensures you travel the safest path possible.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: index * 0.1 }}
            >
              <Card variant="gradient" className="h-full hover:border-primary/30 transition-colors">
                <CardContent className="p-6">
                  <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-4">
                    <feature.icon className={`w-6 h-6 ${feature.color}`} />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground text-sm">{feature.description}</p>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
