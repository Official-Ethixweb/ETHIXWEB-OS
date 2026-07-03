export interface PasswordStrength {
  score: number; // 0-4
  label: string;
  colorClass: string;
}

/** Lightweight client-side heuristic; not a substitute for server-side policy. */
export function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return { score: 0, label: "", colorClass: "bg-muted" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^a-zA-Z0-9]/.test(password)) score++;

  const clamped = Math.min(score, 4);
  const levels: Omit<PasswordStrength, "score">[] = [
    { label: "Too weak", colorClass: "bg-destructive" },
    { label: "Weak", colorClass: "bg-destructive" },
    { label: "Fair", colorClass: "bg-warning" },
    { label: "Good", colorClass: "bg-success" },
    { label: "Strong", colorClass: "bg-success" },
  ];
  return { score: clamped, ...levels[clamped] };
}
