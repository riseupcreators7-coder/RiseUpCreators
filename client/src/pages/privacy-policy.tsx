import { Card, CardContent } from "@/components/ui/card";
import { Shield } from "lucide-react";

export default function PrivacyPolicyPage() {
  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container mx-auto px-4 md:px-6 lg:px-8 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="flex justify-center mb-4">
            <Shield className="w-16 h-16 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Privacy Policy</h1>
          <p className="text-muted-foreground">
            Last updated: {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
          </p>
        </div>

        <Card>
          <CardContent className="prose prose-sm md:prose-base max-w-none p-6 md:p-8">
            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">1. Introduction</h2>
              <p className="text-muted-foreground mb-4">
                Welcome to Rise Up Creators ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform.
              </p>
              <p className="text-muted-foreground">
                By using Rise Up Creators, you agree to the collection and use of information in accordance with this policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">2. Information We Collect</h2>
              
              <h3 className="text-xl font-semibold mb-3">2.1 Personal Information</h3>
              <p className="text-muted-foreground mb-4">
                We collect personal information that you voluntarily provide to us when you:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>Register for an account</li>
                <li>Make purchases or transactions</li>
                <li>Connect your social media accounts (YouTube, Facebook, Instagram)</li>
                <li>Participate in NFT marketplace activities</li>
                <li>Subscribe to artist content</li>
                <li>Contact us for support</li>
              </ul>
              <p className="text-muted-foreground mb-4">
                This information may include: name, email address, username, payment information, wallet addresses, and social media profile data.
              </p>

              <h3 className="text-xl font-semibold mb-3">2.2 Automatically Collected Information</h3>
              <p className="text-muted-foreground mb-4">
                When you use our platform, we automatically collect certain information, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>Device information (IP address, browser type, operating system)</li>
                <li>Usage data (pages visited, time spent, features used)</li>
                <li>Cookies and similar tracking technologies</li>
                <li>Analytics data to improve our services</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3">2.3 Third-Party Data</h3>
              <p className="text-muted-foreground mb-4">
                When you connect third-party services (YouTube, Facebook, Instagram), we collect data from these platforms in accordance with their terms and your permissions, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>Public profile information</li>
                <li>Content analytics and insights</li>
                <li>Follower/subscriber counts</li>
                <li>Engagement metrics</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">3. How We Use Your Information</h2>
              <p className="text-muted-foreground mb-4">
                We use the collected information for various purposes:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>To provide, maintain, and improve our services</li>
                <li>To process transactions and manage your account</li>
                <li>To facilitate NFT marketplace operations, auctions, and crowdfunding</li>
                <li>To enable artist-fan interactions and subscriptions</li>
                <li>To display social media content and analytics</li>
                <li>To send administrative information and updates</li>
                <li>To respond to your inquiries and provide customer support</li>
                <li>To detect, prevent, and address technical issues or fraud</li>
                <li>To comply with legal obligations</li>
                <li>To improve user experience through analytics</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">4. Information Sharing and Disclosure</h2>
              <p className="text-muted-foreground mb-4">
                We may share your information in the following situations:
              </p>
              
              <h3 className="text-xl font-semibold mb-3">4.1 With Your Consent</h3>
              <p className="text-muted-foreground mb-4">
                We share your information when you explicitly consent to such sharing.
              </p>

              <h3 className="text-xl font-semibold mb-3">4.2 Service Providers</h3>
              <p className="text-muted-foreground mb-4">
                We work with third-party service providers who perform services on our behalf:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>Payment processors (Razorpay)</li>
                <li>Cloud storage providers (Cloudinary, IPFS/Pinata)</li>
                <li>Email service providers</li>
                <li>Analytics providers</li>
                <li>Blockchain infrastructure providers</li>
              </ul>

              <h3 className="text-xl font-semibold mb-3">4.3 Social Media Platforms</h3>
              <p className="text-muted-foreground mb-4">
                When you connect your YouTube, Facebook, or Instagram accounts, we access and display your content according to the permissions you grant. We comply with Meta Platform Policies and YouTube API Services Terms.
              </p>

              <h3 className="text-xl font-semibold mb-3">4.4 Legal Requirements</h3>
              <p className="text-muted-foreground mb-4">
                We may disclose your information if required by law or in response to valid requests by public authorities.
              </p>

              <h3 className="text-xl font-semibold mb-3">4.5 Business Transfers</h3>
              <p className="text-muted-foreground mb-4">
                In connection with any merger, sale of company assets, financing, or acquisition, your information may be transferred.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">5. Data Security</h2>
              <p className="text-muted-foreground mb-4">
                We implement appropriate technical and organizational security measures to protect your personal information, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>Encryption of data in transit and at rest</li>
                <li>Secure authentication mechanisms</li>
                <li>Regular security assessments</li>
                <li>Access controls and monitoring</li>
                <li>Blockchain technology for NFT transactions</li>
              </ul>
              <p className="text-muted-foreground">
                However, no method of transmission over the Internet is 100% secure. While we strive to protect your information, we cannot guarantee absolute security.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">6. Your Privacy Rights</h2>
              <p className="text-muted-foreground mb-4">
                Depending on your location, you may have the following rights:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li><strong>Access:</strong> Request access to your personal information</li>
                <li><strong>Correction:</strong> Request correction of inaccurate data</li>
                <li><strong>Deletion:</strong> Request deletion of your personal information</li>
                <li><strong>Portability:</strong> Request transfer of your data</li>
                <li><strong>Objection:</strong> Object to processing of your information</li>
                <li><strong>Restriction:</strong> Request restriction of processing</li>
                <li><strong>Withdraw Consent:</strong> Withdraw consent at any time</li>
              </ul>
              <p className="text-muted-foreground">
                To exercise these rights, please contact us at privacy@riseupcreators.com
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">7. Third-Party Services</h2>
              
              <h3 className="text-xl font-semibold mb-3">7.1 YouTube API Services</h3>
              <p className="text-muted-foreground mb-4">
                Our use of information received from YouTube APIs will adhere to the{" "}
                <a href="https://developers.google.com/youtube/terms/api-services-terms-of-service" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  YouTube API Services Terms of Service
                </a>
                . You can revoke our access to your YouTube data via the{" "}
                <a href="https://security.google.com/settings/security/permissions" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Google security settings page
                </a>
                .
              </p>

              <h3 className="text-xl font-semibold mb-3">7.2 Meta Platform (Facebook & Instagram)</h3>
              <p className="text-muted-foreground mb-4">
                We comply with{" "}
                <a href="https://developers.facebook.com/terms" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Meta Platform Policies
                </a>
                . You can manage your connected apps and revoke permissions through your Facebook and Instagram settings.
              </p>

              <h3 className="text-xl font-semibold mb-3">7.3 Blockchain and NFTs</h3>
              <p className="text-muted-foreground mb-4">
                NFT transactions are recorded on public blockchains. Once recorded, this information cannot be deleted or modified. Wallet addresses and transaction history are publicly visible.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">8. Cookies and Tracking</h2>
              <p className="text-muted-foreground mb-4">
                We use cookies and similar tracking technologies to:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground mb-4 space-y-2">
                <li>Maintain your session and preferences</li>
                <li>Analyze usage patterns and improve our services</li>
                <li>Provide personalized content</li>
                <li>Measure advertising effectiveness</li>
              </ul>
              <p className="text-muted-foreground">
                You can control cookies through your browser settings. However, disabling cookies may limit your ability to use certain features.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">9. Children's Privacy</h2>
              <p className="text-muted-foreground">
                Our services are not intended for individuals under the age of 13 (or 16 in the EU). We do not knowingly collect personal information from children. If you believe we have collected information from a child, please contact us immediately.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">10. International Data Transfers</h2>
              <p className="text-muted-foreground">
                Your information may be transferred to and processed in countries other than your country of residence. We ensure appropriate safeguards are in place to protect your information in accordance with this Privacy Policy.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">11. Data Retention</h2>
              <p className="text-muted-foreground">
                We retain your personal information only for as long as necessary to fulfill the purposes outlined in this Privacy Policy, unless a longer retention period is required by law. When you delete your account, we will delete or anonymize your information, except where we are required to retain it for legal purposes.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">12. Changes to This Privacy Policy</h2>
              <p className="text-muted-foreground">
                We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last updated" date. We encourage you to review this Privacy Policy periodically.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-bold mb-4">13. Contact Us</h2>
              <p className="text-muted-foreground mb-4">
                If you have any questions about this Privacy Policy or our privacy practices, please contact us:
              </p>
              <div className="bg-muted p-4 rounded-lg">
                <p className="text-muted-foreground mb-2">
                  <strong>Email:</strong> privacy@riseupcreators.com
                </p>
                <p className="text-muted-foreground mb-2">
                  <strong>Support:</strong> support@riseupcreators.com
                </p>
                <p className="text-muted-foreground">
                  <strong>Address:</strong> Rise Up Creators, [Your Business Address]
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-bold mb-4">14. Compliance</h2>
              <p className="text-muted-foreground mb-4">
                We comply with applicable data protection laws, including:
              </p>
              <ul className="list-disc pl-6 text-muted-foreground space-y-2">
                <li>General Data Protection Regulation (GDPR) for EU users</li>
                <li>California Consumer Privacy Act (CCPA) for California residents</li>
                <li>YouTube API Services Terms of Service</li>
                <li>Meta Platform Policies</li>
                <li>Other applicable privacy regulations</li>
              </ul>
            </section>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
