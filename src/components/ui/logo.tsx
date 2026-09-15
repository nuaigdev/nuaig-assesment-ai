import Image from "next/image";

/** Dark wordmark on light surfaces, white on the call stage and dark headers (spec §9.2). */
export function Logo({
  variant = "dark",
  height = 40,
  className,
}: {
  variant?: "dark" | "white";
  height?: number;
  className?: string;
}) {
  return (
    <Image
      src={variant === "white" ? "/brand/nuaig-logo-white.svg" : "/brand/nuaig-logo.svg"}
      alt="NuAIg"
      width={Math.round((height * 362.5) / 150)}
      height={height}
      className={className}
      unoptimized
    />
  );
}
