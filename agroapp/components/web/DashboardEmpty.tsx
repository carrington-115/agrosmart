import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Button } from "@/components/ui/button";

interface DashboardEmptyTemplateProps {
  Icon: React.ReactNode;
  title: string;
  description: string;
  actionText: string;
  action: () => void;
  anotherButtonActionText?: string;
  anotherButtonAction?: () => void;
}

export function DashboardEmptyTemplate({
  Icon,
  title,
  description,
  actionText,
  action,
  anotherButtonActionText,
  anotherButtonAction,
}: DashboardEmptyTemplateProps) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="default">{Icon}</EmptyMedia>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <Button onClick={action}>{actionText}</Button>
          <Button
            variant="outline"
            onClick={anotherButtonAction && anotherButtonAction}
          >
            {anotherButtonActionText
              ? anotherButtonActionText
              : "Go to Settings"}
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
