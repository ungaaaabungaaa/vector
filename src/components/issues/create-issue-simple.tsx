"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/lib/convex";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ChevronDown, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Id } from "../../../convex/_generated/dataModel";
import type { FunctionReturnType } from "convex/server";

// Infer types from Convex query outputs
type Project = FunctionReturnType<
  typeof api.organizations.listProjects
>[number];
type State = FunctionReturnType<
  typeof api.organizations.listIssueStates
>[number];
type Priority = FunctionReturnType<
  typeof api.organizations.listIssuePriorities
>[number];

interface CreateIssueSimpleProps {
  open: boolean;
  onClose: () => void;
  orgSlug: string;
  onSuccess?: (issueId: string) => void;
}

export function CreateIssueSimple({
  open,
  onClose,
  orgSlug,
  onSuccess,
}: CreateIssueSimpleProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedProject, setSelectedProject] = useState("");
  const [selectedState, setSelectedState] = useState("");
  const [selectedPriority, setSelectedPriority] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Fetch data
  const projectsData = useQuery(api.organizations.listProjects, { orgSlug });
  const statesData = useQuery(api.organizations.listIssueStates, { orgSlug });
  const prioritiesData = useQuery(api.organizations.listIssuePriorities, {
    orgSlug,
  });

  const projects = useMemo(() => projectsData ?? [], [projectsData]);
  const states = useMemo(() => statesData ?? [], [statesData]);
  const priorities = useMemo(() => prioritiesData ?? [], [prioritiesData]);

  // Auto-select defaults
  useEffect(() => {
    if (projects.length > 0 && !selectedProject) {
      setSelectedProject(projects[0]._id);
    }
  }, [projects, selectedProject]);

  useEffect(() => {
    if (states.length > 0 && !selectedState) {
      const defaultState =
        states.find((s: State) => s.type === "todo") || states[0];
      setSelectedState(defaultState._id);
    }
  }, [states, selectedState]);

  useEffect(() => {
    if (priorities.length > 0 && !selectedPriority) {
      const defaultPriority =
        priorities.find((p: Priority) => p.weight === 0) || priorities[0];
      setSelectedPriority(defaultPriority._id);
    }
  }, [priorities, selectedPriority]);

  const createMutation = useMutation(api.issues.create);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !selectedProject) return;

    try {
      setIsLoading(true);
      const result = await createMutation({
        orgSlug,
        data: {
          title: title.trim(),
          description: description.trim() || undefined,
          projectId: selectedProject as Id<"projects">,
          stateId: selectedState
            ? (selectedState as Id<"issueStates">)
            : undefined,
          priorityId: selectedPriority
            ? (selectedPriority as Id<"issuePriorities">)
            : undefined,
        },
      });

      onSuccess?.(result.issueId);
      onClose();

      // Reset form
      setTitle("");
      setDescription("");
      setSelectedProject("");
      setSelectedState("");
      setSelectedPriority("");
    } catch (error) {
      console.error("Failed to create issue:", error);
      alert("Failed to create issue. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Issue</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div>
            <label className="text-sm font-medium">Title</label>
            <Input
              placeholder="Issue title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-sm font-medium">Description</label>
            <Textarea
              placeholder="Add a description..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[80px] resize-none"
            />
          </div>

          {/* Project */}
          <div>
            <label className="text-sm font-medium">Project</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedProject
                    ? projects.find((p: Project) => p._id === selectedProject)
                        ?.name
                    : "Select project"}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search projects..." />
                  <CommandList>
                    <CommandEmpty>No project found.</CommandEmpty>
                    <CommandGroup>
                      {projects.map((project: Project) => (
                        <CommandItem
                          key={project._id}
                          value={project.name}
                          onSelect={() => setSelectedProject(project._id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedProject === project._id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {project.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* State */}
          <div>
            <label className="text-sm font-medium">State</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedState
                    ? states.find((s: State) => s._id === selectedState)?.name
                    : "Select state"}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search states..." />
                  <CommandList>
                    <CommandEmpty>No state found.</CommandEmpty>
                    <CommandGroup>
                      {states.map((state: State) => (
                        <CommandItem
                          key={state._id}
                          value={state.name}
                          onSelect={() => setSelectedState(state._id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedState === state._id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {state.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Priority */}
          <div>
            <label className="text-sm font-medium">Priority</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-full justify-between">
                  {selectedPriority
                    ? priorities.find(
                        (p: Priority) => p._id === selectedPriority,
                      )?.name
                    : "Select priority"}
                  <ChevronDown className="h-4 w-4 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-full p-0">
                <Command>
                  <CommandInput placeholder="Search priorities..." />
                  <CommandList>
                    <CommandEmpty>No priority found.</CommandEmpty>
                    <CommandGroup>
                      {priorities.map((priority: Priority) => (
                        <CommandItem
                          key={priority._id}
                          value={priority.name}
                          onSelect={() => setSelectedPriority(priority._id)}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedPriority === priority._id
                                ? "opacity-100"
                                : "opacity-0",
                            )}
                          />
                          {priority.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={!title.trim() || !selectedProject || isLoading}
            >
              {isLoading ? "Creating..." : "Create Issue"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
