// Note: the keys from this object are used by the config type, but the locale
// names aren't used directly in Keystatic, they're just here to document the
// ones we support.

// The locales object is also used by `/dev-projects/localization` to generate config
// for managing locale translations in Keystatic itself (!!)

export const locales = {
  'en-US': 'English (United States) 🇺🇸',
  'vi-VN': 'Tiếng Việt (Việt Nam) 🇻🇳',
};

export type Locale = keyof typeof locales;
