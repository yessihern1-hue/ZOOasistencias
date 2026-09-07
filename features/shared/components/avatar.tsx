type AvatarProps = {
  initials: string;
  label?: string;
  tone?: "blue" | "purple" | "orange" | "green" | "pink";
  size?: "sm" | "md" | "lg";
};

export function Avatar({
  initials,
  label,
  tone = "blue",
  size = "md",
}: AvatarProps) {
  return (
    <span
      aria-label={label}
      className={`avatar avatar-${tone} avatar-${size}`}
      role={label ? "img" : undefined}
    >
      {initials}
    </span>
  );
}
