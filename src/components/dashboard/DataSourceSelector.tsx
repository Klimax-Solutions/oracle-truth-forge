import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Database, ChevronDown } from "lucide-react";

export type DataSource = "all" | "perso";

interface DataSourceSelectorProps {
  value: DataSource;
  onChange: (value: DataSource) => void;
}

export const DataSourceSelector = ({ value, onChange }: DataSourceSelectorProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2 h-9">
          <Database className="w-4 h-4" />
          <span className="text-xs">
            {value === "all" ? "Oracle + Perso" : "Setup Perso"}
          </span>
          <ChevronDown className="w-3 h-3 opacity-50" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48 bg-popover border border-border">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as DataSource)}>
          <DropdownMenuRadioItem value="all" className="cursor-pointer">
            Oracle + Setup Perso
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem value="perso" className="cursor-pointer">
            Setup Perso uniquement
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
