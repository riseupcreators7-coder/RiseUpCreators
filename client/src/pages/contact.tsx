import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Mail, Phone, Clock, MessageSquare, Send, Copy, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ContactInfo {
  supportEmail: string;
  supportPhone: string;
  customerServiceHours: string;
  whatsappNumber: string;
  telegramUsername: string;
}

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: ""
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedText, setCopiedText] = useState("");
  const { toast } = useToast();

  // Fetch contact information
  const { data: contactInfo, isLoading } = useQuery<ContactInfo>({
    queryKey: ["/api/contact-info"],
    queryFn: async () => {
      const response = await fetch("/api/contact-info");
      if (!response.ok) {
        throw new Error("Failed to fetch contact information");
      }
      return response.json();
    },
  });

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      // You can implement this endpoint to send emails or store contact requests
      const response = await fetch("/api/contact/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (response.ok) {
        toast({
          title: "Message sent successfully!",
          description: "We'll get back to you as soon as possible.",
        });
        setFormData({ name: "", email: "", subject: "", message: "" });
      } else {
        throw new Error("Failed to send message");
      }
    } catch (error) {
      toast({
        title: "Failed to send message",
        description: "Please try again or contact us directly via phone/email.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopiedText(text);
    toast({
      title: "Copied to clipboard!",
      description: `${label} copied to clipboard.`,
    });
    setTimeout(() => setCopiedText(""), 2000);
  };

  const openWhatsApp = (number: string) => {
    if (number) {
      window.open(`https://wa.me/${number.replace(/[^0-9]/g, "")}`, "_blank");
    }
  };

  const openTelegram = (username: string) => {
    if (username) {
      window.open(`https://t.me/${username.replace("@", "")}`, "_blank");
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen pt-24 pb-12">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto">
            <div className="animate-pulse">
              <div className="h-8 bg-muted rounded mb-4"></div>
              <div className="h-4 bg-muted rounded mb-8"></div>
              <div className="grid lg:grid-cols-2 gap-8">
                <div className="h-96 bg-muted rounded"></div>
                <div className="space-y-4">
                  <div className="h-24 bg-muted rounded"></div>
                  <div className="h-24 bg-muted rounded"></div>
                  <div className="h-24 bg-muted rounded"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-24 pb-12 bg-gradient-to-br from-background via-background/80 to-primary/5">
      <div className="container mx-auto px-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 gradient-text">
              Contact Us
            </h1>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Need help? We're here for you! Reach out to our support team and we'll get back to you as soon as possible.
            </p>
          </div>

          <div className="grid lg:grid-cols-2 gap-8">
            {/* Contact Form */}
            <Card className="glass-effect border-border">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Send className="w-5 h-5" />
                  Send us a Message
                </CardTitle>
                <CardDescription>
                  Fill out the form below and we'll respond within 24 hours.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        name="name"
                        value={formData.name}
                        onChange={handleInputChange}
                        required
                        placeholder="Your full name"
                        className="mt-1"
                      />
                    </div>
                    <div>
                      <Label htmlFor="email">Email</Label>
                      <Input
                        id="email"
                        name="email"
                        type="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        required
                        placeholder="your.email@example.com"
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="subject">Subject</Label>
                    <Input
                      id="subject"
                      name="subject"
                      value={formData.subject}
                      onChange={handleInputChange}
                      required
                      placeholder="What's this about?"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="message">Message</Label>
                    <Textarea
                      id="message"
                      name="message"
                      value={formData.message}
                      onChange={handleInputChange}
                      required
                      placeholder="Tell us how we can help you..."
                      rows={5}
                      className="mt-1 resize-none"
                    />
                  </div>
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full gradient-primary"
                  >
                    {isSubmitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Sending...
                      </>
                    ) : (
                      <>
                        <Send className="w-4 h-4 mr-2" />
                        Send Message
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <div className="space-y-6">
              {/* Email Support */}
              <Card className="glass-effect border-border">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Mail className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">Email Support</h3>
                      <p className="text-muted-foreground mb-3">
                        Get help via email for detailed support
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          {contactInfo?.supportEmail}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(contactInfo?.supportEmail || "", "Email")}
                        >
                          {copiedText === contactInfo?.supportEmail ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Phone Support */}
              <Card className="glass-effect border-border">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Phone className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">Phone Support</h3>
                      <p className="text-muted-foreground mb-3">
                        Call us for immediate assistance
                      </p>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-sm bg-muted px-2 py-1 rounded">
                          {contactInfo?.supportPhone}
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyToClipboard(contactInfo?.supportPhone || "", "Phone number")}
                        >
                          {copiedText === contactInfo?.supportPhone ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Service Hours */}
              <Card className="glass-effect border-border">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-primary/10 rounded-lg">
                      <Clock className="w-6 h-6 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-lg mb-1">Support Hours</h3>
                      <p className="text-muted-foreground mb-3">
                        When our support team is available
                      </p>
                      <span className="text-sm bg-muted px-2 py-1 rounded">
                        {contactInfo?.customerServiceHours}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Chat Options */}
              {(contactInfo?.whatsappNumber || contactInfo?.telegramUsername) && (
                <Card className="glass-effect border-border">
                  <CardContent className="p-6">
                    <div className="flex items-start gap-4">
                      <div className="p-3 bg-primary/10 rounded-lg">
                        <MessageSquare className="w-6 h-6 text-primary" />
                      </div>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg mb-1">Quick Chat</h3>
                        <p className="text-muted-foreground mb-3">
                          Message us directly for faster responses
                        </p>
                        <div className="space-y-2">
                          {contactInfo?.whatsappNumber && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openWhatsApp(contactInfo.whatsappNumber)}
                              className="w-full justify-start"
                            >
                              <MessageSquare className="w-4 h-4 mr-2 text-green-600" />
                              WhatsApp: {contactInfo.whatsappNumber}
                            </Button>
                          )}
                          {contactInfo?.telegramUsername && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openTelegram(contactInfo.telegramUsername)}
                              className="w-full justify-start"
                            >
                              <MessageSquare className="w-4 h-4 mr-2 text-blue-600" />
                              Telegram: @{contactInfo.telegramUsername.replace("@", "")}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          {/* FAQ Link */}
          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">
              Before contacting us, you might find your answer in our FAQ section.
            </p>
            <Button variant="outline" asChild>
              <a href="/faq">View Frequently Asked Questions</a>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}