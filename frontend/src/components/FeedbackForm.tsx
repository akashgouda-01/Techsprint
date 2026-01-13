import { useState } from "react";
import { motion } from "framer-motion";
import { Send, Check, Sun, SunDim, Moon, Users, UserCheck, User, ThumbsUp, HelpCircle, ThumbsDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { submitFeedback } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";

interface FeedbackFormProps {
  onClose: () => void;
}

export function FeedbackForm({ onClose }: FeedbackFormProps) {
  const [lighting, setLighting] = useState<"well-lit" | "partial" | "poor" | null>(null);
  const [unsafetyScore, setUnsafetyScore] = useState<number | null>(null);
  const [activity, setActivity] = useState<"busy" | "moderate" | "isolated" | null>(null);
  const [wouldRetake, setWouldRetake] = useState<"yes" | "maybe" | "no" | null>(null);
  const [concern, setConcern] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  const handleSubmit = async () => {
    try {
      await submitFeedback({
        userEmail: user?.email || 'anonymous',
        // Context from form
        context: {
          lighting: lighting,
          activity: activity,
          timestamp: new Date().toISOString()
        },
        // Labels
        safetyRating: unsafetyScore,
        wouldRetake: wouldRetake,
        concern: concern,
        // Meta
        location: { lat: 0, lng: 0 } // Mock location for now
      });

      setSubmitted(true);
      toast({
        title: "Thank you for your feedback!",
        description: "Your data has been sent to our AI to separate safe routes from unsafe ones.",
      });
      setTimeout(onClose, 2000);
    } catch (e) {
      toast({
        title: "Error submitting",
        description: "Could not save feedback. Try again.",
        variant: "destructive"
      });
    }
  };

  const isFormValid = lighting && unsafetyScore && activity && wouldRetake;

  if (submitted) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"
      >
        <Card variant="glow" className="w-full max-w-md">
          <CardContent className="p-8 text-center">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", delay: 0.2 }}
              className="w-16 h-16 rounded-full bg-safety-high/20 flex items-center justify-center mx-auto mb-4"
            >
              <Check className="w-8 h-8 text-safety-high" />
            </motion.div>
            <h3 className="text-xl font-semibold mb-2">Feedback Received</h3>
            <p className="text-muted-foreground">
              Your anonymous feedback helps make routes safer for everyone.
            </p>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 overflow-y-auto"
    >
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg my-8"
      >
        <Card variant="elevated">
          <CardHeader>
            <CardTitle>How was your journey?</CardTitle>
            <CardDescription>
              Your anonymous feedback helps improve safety for everyone
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Question 1: Lighting */}
            <div className="space-y-3">
              <label className="text-sm font-medium">1. Were the roads well-lit?</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setLighting("well-lit")}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${lighting === "well-lit"
                    ? "bg-safety-high/10 border-safety-high text-safety-high"
                    : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Sun className="w-6 h-6" />
                  <span className="text-xs font-medium">Well-lit</span>
                </button>
                <button
                  onClick={() => setLighting("partial")}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${lighting === "partial"
                    ? "bg-safety-medium/10 border-safety-medium text-safety-medium"
                    : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <SunDim className="w-6 h-6" />
                  <span className="text-xs font-medium">Partially lit</span>
                </button>
                <button
                  onClick={() => setLighting("poor")}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${lighting === "poor"
                    ? "bg-safety-low/10 border-safety-low text-safety-low"
                    : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Moon className="w-6 h-6" />
                  <span className="text-xs font-medium">Poorly lit</span>
                </button>
              </div>
            </div>

            {/* Question 2: Unsafety Score */}
            <div className="space-y-3">
              <label className="text-sm font-medium">
                2. On a scale of 1–10, how unsafe did you feel?
                <span className="text-xs text-muted-foreground ml-2">(1 = Very safe, 10 = Very unsafe)</span>
              </label>
              <div className="flex gap-1.5">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((score) => (
                  <button
                    key={score}
                    onClick={() => setUnsafetyScore(score)}
                    className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-all ${unsafetyScore === score
                      ? score <= 3
                        ? "bg-safety-high/20 border-safety-high text-safety-high"
                        : score <= 6
                          ? "bg-safety-medium/20 border-safety-medium text-safety-medium"
                          : "bg-safety-low/20 border-safety-low text-safety-low"
                      : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground hover:border-primary/50"
                      }`}
                  >
                    {score}
                  </button>
                ))}
              </div>
            </div>

            {/* Question 3: Activity Level */}
            <div className="space-y-3">
              <label className="text-sm font-medium">3. How active did the route feel?</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setActivity("busy")}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${activity === "busy"
                    ? "bg-safety-high/10 border-safety-high text-safety-high"
                    : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <Users className="w-6 h-6" />
                  <span className="text-xs font-medium">Busy / Public</span>
                </button>
                <button
                  onClick={() => setActivity("moderate")}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${activity === "moderate"
                    ? "bg-safety-medium/10 border-safety-medium text-safety-medium"
                    : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <UserCheck className="w-6 h-6" />
                  <span className="text-xs font-medium">Moderate</span>
                </button>
                <button
                  onClick={() => setActivity("isolated")}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${activity === "isolated"
                    ? "bg-safety-low/10 border-safety-low text-safety-low"
                    : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <User className="w-6 h-6" />
                  <span className="text-xs font-medium">Isolated</span>
                </button>
              </div>
            </div>

            {/* Question 4: Would Retake */}
            <div className="space-y-3">
              <label className="text-sm font-medium">4. Would you take this route again at the same time?</label>
              <div className="flex gap-3">
                <button
                  onClick={() => setWouldRetake("yes")}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${wouldRetake === "yes"
                    ? "bg-safety-high/10 border-safety-high text-safety-high"
                    : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <ThumbsUp className="w-6 h-6" />
                  <span className="text-xs font-medium">Yes</span>
                </button>
                <button
                  onClick={() => setWouldRetake("maybe")}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${wouldRetake === "maybe"
                    ? "bg-safety-medium/10 border-safety-medium text-safety-medium"
                    : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <HelpCircle className="w-6 h-6" />
                  <span className="text-xs font-medium">Maybe</span>
                </button>
                <button
                  onClick={() => setWouldRetake("no")}
                  className={`flex-1 flex flex-col items-center gap-2 p-3 rounded-xl border transition-all ${wouldRetake === "no"
                    ? "bg-safety-low/10 border-safety-low text-safety-low"
                    : "bg-secondary/50 border-border text-muted-foreground hover:text-foreground"
                    }`}
                >
                  <ThumbsDown className="w-6 h-6" />
                  <span className="text-xs font-medium">No</span>
                </button>
              </div>
            </div>

            {/* Question 5: Optional Concern */}
            <div className="space-y-2">
              <label className="text-sm font-medium">
                5. Any safety concern we should know?
                <span className="text-xs text-muted-foreground ml-2">(Optional)</span>
              </label>
              <Textarea
                placeholder="e.g., Dark alley near the park, stray dogs on main road..."
                value={concern}
                onChange={(e) => setConcern(e.target.value)}
                className="min-h-[80px] bg-secondary/50"
                maxLength={500}
              />
            </div>

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1" onClick={onClose}>
                Skip
              </Button>
              <Button
                variant="hero"
                className="flex-1"
                onClick={handleSubmit}
                disabled={!isFormValid}
              >
                <Send className="w-4 h-4" />
                Submit Feedback
              </Button>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              🔒 Your feedback is completely anonymous
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </motion.div>
  );
}
