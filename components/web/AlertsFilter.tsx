import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useState } from "react";
import { Button } from "../ui/button";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

export default function AlertsFilter() {
  const [date, setDate] = useState<Date>();
  return (
    <div className="w-full max-w-[100%] mx-auto flex items-center justify-center mt-5">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium whitespace-nowrap">
            Filter by status:
          </p>
          <Select>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium whitespace-nowrap">
            Filter by type:
          </p>
          <Select>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Theme" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="light">Light</SelectItem>
              <SelectItem value="dark">Dark</SelectItem>
              <SelectItem value="system">System</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-center gap-3">
          <p className="text-sm font-medium whitespace-nowrap">
            Filter by date:
          </p>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                data-empty={!date}
                className="data-[empty=true]:text-muted-foreground w-[280px] justify-start text-left font-normal"
              >
                <CalendarIcon />
                {date ? format(date, "PPP") : <span>Pick a date</span>}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0">
              <Calendar mode="single" selected={date} onSelect={setDate} />
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </div>
  );
}
