import React from "react";
import { Icon } from "@/lib/utils";
import { Button } from "./Button";

interface BatchFolderSelectorProps {
  selectedFolderPath: string | null;
  onSelectFolderClick: () => void;
  subtitle?: string;
}

export default function BatchFolderSelector({
  selectedFolderPath,
  onSelectFolderClick,
  subtitle = "Batch process multiple media files"
}: BatchFolderSelectorProps) {
  return (
    <div className="flex items-center justify-between bg-[var(--theme-ui-bg)] backdrop-blur-md p-4 rounded-xl border border-[var(--theme-ui-border)] shadow-sm">
      <div className="flex items-center gap-3 overflow-hidden">
        <div className="flex items-center justify-center p-2 bg-[var(--theme-bg)] text-[var(--theme-heading)] rounded-lg border border-[var(--theme-ui-border)] shadow-sm shrink-0">
          <Icon name="folder" size={20} />
        </div>
        <div className="truncate">
          <p className="text-sm font-medium text-[var(--theme-heading)] truncate">
            {selectedFolderPath || "No folder selected"}
          </p>
          <p className="text-xs text-[var(--theme-text)]">{subtitle}</p>
        </div>
      </div>
      <Button
        variant="secondary"
        size="sm"
        onClick={onSelectFolderClick}
        className="bg-[var(--theme-bg)] text-[var(--theme-heading)] hover:text-white transition-colors border border-[var(--theme-ui-border)] shadow-sm"
      >
        Select Folder
      </Button>
    </div>
  );
}
