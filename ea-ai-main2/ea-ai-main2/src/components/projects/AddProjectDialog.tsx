import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Label } from "../ui/label";
import { Badge } from "../ui/badge";
import { Plus, Palette, CheckCircle } from "lucide-react";
import { toast } from "sonner";

const projectFormSchema = z.object({
  name: z.string().min(1, "Project name is required").max(50, "Project name too long"),
  description: z.string().max(200, "Description too long").optional(),
  color: z.string().optional(),
});

type ProjectFormData = z.infer<typeof projectFormSchema>;

interface AddProjectDialogProps {
  editProject?: {
    _id: Id<"projects">;
    name: string;
    description?: string;
    color?: string;
  };
  trigger?: React.ReactNode;
  onProjectCreated?: () => void;
}

const DEFAULT_COLORS = [
  "#ef4444", // red
  "#f97316", // orange  
  "#eab308", // yellow
  "#22c55e", // green
  "#10b981", // emerald
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#64748b", // gray
  "#1f2937", // dark
];

export function AddProjectDialog({ 
  editProject, 
  trigger,
  onProjectCreated 
}: AddProjectDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedColor, setSelectedColor] = useState(editProject?.color || DEFAULT_COLORS[0]);

  const createProject = useMutation(api.projects.createProject);
  const updateProject = useMutation(api.projects.updateProject);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<ProjectFormData>({
    resolver: zodResolver(projectFormSchema),
    defaultValues: {
      name: editProject?.name || "",
      description: editProject?.description || "",
      color: editProject?.color || DEFAULT_COLORS[0],
    }
  });

  const onSubmit = async (data: ProjectFormData) => {
    try {
      const projectData = {
        ...data,
        color: selectedColor,
      };

      if (editProject) {
        await updateProject({
          id: editProject._id,
          ...projectData,
        });
        toast.success("Project updated successfully!");
      } else {
        await createProject(projectData);
        toast.success("Project created successfully!");
      }

      reset();
      setSelectedColor(DEFAULT_COLORS[0]);
      setIsOpen(false);
      onProjectCreated?.();
    } catch (error) {
      console.error("Error saving project:", error);
      toast.error(editProject ? "Failed to update project" : "Failed to create project");
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      reset();
      if (!editProject) {
        setSelectedColor(DEFAULT_COLORS[0]);
      }
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            New Project
          </Button>
        )}
      </DialogTrigger>
      
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Palette className="w-5 h-5" />
            {editProject ? "Edit Project" : "Create New Project"}
          </DialogTitle>
          <DialogDescription>
            {editProject 
              ? "Update your project details and settings."
              : "Create a new project to organize your tasks."
            }
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Project Name */}
          <div className="space-y-2">
            <Label htmlFor="name" className="text-sm font-medium">
              Project Name
            </Label>
            <Input
              id="name"
              {...register("name")}
              placeholder="Enter project name..."
              className="text-sm"
            />
            {errors.name && (
              <p className="text-xs text-red-500">{errors.name.message}</p>
            )}
          </div>

          {/* Project Description */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm font-medium">
              Description (Optional)
            </Label>
            <Textarea
              id="description"
              {...register("description")}
              placeholder="Describe your project..."
              className="text-sm min-h-[60px] resize-none"
            />
            {errors.description && (
              <p className="text-xs text-red-500">{errors.description.message}</p>
            )}
          </div>

          {/* Color Selection */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Project Color</Label>
            <div className="flex items-center gap-2">
              <Badge 
                className="px-2 py-1 text-xs"
                style={{ 
                  backgroundColor: selectedColor + "20",
                  color: selectedColor,
                  borderColor: selectedColor + "40"
                }}
              >
                Preview
              </Badge>
              <div className="text-xs text-foreground/60">
                Choose a color to identify your project
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {DEFAULT_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setSelectedColor(color)}
                  className={`w-8 h-8 rounded-full border-2 transition-all hover:scale-110 ${
                    selectedColor === color 
                      ? "border-foreground/30 shadow-md" 
                      : "border-foreground/10"
                  }`}
                  style={{ backgroundColor: color }}
                >
                  {selectedColor === color && (
                    <CheckCircle className="w-4 h-4 text-white mx-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Preview */}
          <div className="p-3 bg-accent/5 rounded-lg border">
            <div className="flex items-center gap-3">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: selectedColor }}
              />
              <div>
                <div className="text-sm font-medium">
                  {register("name").value || "Project Name"}
                </div>
                {register("description").value && (
                  <div className="text-xs text-foreground/60 mt-0.5">
                    {register("description").value}
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setIsOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting
                ? (editProject ? "Updating..." : "Creating...")
                : (editProject ? "Update Project" : "Create Project")
              }
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}