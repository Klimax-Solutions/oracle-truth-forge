import { useTheme } from "next-themes";
import { useMemo } from "react";

export const useChartColors = () => {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";
  
  return useMemo(() => ({
    axis: isDark ? "#525252" : "#a3a3a3",
    axisLine: isDark ? "#262626" : "#e5e5e5",
    tooltip: {
      bg: isDark ? "#171717" : "#ffffff",
      border: isDark ? "#262626" : "#e5e5e5",
      text: isDark ? "#ffffff" : "#171717",
      label: isDark ? "#a3a3a3" : "#525252",
    },
    bar: isDark ? "#ffffff" : "#171717",
    currentBar: isDark ? "#ffffff" : "#000000",
    // Semantic colors
    card: isDark ? "#0a0a0a" : "#ffffff",
    cardBorder: isDark ? "#262626" : "#e5e5e5",
  }), [isDark]);
};

// Static colors for charts (used in components without hooks)
export const getChartColors = (isDark: boolean) => ({
  axis: isDark ? "#525252" : "#a3a3a3",
  axisLine: isDark ? "#262626" : "#e5e5e5",
  tooltip: {
    bg: isDark ? "#171717" : "#ffffff",
    border: isDark ? "#262626" : "#e5e5e5",
    text: isDark ? "#ffffff" : "#171717",
    label: isDark ? "#a3a3a3" : "#525252",
  },
  bar: isDark ? "#ffffff" : "#171717",
});
