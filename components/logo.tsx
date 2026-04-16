"use client"

import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { useTheme } from "next-themes"
import { useEffect, useState } from "react"

interface LogoProps {
  href?: string
  size?: "sm" | "md" | "lg" | "xl"
  className?: string
}

const sizeMap = {
  sm: { height: 32, width: 32 }, // For sidebar when collapsed
  md: { height: 36, width: 36 }, // Medium size
  lg: { height: 56, width: 56 }, // Large for sidebar expanded
  xl: { height: 140, width: 140 }, // Extra large - 3x bigger than original
}

export function Logo({ href = "/", size = "md", className }: LogoProps) {
  const sizeConfig = sizeMap[size]
  const { theme, resolvedTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Use a filter to adapt the logo for dark mode while maintaining design integrity
  const isDark = resolvedTheme === "dark"
  
  const logoElement = (
    <div 
      className={cn(
        "relative flex items-center justify-center",
        isDark ? "brightness-0 invert" : "",
        className
      )}
    >
      {mounted && (
        <Image
          src="/logo.png"
          alt="Familia Santarelli"
          height={sizeConfig.height}
          width={sizeConfig.width}
          priority
          className="object-contain"
        />
      )}
    </div>
  )

  if (href) {
    return (
      <Link 
        href={href} 
        className="inline-flex hover:opacity-80 transition-opacity"
        title="Volver al Panel"
      >
        {logoElement}
      </Link>
    )
  }

  return logoElement
}
