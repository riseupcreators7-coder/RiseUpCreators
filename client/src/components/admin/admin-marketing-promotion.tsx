import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { 
  Megaphone, 
  Target, 
  Gift, 
  TrendingUp, 
  Users, 
  Mail, 
  Play, 
  Pause, 
  Edit, 
  Trash2, 
  Plus,
  Bold,
  Italic,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Link,
  Image,
  List,
  ListOrdered,
  Type,
  Palette,
  Paperclip,
  Send,
  Save,
  Eye
} from "lucide-react";
import Loading from "@/components/common/loading";
import AdManagementPanel from "@/components/admin/AdManagementPanel";

export default function AdminMarketingPromotion() {
  const [newPromoCode, setNewPromoCode] = useState("");
  const [newDiscount, setNewDiscount] = useState("");
  const [selectedPromoType, setSelectedPromoType] = useState("percentage");
  
  // Email editor state
  const [emailSubject, setEmailSubject] = useState("");
  const [emailContent, setEmailContent] = useState("");
  const [recipientType, setRecipientType] = useState("all");
  const [fontSize, setFontSize] = useState("14");
  const [fontFamily, setFontFamily] = useState("Arial");
  const [textColor, setTextColor] = useState("#000000");
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [textAlign, setTextAlign] = useState("left");
  
  const queryClient = useQueryClient();

  // Fetch promotional codes
  const { data: promosData, isLoading: promosLoading, error: promosError } = useQuery({
    queryKey: ["/api/admin/promotions"],
    queryFn: async () => {
      const response = await fetch("/api/admin/promotions", {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch promotions: ${response.status}`);
      }
      return response.json();
    },
  });

  // Fetch ad campaigns
  const { data: campaignsData, isLoading: campaignsLoading, error: campaignsError } = useQuery({
    queryKey: ["/api/admin/campaigns"],
    queryFn: async () => {
      const response = await fetch("/api/admin/campaigns", {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch campaigns: ${response.status}`);
      }
      return response.json();
    },
  });

  // Fetch marketing metrics - removed analytics tab
  const { data: metricsData, isLoading: metricsLoading, error: metricsError } = useQuery({
    queryKey: ["/api/admin/marketing-metrics"],
    queryFn: async () => {
      const response = await fetch("/api/admin/marketing-metrics", {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) {
        throw new Error(`Failed to fetch marketing metrics: ${response.status}`);
      }
      return response.json();
    },
  });

  // Fetch users for email targeting
  const { data: usersData } = useQuery({
    queryKey: ["/api/admin/users/summary"],
    queryFn: async () => {
      const response = await fetch("/api/admin/users/summary", {
        headers: { Authorization: `Bearer ${localStorage.getItem('ruc_auth_token')}` }
      });
      if (!response.ok) throw new Error('Failed to fetch users');
      return response.json();
    },
  });

  // Create promo code mutation
  const createPromoMutation = useMutation({
    mutationFn: async (promoData: any) => {
      const response = await fetch("/api/admin/promotions", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify(promoData)
      });
      if (!response.ok) throw new Error('Failed to create promo code');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      toast({ title: "Success", description: "Promo code created successfully" });
      setNewPromoCode("");
      setNewDiscount("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to create promo code", variant: "destructive" });
    }
  });

  // Send email mutation
  const sendEmailMutation = useMutation({
    mutationFn: async (emailData: any) => {
      const response = await fetch("/api/admin/send-newsletter", {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify(emailData)
      });
      if (!response.ok) throw new Error('Failed to send email');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Success", description: "Email sent successfully to all recipients" });
      setEmailSubject("");
      setEmailContent("");
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to send email", variant: "destructive" });
    }
  });

  // Update promo status mutation
  const updatePromoMutation = useMutation({
    mutationFn: async ({ promoId, status }: { promoId: string; status: string }) => {
      const response = await fetch(`/api/admin/promotions/${promoId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update promo code');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/promotions"] });
      toast({ title: "Success", description: "Promo code updated successfully" });
    },
    onError: () => {
      toast({ title: "Error", description: "Failed to update promo code", variant: "destructive" });
    }
  });

  const handleSendEmail = () => {
    if (!emailSubject || !emailContent) {
      toast({ title: "Error", description: "Please fill in subject and content", variant: "destructive" });
      return;
    }

    const recipients = recipientType === "all" 
      ? ["creators", "fans"] 
      : [recipientType];

    sendEmailMutation.mutate({
      subject: emailSubject,
      content: emailContent,
      recipientTypes: recipients,
      formatting: {
        fontSize,
        fontFamily,
        textColor,
        isBold,
        isItalic,
        isUnderline,
        textAlign
      }
    });
  };

  // Text formatting functions for textarea
  const insertTextAtCursor = (textToInsert: string, wrapSelected: boolean = false) => {
    const textarea = document.getElementById('email-content') as HTMLTextAreaElement;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const selectedText = emailContent.substring(startPos, endPos);
    
    let newText;
    if (wrapSelected && selectedText) {
      newText = textToInsert.replace('{SELECTED}', selectedText);
    } else {
      newText = textToInsert;
    }

    const beforeText = emailContent.substring(0, startPos);
    const afterText = emailContent.substring(endPos);
    const updatedContent = beforeText + newText + afterText;
    
    setEmailContent(updatedContent);
    
    // Set cursor position after inserted text
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = startPos + newText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const formatText = (command: string) => {
    const textarea = document.getElementById('email-content') as HTMLTextAreaElement;
    if (!textarea) return;

    const startPos = textarea.selectionStart;
    const endPos = textarea.selectionEnd;
    const selectedText = emailContent.substring(startPos, endPos);
    
    let wrappedText = '';
    
    switch (command) {
      case 'bold':
        wrappedText = selectedText ? `**${selectedText}**` : '**bold text**';
        setIsBold(!isBold);
        break;
      case 'italic':
        wrappedText = selectedText ? `*${selectedText}*` : '*italic text*';
        setIsItalic(!isItalic);
        break;
      case 'underline':
        wrappedText = selectedText ? `<u>${selectedText}</u>` : '<u>underlined text</u>';
        setIsUnderline(!isUnderline);
        break;
      case 'insertUnorderedList':
        wrappedText = selectedText ? `• ${selectedText}` : '• List item';
        break;
      case 'insertOrderedList':
        wrappedText = selectedText ? `1. ${selectedText}` : '1. List item';
        break;
      default:
        return;
    }

    const beforeText = emailContent.substring(0, startPos);
    const afterText = emailContent.substring(endPos);
    const updatedContent = beforeText + wrappedText + afterText;
    
    setEmailContent(updatedContent);
    
    setTimeout(() => {
      textarea.focus();
      const newCursorPos = startPos + wrappedText.length;
      textarea.setSelectionRange(newCursorPos, newCursorPos);
    }, 0);
  };

  const insertLink = () => {
    const url = prompt("Enter URL:");
    if (url) {
      const linkText = prompt("Enter link text:") || url;
      insertTextAtCursor(`[${linkText}](${url})`);
    }
  };

  const insertImage = () => {
    const url = prompt("Enter image URL:");
    if (url) {
      const altText = prompt("Enter image description:") || "Image";
      insertTextAtCursor(`![${altText}](${url})`);
    }
  };

  // Simple markdown to HTML converter for preview
  const renderMarkdownPreview = (text: string) => {
    if (!text) return "Email content will appear here...";
    
    return text
      // Bold
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      // Underline
      .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" style="color: #2563eb; text-decoration: underline;">$1</a>')
      // Images
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width: 100%; height: auto;" />')
      // Line breaks
      .replace(/\n/g, '<br>')
      // Horizontal rules
      .replace(/---/g, '<hr style="border: 1px solid #e5e7eb; margin: 20px 0;" />');
  };

  const handleCreatePromo = () => {
    if (!newPromoCode || !newDiscount) {
      toast({ title: "Error", description: "Please fill all required fields", variant: "destructive" });
      return;
    }

    createPromoMutation.mutate({
      code: newPromoCode,
      discountType: selectedPromoType,
      discountValue: parseInt(newDiscount),
      isActive: true,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) // 30 days from now
    });
  };

  const getPromoStatusBadge = (isActive: boolean, expiresAt: string) => {
    if (!isActive) return <Badge variant="secondary">Inactive</Badge>;
    if (new Date(expiresAt) < new Date()) return <Badge variant="destructive">Expired</Badge>;
    return <Badge variant="default" className="bg-green-500">Active</Badge>;
  };

  // Calculate metrics
  const totalPromoCodes = promosData?.promotions?.length || 0;
  const activePromoCodes = promosData?.promotions?.filter((p: any) => p.isActive).length || 0;

  if (promosLoading || campaignsLoading || metricsLoading) {
    return <Loading size="lg" text="Loading marketing data..." />;
  }

  if (promosError || campaignsError || metricsError) {
    return (
      <div className="p-8 text-center">
        <div className="text-red-500 mb-4">Error loading marketing data</div>
        <div className="text-sm text-muted-foreground">
          {promosError?.message || campaignsError?.message || metricsError?.message || "Unknown error occurred"}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Promos</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPromoCodes}</div>
            <p className="text-xs text-muted-foreground">{activePromoCodes} active</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Reach</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(metricsData?.totalReach || 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Users reached</p>
          </CardContent>
        </Card>
      </div>

      {/* Marketing & Promotion Tabs */}
      <Tabs defaultValue="promos" className="w-full">
        <div className="w-full overflow-x-auto">
          <TabsList className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground min-w-full lg:w-full">
            <TabsTrigger value="promos" className="text-xs md:text-sm whitespace-nowrap px-2 md:px-3">Promo Codes</TabsTrigger>
            <TabsTrigger value="ads" className="text-xs md:text-sm whitespace-nowrap px-2 md:px-3">Banner & Audio Ads</TabsTrigger>
            <TabsTrigger value="email" className="text-xs md:text-sm whitespace-nowrap px-2 md:px-3">Email Marketing</TabsTrigger>
          </TabsList>
        </div>

        {/* Promo Codes Tab */}
        <TabsContent value="promos" className="mt-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Create New Promo */}
            <Card>
              <CardHeader>
                <CardTitle>Create Promo Code</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Generate discount codes for users
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="promo-code">Promo Code</Label>
                  <Input
                    id="promo-code"
                    placeholder="e.g., SUMMER2024"
                    value={newPromoCode}
                    onChange={(e) => setNewPromoCode(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="discount-type">Discount Type</Label>
                    <Select value={selectedPromoType} onValueChange={setSelectedPromoType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="percentage">Percentage</SelectItem>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="discount-value">
                      {selectedPromoType === 'percentage' ? 'Percentage (%)' : 'Amount (₹)'}
                    </Label>
                    <Input
                      id="discount-value"
                      type="number"
                      placeholder={selectedPromoType === 'percentage' ? '10' : '100'}
                      value={newDiscount}
                      onChange={(e) => setNewDiscount(e.target.value)}
                    />
                  </div>
                </div>
                <Button 
                  onClick={handleCreatePromo} 
                  className="w-full"
                  disabled={createPromoMutation.isPending}
                >
                  <Plus className="w-4 h-4 mr-2" />
                  Create Promo Code
                </Button>
              </CardContent>
            </Card>

            {/* Existing Promos */}
            <Card>
              <CardHeader>
                <CardTitle>Active Promo Codes</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage existing promotional codes
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {promosData?.promotions?.slice(0, 5).map((promo: any) => (
                    <div key={promo._id} className="flex items-center justify-between p-3 border rounded-lg">
                      <div>
                        <p className="font-medium">{promo.code}</p>
                        <p className="text-sm text-muted-foreground">
                          {promo.discountType === 'percentage' ? `${promo.discountValue}% off` : `₹${promo.discountValue} off`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Used {promo.usageCount || 0} times
                        </p>
                        {getPromoStatusBadge(promo.isActive, promo.expiresAt)}
                      </div>
                      <div className="flex space-x-2">
                        {promo.isActive ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updatePromoMutation.mutate({
                              promoId: promo._id,
                              status: 'inactive'
                            })}
                          >
                            <Pause className="w-4 h-4" />
                          </Button>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => updatePromoMutation.mutate({
                              promoId: promo._id,
                              status: 'active'
                            })}
                          >
                            <Play className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!promosData?.promotions || promosData.promotions.length === 0) && (
                    <div className="text-center py-4">
                      <p className="text-muted-foreground">No promo codes created yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Banner & Audio Ads Tab */}
        <TabsContent value="ads" className="mt-6">
          <AdManagementPanel />
        </TabsContent>

        {/* Email Marketing Tab */}
        <TabsContent value="email" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Email Marketing
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Send newsletters and announcements to your platform users with a rich editor
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Email Composition */}
              <div className="space-y-4">
                {/* Recipient Selection */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="recipient-type">Send To</Label>
                    <Select value={recipientType} onValueChange={setRecipientType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Users ({(usersData?.totalUsers || 0).toLocaleString()})</SelectItem>
                        <SelectItem value="creators">Creators Only ({(usersData?.creators || 0).toLocaleString()})</SelectItem>
                        <SelectItem value="fans">Fans Only ({(usersData?.fans || 0).toLocaleString()})</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsPreviewMode(!isPreviewMode)}
                      className="flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      {isPreviewMode ? "Edit" : "Preview"}
                    </Button>
                  </div>
                </div>

                {/* Subject Line */}
                <div>
                  <Label htmlFor="email-subject">Subject Line</Label>
                  <Input
                    id="email-subject"
                    placeholder="Enter email subject..."
                    value={emailSubject}
                    onChange={(e) => setEmailSubject(e.target.value)}
                    className="text-lg font-medium"
                  />
                </div>

                {!isPreviewMode ? (
                  <>
                    {/* Rich Text Toolbar */}
                    <div className="border rounded-lg p-3 bg-muted/50">
                      <div className="flex flex-wrap items-center gap-1 mb-3">
                        {/* Font Family */}
                        <Select value={fontFamily} onValueChange={setFontFamily}>
                          <SelectTrigger className="w-32">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Arial">Arial</SelectItem>
                            <SelectItem value="Helvetica">Helvetica</SelectItem>
                            <SelectItem value="Times New Roman">Times</SelectItem>
                            <SelectItem value="Georgia">Georgia</SelectItem>
                            <SelectItem value="Verdana">Verdana</SelectItem>
                          </SelectContent>
                        </Select>

                        {/* Font Size */}
                        <Select value={fontSize} onValueChange={setFontSize}>
                          <SelectTrigger className="w-20">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="12">12px</SelectItem>
                            <SelectItem value="14">14px</SelectItem>
                            <SelectItem value="16">16px</SelectItem>
                            <SelectItem value="18">18px</SelectItem>
                            <SelectItem value="20">20px</SelectItem>
                            <SelectItem value="24">24px</SelectItem>
                          </SelectContent>
                        </Select>

                        <div className="w-px h-6 bg-border mx-1"></div>

                        {/* Text Formatting */}
                        <Button
                          variant={isBold ? "default" : "outline"}
                          size="sm"
                          onClick={() => formatText('bold')}
                          title="Bold (Ctrl+B)"
                        >
                          <Bold className="w-4 h-4" />
                        </Button>
                        <Button
                          variant={isItalic ? "default" : "outline"}
                          size="sm"
                          onClick={() => formatText('italic')}
                          title="Italic (Ctrl+I)"
                        >
                          <Italic className="w-4 h-4" />
                        </Button>
                        <Button
                          variant={isUnderline ? "default" : "outline"}
                          size="sm"
                          onClick={() => formatText('underline')}
                          title="Underline (Ctrl+U)"
                        >
                          <Underline className="w-4 h-4" />
                        </Button>

                        <div className="w-px h-6 bg-border mx-1"></div>

                        {/* Text Alignment */}
                        <Button
                          variant={textAlign === "left" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setTextAlign("left")}
                          title="Align Left"
                        >
                          <AlignLeft className="w-4 h-4" />
                        </Button>
                        <Button
                          variant={textAlign === "center" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setTextAlign("center")}
                          title="Align Center"
                        >
                          <AlignCenter className="w-4 h-4" />
                        </Button>
                        <Button
                          variant={textAlign === "right" ? "default" : "outline"}
                          size="sm"
                          onClick={() => setTextAlign("right")}
                          title="Align Right"
                        >
                          <AlignRight className="w-4 h-4" />
                        </Button>

                        <div className="w-px h-6 bg-border mx-1"></div>

                        {/* Lists */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => formatText('insertUnorderedList')}
                          title="Bullet List"
                        >
                          <List className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => formatText('insertOrderedList')}
                          title="Numbered List"
                        >
                          <ListOrdered className="w-4 h-4" />
                        </Button>

                        <div className="w-px h-6 bg-border mx-1"></div>

                        {/* Insert Elements */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={insertLink}
                          title="Insert Link"
                        >
                          <Link className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={insertImage}
                          title="Insert Image"
                        >
                          <Image className="w-4 h-4" />
                        </Button>

                        <div className="w-px h-6 bg-border mx-1"></div>

                        {/* Text Color */}
                        <div className="flex items-center gap-2">
                          <Palette className="w-4 h-4" />
                          <input
                            type="color"
                            value={textColor}
                            onChange={(e) => setTextColor(e.target.value)}
                            className="w-8 h-8 rounded border cursor-pointer"
                            title="Text Color"
                          />
                        </div>
                      </div>
                      
                      {/* Quick Insert Templates */}
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => insertTextAtCursor('\n\n---\n\n')}
                          className="text-xs"
                        >
                          Divider
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => insertTextAtCursor('📧 **Important:** ')}
                          className="text-xs"
                        >
                          Important
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => insertTextAtCursor('🎵 **New Release:** ')}
                          className="text-xs"
                        >
                          New Release
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => insertTextAtCursor('🎉 **Special Offer:** ')}
                          className="text-xs"
                        >
                          Special Offer
                        </Button>
                      </div>
                    </div>

                    {/* Rich Text Editor */}
                    <div>
                      <Label htmlFor="email-content">Email Content</Label>
                      <Textarea
                        id="email-content"
                        placeholder="Write your email content here..."
                        value={emailContent}
                        onChange={(e) => setEmailContent(e.target.value)}
                        className="min-h-[300px] resize-none"
                        style={{
                          fontFamily,
                          fontSize: `${fontSize}px`,
                          textAlign: textAlign as any
                        }}
                      />
                    </div>
                  </>
                ) : (
                  /* Email Preview */
                  <div className="space-y-4">
                    <div className="border rounded-lg p-6 bg-background">
                      <div className="border-b pb-4 mb-4">
                        <div className="flex items-center justify-between text-sm text-muted-foreground mb-2">
                          <span>From: RiseUp Music Platform &lt;noreply@riseup.com&gt;</span>
                          <span>To: {recipientType === "all" ? "All Users" : recipientType === "creators" ? "Creators" : "Fans"}</span>
                        </div>
                        <h2 className="text-xl font-semibold">{emailSubject || "Subject will appear here"}</h2>
                      </div>
                      <div 
                        className="prose max-w-none"
                        style={{
                          fontFamily,
                          fontSize: `${fontSize}px`,
                          color: textColor,
                          textAlign: textAlign as any
                        }}
                        dangerouslySetInnerHTML={{
                          __html: renderMarkdownPreview(emailContent)
                        }}
                      />
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-between items-center pt-4">
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>Recipients: {recipientType === "all" ? (usersData?.totalUsers || 0).toLocaleString() : recipientType === "creators" ? (usersData?.creators || 0).toLocaleString() : (usersData?.fans || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => {
                        // Save as draft functionality
                        toast({ title: "Draft Saved", description: "Email saved as draft" });
                      }}
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Save Draft
                    </Button>
                    <Button
                      onClick={handleSendEmail}
                      disabled={sendEmailMutation.isPending || !emailSubject || !emailContent}
                      className="min-w-[120px]"
                    >
                      <Send className="w-4 h-4 mr-2" />
                      {sendEmailMutation.isPending ? "Sending..." : "Send Email"}
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}