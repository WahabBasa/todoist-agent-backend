import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Card } from "../ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../ui/select";
import { Badge } from "../ui/badge";
import { Calendar, Clock, Tag, X, Plus, CalendarDays } from "lucide-react";
import { toast } from "sonner";

const taskFormSchema = z.object({
  taskName: z.string().min(1, "Task name is required"),
  description: z.string().optional(),
  dueDate: z.string().optional(),
  priority: z.number().min(1).max(4),
  projectId: z.string().optional(),
  labelId: z.string().optional(),
  estimatedTime: z.number().min(0).max(1440).optional(), // max 24 hours in minutes
  tags: z.array(z.string()).optional(),
});

type TaskFormData = z.infer<typeof taskFormSchema>;

interface AddTaskInlineProps {
  isOpen: boolean;
  onClose: () => void;
  parentTaskId?: Id<"tasks">; // For creating subtasks
  defaultProjectId?: Id<"projects">;
  defaultLabelId?: Id<"labels">;
  onTaskCreated?: () => void;
}

export function AddTaskInline({ 
  isOpen, 
  onClose, 
  parentTaskId, 
  defaultProjectId,
  defaultLabelId,
  onTaskCreated
}: AddTaskInlineProps) {
  const [currentTag, setCurrentTag] = useState("");
  const [tags, setTags] = useState<string[]>([]);

  const projects = useQuery(api.projects.getProjects);
  const labels = useQuery(api.labels.getLabels);
  
  // Use appropriate mutations based on whether it's a subtask or main task
  const createTask = useMutation(parentTaskId ? api.subTodos.createSubTodo : api.tasks.createATodo);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<TaskFormData>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      taskName: "",
      description: "",
      priority: 3,
      projectId: defaultProjectId || "",
      labelId: defaultLabelId || "",
      estimatedTime: 0,
      tags: [],
    }
  });

  const watchedValues = watch();

  const onSubmit = async (data: TaskFormData) => {
    try {
      const taskData: any = {
        taskName: data.taskName,
        description: data.description || undefined,
        priority: data.priority,
        dueDate: data.dueDate ? new Date(data.dueDate).getTime() : undefined,
        projectId: data.projectId || undefined,
        labelId: data.labelId || undefined,
        // AI-specific fields (for main tasks only)
        ...((!parentTaskId) && {
          estimatedTime: data.estimatedTime || undefined,
          tags: tags.length > 0 ? tags : undefined,
        })
      };

      // Add parent task ID for subtasks
      if (parentTaskId) {
        taskData.parentId = parentTaskId;
        // Subtasks require projectId and labelId, inherit from parent if not provided
        if (!taskData.projectId && defaultProjectId) {
          taskData.projectId = defaultProjectId;
        }
        if (!taskData.labelId && defaultLabelId) {
          taskData.labelId = defaultLabelId;
        }
      }

      await createTask(taskData);
      
      toast.success(
        parentTaskId ? "Subtask created successfully!" : "Task created successfully!"
      );
      
      // Reset form
      reset();
      setTags([]);
      onTaskCreated?.();
      onClose();
    } catch (error) {
      console.error("Error creating task:", error);
      toast.error("Failed to create task");
    }
  };

  const addTag = () => {
    if (currentTag.trim() && !tags.includes(currentTag.trim())) {
      const newTags = [...tags, currentTag.trim()];
      setTags(newTags);
      setValue("tags", newTags);
      setCurrentTag("");
    }
  };

  const removeTag = (tagToRemove: string) => {
    const newTags = tags.filter(tag => tag !== tagToRemove);
    setTags(newTags);
    setValue("tags", newTags);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      if (currentTag.trim()) {
        addTag();
      } else {
        handleSubmit(onSubmit)();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const getPriorityLabel = (priority: number) => {
    switch (priority) {
      case 1: return "High";
      case 2: return "Medium";
      case 3: return "Normal";
      case 4: return "Low";
      default: return "Normal";
    }
  };

  const getPriorityColor = (priority: number) => {
    switch (priority) {
      case 1: return "bg-red-100 text-red-800 border-red-200";
      case 2: return "bg-orange-100 text-orange-800 border-orange-200";
      case 3: return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case 4: return "bg-green-100 text-green-800 border-green-200";
      default: return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  if (!isOpen) return null;

  return (
    <Card className="p-4 border-l-4 border-l-accent shadow-sm">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        {/* Task Name */}
        <div>
          <Input
            {...register("taskName")}
            placeholder={parentTaskId ? "Add a subtask..." : "What needs to be done?"}
            className="border-0 text-base font-medium placeholder:text-foreground/40"
            onKeyDown={handleKeyPress}
            autoFocus
          />
          {errors.taskName && (
            <p className="text-xs text-red-500 mt-1">{errors.taskName.message}</p>
          )}
        </div>

        {/* Description */}
        <div>
          <Textarea
            {...register("description")}
            placeholder="Add a description..."
            className="min-h-[60px] resize-none text-sm"
            onKeyDown={handleKeyPress}
          />
        </div>

        {/* Form Controls Row 1 */}
        <div className="grid grid-cols-2 gap-3">
          {/* Due Date */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground/70 flex items-center gap-1">
              <CalendarDays className="w-3 h-3" />
              Due Date
            </label>
            <Input
              type="date"
              {...register("dueDate")}
              className="text-sm"
            />
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground/70">Priority</label>
            <Select
              value={watchedValues.priority?.toString()}
              onValueChange={(value) => setValue("priority", parseInt(value))}
            >
              <SelectTrigger className="text-sm">
                <SelectValue>
                  <Badge className={`text-xs ${getPriorityColor(watchedValues.priority || 3)}`}>
                    {getPriorityLabel(watchedValues.priority || 3)}
                  </Badge>
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((priority) => (
                  <SelectItem key={priority} value={priority.toString()}>
                    <Badge className={`text-xs ${getPriorityColor(priority)}`}>
                      {getPriorityLabel(priority)}
                    </Badge>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Form Controls Row 2 */}
        <div className="grid grid-cols-2 gap-3">
          {/* Project */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground/70">Project</label>
            <Select
              value={watchedValues.projectId}
              onValueChange={(value) => setValue("projectId", value)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects?.map((project) => (
                  <SelectItem key={project._id} value={project._id}>
                    <div className="flex items-center gap-2">
                      {project.color && (
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: project.color }}
                        />
                      )}
                      {project.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Label */}
          <div className="space-y-1">
            <label className="text-xs font-medium text-foreground/70">Label</label>
            <Select
              value={watchedValues.labelId}
              onValueChange={(value) => setValue("labelId", value)}
            >
              <SelectTrigger className="text-sm">
                <SelectValue placeholder="Select label" />
              </SelectTrigger>
              <SelectContent>
                {labels?.map((label) => (
                  <SelectItem key={label._id} value={label._id}>
                    <div className="flex items-center gap-2">
                      <Tag className="w-3 h-3" />
                      {label.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* AI-specific fields (only for main tasks) */}
        {!parentTaskId && (
          <>
            {/* Estimated Time */}
            <div className="space-y-1">
              <label className="text-xs font-medium text-foreground/70 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                Estimated Time (minutes)
              </label>
              <Input
                type="number"
                min="0"
                max="1440"
                {...register("estimatedTime", { valueAsNumber: true })}
                placeholder="0"
                className="text-sm"
              />
            </div>

            {/* Tags */}
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/70 flex items-center gap-1">
                <Tag className="w-3 h-3" />
                Tags
              </label>
              <div className="flex gap-2">
                <Input
                  value={currentTag}
                  onChange={(e) => setCurrentTag(e.target.value)}
                  placeholder="Add a tag..."
                  className="text-sm flex-1"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addTag}
                  disabled={!currentTag.trim()}
                >
                  <Plus className="w-3 h-3" />
                </Button>
              </div>
              {tags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {tags.map((tag) => (
                    <Badge
                      key={tag}
                      variant="secondary"
                      className="text-xs px-2 py-0.5 flex items-center gap-1"
                    >
                      {tag}
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeTag(tag)}
                        className="w-3 h-3 p-0 hover:bg-transparent"
                      >
                        <X className="w-2 h-2" />
                      </Button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            size="sm"
            disabled={isSubmitting || !watchedValues.taskName?.trim()}
          >
            {isSubmitting ? "Creating..." : 
             parentTaskId ? "Add Subtask" : "Add Task"}
          </Button>
        </div>
      </form>
    </Card>
  );
}