import LogoTitle from "@/assets/images/logo-light.svg";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import Link from "next/link";

export default function Header() {
  return (
    <header className="absolute left-0 right-0 top-4 px-4 flex items-center justify-between">
      <Link href="/" className="flex items-center gap-2">
        <Image src={LogoTitle} alt="Logo" width={36} height={36} />
        <h2 className="text-xl font-bold">AgroSmart</h2>
      </Link>
      <div>
        <Button variant="outline">Learn more</Button>
      </div>
    </header>
  );
}
