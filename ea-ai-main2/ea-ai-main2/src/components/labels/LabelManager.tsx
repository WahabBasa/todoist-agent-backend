import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Badge } from "../ui/badge";
import { 
  Tag, 
  Plus, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  Star,
  Settings 
} from "lucide-react";
import { toast } from "sonner";

const labelFormSchema = z.object({
  name: z.string().min(1, "Label name is required").max(30, "Label name too long"),
});

type LabelFormData = z.infer<typeof labelFormSchema>;

interface EditingLabel {
  _id: Id<"labels">;
  name: string;
}

export function LabelManager() {
  const [isCreating, setIsCreating] = useState(false);
  const [editingLabel, setEditingLabel] = useState<EditingLabel | null>(null);

  const labels = useQuery(api.labels.getLabels);
  const createLabel = useMutation(api.labels.createLabel);
  const updateLabel = useMutation(api.labels.updateLabel);
  const deleteLabel = useMutation(api.labels.deleteLabel);

  // Form for creating new labels
  const createForm = useForm<LabelFormData>({
    resolver: zodResolver(labelFormSchema),
    defaultValues: { name: "" }
  });

  // Form for editing existing labels
  const editForm = useForm<LabelFormData>({
    resolver: zodResolver(labelFormSchema),
  });

  const handleCreateLabel = async (data: LabelFormData) => {
    try {
      await createLabel(data);
      toast.success("Label created successfully!");
      createForm.reset();
      setIsCreating(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to create label");
    }
  };

  const handleUpdateLabel = async (data: LabelFormData) => {
    if (!editingLabel) return;

    try {
      await updateLabel({
        labelId: editingLabel._id,
        name: data.name,
      });
      toast.success("Label updated successfully!");
      setEditingLabel(null);
      editForm.reset();
    } catch (error: any) {
      toast.error(error.message || "Failed to update label");
    }
  };

  const handleDeleteLabel = async (labelId: Id<"labels">) => {
    if (!confirm("Are you sure you want to delete this label?")) return;

    try {
      await deleteLabel({ labelId });
      toast.success("Label deleted successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to delete label");
    }
  };

  const startEditing = (label: any) => {
    setEditingLabel({ _id: label._id, name: label.name });
    editForm.setValue("name", label.name);
  };

  const cancelEditing = () => {
    setEditingLabel(null);
    editForm.reset();
  };

  const cancelCreating = () => {
    setIsCreating(false);
    createForm.reset();
  };

  // Separate system and user labels
  const systemLabels = labels?.filter(label => label.type === "system") || [];
  const userLabels = labels?.filter(label => label.type === "user") || [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Tag className="w-5 h-5" />
          Label Management
        </CardTitle>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* System Labels Section */}
        {systemLabels.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Settings className="w-4 h-4 text-foreground/60" />
              <h4 className="text-sm font-medium text-foreground/80">System Labels</h4>
              <Badge variant="secondary" className="text-xs">
                {systemLabels.length}
              </Badge>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {systemLabels.map((label) => (
                <div
                  key={label._id}
                  className="flex items-center gap-2 p-2 rounded-lg bg-accent/10 border"
                >
                  <Star className="w-3 h-3 text-amber-500" />
                  <span className="text-sm flex-1 truncate">{label.name}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* User Labels Section */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Tag className="w-4 h-4 text-foreground/60" />
              <h4 className="text-sm font-medium text-foreground/80">Your Labels</h4>
              <Badge variant="secondary" className="text-xs">
                {userLabels.length}
              </Badge>
            </div>
            
            {!isCreating && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsCreating(true)}
                className="gap-2"
              >
                <Plus className="w-3 h-3" />
                Add Label
              </Button>
            )}
          </div>

          {/* Create New Label Form */}
          {isCreating && (
            <form
              onSubmit={createForm.handleSubmit(handleCreateLabel)}
              className="flex items-center gap-2 p-3 bg-accent/5 rounded-lg border mb-3"
            >
              <Tag className="w-4 h-4 text-foreground/60" />
              <Input
                {...createForm.register("name")}
                placeholder="Enter label name..."
                className="flex-1 h-8 text-sm"
                autoFocus
              />
              <Button
                type="submit"
                size="sm"
                disabled={createForm.formState.isSubmitting}
              >
                <Save className="w-3 h-3" />
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={cancelCreating}
              >
                <X className="w-3 h-3" />
              </Button>
            </form>
          )}

          {/* User Labels List */}
          {userLabels.length > 0 ? (
            <div className="space-y-2">
              {userLabels.map((label) => (
                <div
                  key={label._id}
                  className="flex items-center gap-2 p-2 rounded-lg border hover:bg-accent/5 transition-colors"
                >
                  <Tag className="w-4 h-4 text-foreground/60" />
                  
                  {editingLabel?._id === label._id ? (
                    // Edit Mode
                    <form
                      onSubmit={editForm.handleSubmit(handleUpdateLabel)}
                      className="flex items-center gap-2 flex-1"
                    >
                      <Input
                        {...editForm.register("name")}
                        className="flex-1 h-7 text-sm"
                        autoFocus
                      />
                      <Button
                        type="submit"
                        size="sm"
                        disabled={editForm.formState.isSubmitting}
                        className="h-7 px-2"
                      >
                        <Save className="w-3 h-3" />
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={cancelEditing}
                        className="h-7 px-2"
                      >
                        <X className="w-3 h-3" />
                      </Button>
                    </form>
                  ) : (
                    // Display Mode
                    <>
                      <span className="text-sm flex-1 truncate">
                        {label.name}
                      </span>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => startEditing(label)}
                          className="h-7 px-2 hover:bg-accent/50"
                        >
                          <Edit3 className="w-3 h-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleDeleteLabel(label._id)}
                          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          ) : (
            !isCreating && (
              <div className="text-center py-6">
                <Tag className="w-8 h-8 text-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-foreground/60">No labels created yet</p>
                <p className="text-xs text-foreground/40 mt-1">
                  Labels help organize and categorize your tasks
                </p>
              </div>
            )
          )}
        </div>

        {/* Usage Tips */}
        <div className="p-3 bg-blue-50 rounded-lg border border-blue-200">
          <h5 className="text-sm font-medium text-blue-800 mb-1">💡 Label Tips</h5>
          <ul className="text-xs text-blue-700 space-y-1">
            <li>• Use labels to categorize tasks across different projects</li>
            <li>• System labels are available to all users and cannot be modified</li>
            <li>• You can assign labels when creating or editing tasks</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}