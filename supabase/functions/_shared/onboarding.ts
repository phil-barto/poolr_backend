// Single source of truth for onboarding. Ordered; the first incomplete step is
// what the client shows next. Add/remove/reorder steps here + deploy — no
// migration, no app release (a new step still needs its screen shipped in the
// client registry at src/app/onboarding/[step].tsx).
export const REQUIRED_STEPS = ["bank_linked"] as const;

// Steps a user may dismiss without completing. Meaning-bearing steps stay off
// this list so completion rows can't be forged from the client.
export const SKIPPABLE_STEPS = ["bank_linked"] as const;

// The enum, in code: the pg column is plain text; TS enforces the vocabulary.
export type OnboardingStep = (typeof REQUIRED_STEPS)[number];
