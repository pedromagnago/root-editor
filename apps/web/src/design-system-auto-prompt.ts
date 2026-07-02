export const DESIGN_SYSTEM_WORKSPACE_PROMPT_PREFIX =
  'Create this project as a complete Root Editor design system workspace.';

// Sessions created before the rebrand persisted the old sentinel in their
// history; detection must keep accepting it or their first turn loses the
// masked status card.
const DESIGN_SYSTEM_WORKSPACE_PROMPT_PREFIX_LEGACY =
  'Create this project as a complete Open Design design system workspace.';

export const DESIGN_SYSTEM_WORKSPACE_DISPLAY_TITLE =
  'Creating design system workspace';

export const DESIGN_SYSTEM_WORKSPACE_DISPLAY_DESCRIPTION =
  'Root Editor is using the setup sources to generate this project.';

export function isDesignSystemWorkspacePrompt(content: string): boolean {
  const trimmed = content.trimStart();
  return (
    trimmed.startsWith(DESIGN_SYSTEM_WORKSPACE_PROMPT_PREFIX) ||
    trimmed.startsWith(DESIGN_SYSTEM_WORKSPACE_PROMPT_PREFIX_LEGACY)
  );
}
