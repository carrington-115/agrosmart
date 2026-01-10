interface HeaderProps {
  leftContent: React.ReactNode;
  rightContent: React.ReactNode;
}

export default function DashboardHeader({
  leftContent,
  rightContent,
}: HeaderProps) {
  return (
    <div className="w-full mx-auto flex justify-between items-center pt-[40px] px-4 pb-[10px]">
      <div>{leftContent}</div>
      <div>{rightContent}</div>
    </div>
  );
}
