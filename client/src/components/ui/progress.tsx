"use client"

import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root>
>(({ className, value = 0, ...props }, ref) => {
  // Handle null value case
  const safeValue = value ?? 0;

  // Dynamically change the background color based on progress value
  const progressColor = safeValue < 50 ? "#FF4D4D" : safeValue < 80 ? "#FFA500" : "#4CAF50"; // Red, Orange, Green

  return (
    <ProgressPrimitive.Root
      ref={ref}
      className={cn(
        "relative h-4 w-full overflow-hidden rounded-full bg-secondary",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        className="h-full w-full flex-1 transition-all"
        style={{
          transform: `translateX(-${100 - safeValue}%)`,
          background: progressColor, // Dynamic color based on progress
          transition: "transform 0.3s ease-in-out", // Smooth transition effect
        }}
      />
    </ProgressPrimitive.Root>
  )
})

Progress.displayName = ProgressPrimitive.Root.displayName

export { Progress }
