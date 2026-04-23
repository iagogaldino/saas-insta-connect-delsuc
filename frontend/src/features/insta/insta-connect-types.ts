export type InstaLinkResult =
  | { success: true; url: string }
  | { success: false; error: string }
