import { useQuery } from "@tanstack/react-query";
import { Loader2, FileText, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { portalApi } from "@/api/portal";
import { apiErrorMessage } from "@/lib/api";
import { toast } from "sonner";
import { format } from "date-fns";

export default function PortalDocuments() {
  const { data: documents = [], isLoading } = useQuery({ queryKey: ["portal", "documents"], queryFn: portalApi.documents });

  const onDownload = async (id: string, name: string) => {
    try {
      await portalApi.downloadDocument(id, name);
    } catch (e) {
      toast.error(apiErrorMessage(e, "Could not download file"));
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
        <p className="text-sm text-muted-foreground mt-1">Files shared with you.</p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : documents.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <FileText className="h-8 w-8 mx-auto mb-3 opacity-50" />
            No documents have been shared yet.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {documents.map((d) => (
            <Card key={d.id}>
              <CardContent className="py-4 flex items-center gap-4">
                <FileText className="h-5 w-5 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{d.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {d.uploadedBy?.name && `Uploaded by ${d.uploadedBy.name} · `}
                    {format(new Date(d.createdAt), "MMM d, yyyy")}
                  </div>
                </div>
                <Button size="sm" variant="outline" onClick={() => onDownload(d.id, d.name)}>
                  <Download className="h-3.5 w-3.5 mr-1.5" /> Download
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
