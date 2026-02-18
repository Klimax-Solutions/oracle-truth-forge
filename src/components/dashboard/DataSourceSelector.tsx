import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Database, ChevronDown } from "lucide-react";

export type DataSource = "all" | "perso" | "oracle" | "data-generale";

interface DataSourceSelectorProps {
  value: DataSource;
  onChange: (value: DataSource) => void;
  showDataGenerale?: boolean;
}

const LABELS: Record<DataSource, string> = {
  all: "Oracle + Perso",
  perso: "Setup Perso",
  oracle: "Oracle",
  "data-generale": "Data Générale",
};

export const DataSourceSelector = ({ value, onChange, showDataGenerale = false }: DataSourceSelectorProps) => {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5 h-8 px-2 md:px-3">
          <Database className="w-3.5 h-3.5" />
          <span className="text-[10px] md:text-xs hidden xs:inline">{LABELS[value]}</span>
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
          <DropdownMenuRadioItem value="oracle" className="cursor-pointer">
            Oracle uniquement
          </DropdownMenuRadioItem>
          {showDataGenerale && (
            <DropdownMenuRadioItem value="data-generale" className="cursor-pointer">
              Data Générale — Indices US
            </DropdownMenuRadioItem>
          )}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
