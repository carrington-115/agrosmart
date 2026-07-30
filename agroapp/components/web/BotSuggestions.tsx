import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { Badge } from "../ui/badge";
import { botSuggestionsProps } from "@/lib/types";

export default function BotSuggestions({
  header,
  suggestions,
  footer,
  action,
}: botSuggestionsProps) {
  return (
    <Card onClick={action} className="cursor-pointer shadow-none gap-3">
      <CardHeader>
        <CardTitle>{header}</CardTitle>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-xs">{suggestions}</CardDescription>
      </CardContent>
      <CardFooter>
        <Badge
          variant="default"
          className="bg-primary-container text-on-primary-container"
        >
          {footer}
        </Badge>
      </CardFooter>
    </Card>
  );
}
