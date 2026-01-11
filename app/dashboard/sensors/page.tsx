"use client";

import { Analytics, SensorsHeader } from "@/components/web";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export default function Sensors() {
  const [sensors, setSensors] = useState<number>(1);
  return (
    <div className="max-w-[100%] mx-auto overflow-x-hidden">
      <SensorsHeader />
      <>
        {sensors > 0 ? (
          <>
            <Analytics />
          </>
        ) : (
          <div className="max-w-[100%] mx-auto h-screen flex justify-center items-center">
            <div className="flex flex-col gap-3 items-center">
              <h1 className="text-2xl font-bold">Get Started</h1>
              <p>It's a bit quiet in here. Let's get the ball rolling.</p>
              <Button>Get Started</Button>
            </div>
          </div>
        )}
      </>
    </div>
  );
}
