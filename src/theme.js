/**
 * Theme management module
 * Handles dark/light mode toggle and persistence
 */

const THEME_KEY = 'copy-paste-theme';
const VALID_THEMES = ['light', 'dark'];

/**
 * Validate theme value
 * @param {string} theme - Theme to validate
 * @returns {boolean} True if valid
 */
function isValidTheme(theme) {
  return VALID_THEMES.includes(theme);
}

/**
 * Get the current theme from localStorage or system preference
 * @returns {'light'|'dark'} Current theme
 */
export function getTheme() {
  const stored = localStorage.getItem(THEME_KEY);

  // Validate stored theme
  if (stored && isValidTheme(stored)) {
    return stored;
  }

  // Check system preference
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

/**
 * Set and apply a theme
 * @param {'light'|'dark'} theme - Theme to apply
 */
export function setTheme(theme) {
  // Validate theme
  if (!isValidTheme(theme)) {
    console.error(`Invalid theme: ${theme}. Expected one of: ${VALID_THEMES.join(', ')}`);
    return;
  }

  localStorage.setItem(THEME_KEY, theme);
  document.documentElement.setAttribute('data-theme', theme);
}

/**
 * Toggle between light and dark themes
 * @returns {'light'|'dark'} New theme
 */
export function toggleTheme() {
  const current = getTheme();
  const newTheme = current === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
  return newTheme;
}

/**
 * Initialize theme toggle button
 * Automatically sets up click handler and syncs UI
 */
export function initThemeToggle() {
  // Apply saved theme immediately (before page renders)
  const currentTheme = getTheme();
  setTheme(currentTheme);

  // Set up toggle button
  const toggleBtn = document.getElementById('theme-toggle');
  if (!toggleBtn) {
    console.warn('Theme toggle button not found');
    return;
  }

  toggleBtn.addEventListener('click', () => {
    toggleTheme();
  });

  // Listen for system theme changes
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
      // Only auto-switch if user hasn't manually set a preference
      if (!localStorage.getItem(THEME_KEY)) {
        setTheme(e.matches ? 'dark' : 'light');
      }
    });
  }
}
