
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Calendar, User, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import Loading from "@/components/common/loading";
import { toast } from "@/hooks/use-toast";

export default function BlogDetails() {
  const { id } = useParams();
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const { data: blog, isLoading, error } = useQuery({
    queryKey: [`/api/blogs/${id}`],
    queryFn: async () => {
      const response = await fetch(`/api/blogs/${id}`, {
        headers: user ? {
          'Authorization': `Bearer ${localStorage.getItem('ruc_auth_token')}`
        } : {}
      });
      
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("Blog post not found");
        }
        if (response.status === 403) {
          throw new Error("This blog post is for subscribers only");
        }
        throw new Error("Failed to load blog post");
      }
      
      return response.json();
    },
    enabled: !!id,
    retry: 1,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen pt-16">
        <Loading size="lg" text="Loading blog post..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen pt-16">
        <div className="container-custom py-8">
          <Card className="text-center py-12">
            <CardContent>
              <h1 className="text-2xl font-bold mb-4">Blog Not Found</h1>
              <p className="text-muted-foreground mb-6">
                {error.message || "The blog post you're looking for doesn't exist or you don't have access to it."}
              </p>
              <Button onClick={() => setLocation("/discover")}>
                Back to Discover
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!blog) {
    return null;
  }

  const formatContent = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^### (.*$)/gm, '<h3 class="text-xl font-semibold mt-6 mb-3">$1</h3>')
      .replace(/^## (.*$)/gm, '<h2 class="text-2xl font-bold mt-8 mb-4">$1</h2>')
      .replace(/^# (.*$)/gm, '<h1 class="text-3xl font-bold mt-8 mb-6">$1</h1>')
      .replace(/\n\n/g, '</p><p class="mb-4">')
      .replace(/\n/g, '<br>');
  };

  return (
    <div className="min-h-screen pt-16 pb-24">
      <div className="container-custom py-8">
        {/* Header */}
        <div className="mb-8">
          <Button
            variant="ghost"
            onClick={() => window.history.back()}
            className="mb-4"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              {blog.visibility === "SUBSCRIBER_ONLY" && (
                <Badge variant="secondary">Subscribers Only</Badge>
              )}
              {blog.tags && blog.tags.length > 0 && (
                <div className="flex items-center space-x-1">
                  <Tag className="w-4 h-4" />
                  {blog.tags.slice(0, 3).map((tag: string) => (
                    <Badge key={tag} variant="outline" className="text-xs">
                      {tag}
                    </Badge>
                  ))}
                </div>
              )}
            </div>
            
            <h1 className="text-4xl font-bold">{blog.title}</h1>
            
            <div className="flex items-center space-x-6 text-muted-foreground">
              <div className="flex items-center space-x-2">
                <User className="w-4 h-4" />
                <span>{blog.artistName || "Artist"}</span>
              </div>
              <div className="flex items-center space-x-2">
                <Calendar className="w-4 h-4" />
                <span>
                  {new Date(blog.createdAt).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Featured Image */}
        {blog.images && blog.images.length > 0 && (
          <div className="mb-8">
            <img
              src={blog.images[0]}
              alt={blog.title}
              className="w-full h-96 object-cover rounded-lg"
            />
          </div>
        )}

        {/* Content */}
        <Card>
          <CardContent className="p-8">
            <div
              className="prose prose-lg max-w-none"
              dangerouslySetInnerHTML={{
                __html: `<p class="mb-4">${formatContent(blog.content)}</p>`
              }}
            />
          </CardContent>
        </Card>

        {/* Additional Images */}
        {blog.images && blog.images.length > 1 && (
          <div className="mt-8">
            <h3 className="text-xl font-semibold mb-4">Gallery</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {blog.images.slice(1).map((image: string, index: number) => (
                <img
                  key={index}
                  src={image}
                  alt={`Gallery image ${index + 1}`}
                  className="w-full h-48 object-cover rounded-lg"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
